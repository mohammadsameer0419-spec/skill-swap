-- ============================================
-- Add expires_at Column and Scheduled Cleanup
-- ============================================
-- Adds expiration tracking for pending transactions and sets up
-- a cron job to automatically cancel expired pending swaps

-- ============================================
-- Step 1: Add expires_at column to credit_transactions
-- ============================================
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for efficient querying of expired transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires_at 
ON credit_transactions(expires_at) 
WHERE expires_at IS NOT NULL AND status IN ('pending', 'reserved');

-- ============================================
-- Step 2: Update execute_skill_swap functions to set expires_at
-- ============================================
-- Update both execute_skill_swap functions to set expires_at = NOW() + 24 hours
-- for pending/reserved transactions when session is created

-- Update the function in 011_execute_skill_swap.sql pattern
CREATE OR REPLACE FUNCTION execute_skill_swap(
  p_session_id UUID,
  p_learner_id UUID,
  p_teacher_id UUID,
  p_credits_amount INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_learner_balance INTEGER;
  v_pending_transaction_id UUID;
  v_existing_pending_id UUID;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- IDEMPOTENCY: Check if pending transaction already exists for this session
  SELECT id INTO v_existing_pending_id
  FROM credit_transactions
  WHERE session_id = p_session_id
    AND type = 'pending'
    AND status = 'pending'
    AND user_id = p_learner_id
  LIMIT 1;
  
  IF v_existing_pending_id IS NOT NULL THEN
    -- Idempotent: return existing pending transaction ID
    RETURN v_existing_pending_id;
  END IF;
  
  -- VALIDATION: Verify session exists and is in correct state
  SELECT id, learner_id, teacher_id, status, credits_amount
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  -- Validate session participants
  IF v_session_record.learner_id != p_learner_id THEN
    RAISE EXCEPTION 'Learner ID mismatch. Expected: %, Got: %', 
      v_session_record.learner_id, p_learner_id;
  END IF;
  
  IF v_session_record.teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'Teacher ID mismatch. Expected: %, Got: %', 
      v_session_record.teacher_id, p_teacher_id;
  END IF;
  
  -- Validate session status (should be 'requested' or 'accepted')
  IF v_session_record.status NOT IN ('requested', 'accepted', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot create swap for session with status: %', v_session_record.status;
  END IF;
  
  -- Use session's credits_amount if provided, otherwise use parameter
  IF v_session_record.credits_amount IS NOT NULL THEN
    p_credits_amount := v_session_record.credits_amount;
  END IF;
  
  IF p_credits_amount <= 0 THEN
    RAISE EXCEPTION 'Credits amount must be positive, got: %', p_credits_amount;
  END IF;
  
  -- VERIFY LEARNER HAS ENOUGH CREDITS
  -- Check available balance (excluding pending transactions)
  v_learner_balance := get_available_credit_balance(p_learner_id);
  
  IF v_learner_balance < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', 
      v_learner_balance, p_credits_amount;
  END IF;
  
  -- CREATE PENDING TRANSACTION RECORD
  -- This reserves the credits but doesn't deduct them yet
  -- Set expires_at = NOW() + 24 hours
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    status,
    expires_at,
    description
  ) VALUES (
    p_learner_id,
    'pending',
    -p_credits_amount, -- Negative amount (will be deducted when completed)
    v_learner_balance - p_credits_amount, -- Projected balance after completion
    p_session_id,
    'pending',
    NOW() + INTERVAL '24 hours', -- Expires 24 hours from now
    format('Pending credit swap for session %s', p_session_id)
  ) RETURNING id INTO v_pending_transaction_id;
  
  -- Update session to track that credits are pending
  UPDATE skill_sessions
  SET credits_locked = TRUE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  -- COMMIT (implicit - function completes successfully)
  RETURN v_pending_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- ============================================
-- Step 3: Function to cancel expired pending/reserved swaps
-- ============================================
-- Finds all pending/reserved transactions that have expired (older than 24 hours)
-- and where the session hasn't been accepted, then cancels them
CREATE OR REPLACE FUNCTION cancel_expired_pending_swaps()
RETURNS TABLE(
  cancelled_count INTEGER,
  cancelled_transaction_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cancelled_ids UUID[];
  v_transaction_record RECORD;
  v_transaction_id UUID;
BEGIN
  -- Find all pending/reserved transactions that have expired
  -- AND where the session status is still 'requested' (not accepted)
  FOR v_transaction_record IN
    SELECT 
      ct.id as transaction_id,
      ct.session_id,
      ct.status as transaction_status,
      ct.type as transaction_type,
      ss.status as session_status
    FROM credit_transactions ct
    INNER JOIN skill_sessions ss ON ct.session_id = ss.id
    WHERE ct.status IN ('pending', 'reserved')
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at < NOW()
      AND ss.status = 'requested' -- Only cancel if session hasn't been accepted
    FOR UPDATE OF ct -- Lock rows for atomicity
  LOOP
    -- Cancel the transaction directly (works for both 'pending' and 'reserved')
    BEGIN
      -- Update transaction to cancelled status
      UPDATE credit_transactions
      SET status = 'cancelled',
          description = COALESCE(description, '') || ' - Expired and auto-cancelled',
          updated_at = NOW()
      WHERE id = v_transaction_record.transaction_id
      RETURNING id INTO v_transaction_id;
      
      IF v_transaction_id IS NOT NULL THEN
        -- Update session to unlock credits
        UPDATE skill_sessions
        SET credits_locked = FALSE,
            updated_at = NOW()
        WHERE id = v_transaction_record.session_id;
        
        v_cancelled_ids := array_append(v_cancelled_ids, v_transaction_id);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue processing other transactions
        RAISE WARNING 'Failed to cancel expired transaction % for session %: %', 
          v_transaction_record.transaction_id, 
          v_transaction_record.session_id, 
          SQLERRM;
    END;
  END LOOP;
  
  -- Return results (handle NULL case for empty array)
  RETURN QUERY SELECT 
    COALESCE(array_length(v_cancelled_ids, 1), 0)::INTEGER as cancelled_count,
    COALESCE(v_cancelled_ids, ARRAY[]::UUID[]) as cancelled_transaction_ids;
END;
$$;

-- ============================================
-- Step 4: Enable pg_cron extension (if not already enabled)
-- ============================================
-- Note: In Supabase, pg_cron must be enabled by the database admin
-- This will fail if pg_cron is not available, but that's OK
-- The function can still be called manually or via Edge Function
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- Step 5: Schedule cron job to run every hour
-- ============================================
-- Runs cancel_expired_pending_swaps() every hour
-- Only schedule if pg_cron is available (will fail gracefully if not)
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if it exists (idempotent)
    PERFORM cron.unschedule('cancel-expired-pending-swaps');
    
    -- Schedule new job to run every hour
    PERFORM cron.schedule(
      'cancel-expired-pending-swaps',  -- Job name
      '0 * * * *',                     -- Cron schedule: every hour at minute 0
      $$SELECT cancel_expired_pending_swaps()$$  -- Function to execute
    );
    
    RAISE NOTICE 'Scheduled cron job: cancel-expired-pending-swaps (runs every hour)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Cron job not scheduled.';
    RAISE NOTICE 'You can manually call cancel_expired_pending_swaps() or use a Supabase Edge Function.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %. You may need to enable pg_cron or use Edge Functions.', SQLERRM;
END;
$$;

-- ============================================
-- Step 6: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION cancel_expired_pending_swaps() TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_expired_pending_swaps() TO service_role;

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN credit_transactions.expires_at IS 
'Timestamp when pending/reserved transaction expires. Transactions older than 24 hours without acceptance are automatically cancelled.';

COMMENT ON FUNCTION cancel_expired_pending_swaps IS 
'Finds and cancels all expired pending/reserved transactions where the session has not been accepted.
Returns count and IDs of cancelled transactions. Designed to run as a scheduled cron job every hour.';
