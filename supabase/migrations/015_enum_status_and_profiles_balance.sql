-- ============================================
-- ENUM Status Type and Profiles Balance Update
-- ============================================
-- Creates ENUM type for transaction status and updates complete_skill_swap
-- to update profiles.credits after verifying session is completed

-- ============================================
-- Step 1: Create ENUM type for transaction status
-- ============================================
CREATE TYPE transaction_status AS ENUM (
  'reserved',   -- Credits reserved for pending session
  'spent',      -- Credits spent (learner paid)
  'earned',     -- Credits earned (teacher received)
  'cancelled'   -- Transaction cancelled/voided
);

-- ============================================
-- Step 2: Add credits column to profiles (if not exists)
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL CHECK (credits >= 0);

-- Index for credit balance queries
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);

-- ============================================
-- Step 3: Drop old status column if it exists (TEXT type)
-- ============================================
-- Remove old status column and constraints
ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_status_check;

-- Add new status column with ENUM type (handle existing data)
DO $$
BEGIN
  -- Check if status column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credit_transactions' 
    AND column_name = 'status'
  ) THEN
    -- Column exists, drop it first
    ALTER TABLE credit_transactions DROP COLUMN status;
  END IF;
  
  -- Add new ENUM status column
  ALTER TABLE credit_transactions
  ADD COLUMN status transaction_status NOT NULL DEFAULT 'reserved';
  
  -- Initialize status for existing transactions based on type
  UPDATE credit_transactions
  SET status = CASE
    WHEN type = 'spent' THEN 'spent'::transaction_status
    WHEN type = 'earned' THEN 'earned'::transaction_status
    WHEN type = 'pending' OR type = 'locked' THEN 'reserved'::transaction_status
    ELSE 'reserved'::transaction_status
  END;
END $$;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status_enum 
ON credit_transactions(status) 
WHERE status IN ('reserved', 'cancelled');

-- Index for expired transactions query
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires_status 
ON credit_transactions(expires_at, status) 
WHERE expires_at IS NOT NULL AND status = 'reserved';

-- ============================================
-- Step 6: Helper function to get current credits balance
-- ============================================
CREATE OR REPLACE FUNCTION get_profile_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits INTO v_credits
  FROM profiles
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_credits, 0);
END;
$$;

-- ============================================
-- Step 7: Complete Skill Swap Function
-- ============================================
-- Updates profiles.credits balance ONLY after verifying session_status is 'completed'
CREATE OR REPLACE FUNCTION complete_skill_swap(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_reserved_transaction RECORD;
  v_learner_credits_before INTEGER;
  v_teacher_credits_before INTEGER;
  v_learner_credits_after INTEGER;
  v_teacher_credits_after INTEGER;
  v_spent_transaction_id UUID;
  v_earned_transaction_id UUID;
  v_credits_amount INTEGER;
  v_result JSON;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- VALIDATION: Verify session exists and lock row for atomicity
  SELECT id, learner_id, teacher_id, status as session_status, credits_amount
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  -- CRITICAL: Verify session_status is 'completed' before updating profiles
  IF v_session_record.session_status != 'completed' THEN
    RAISE EXCEPTION 'Cannot complete swap: Session status must be ''completed''. Current status: %', 
      v_session_record.session_status;
  END IF;
  
  -- Find reserved transaction for this session
  SELECT id, user_id, amount
  INTO v_reserved_transaction
  FROM credit_transactions
  WHERE session_id = p_session_id
    AND status = 'reserved'
    AND user_id = v_session_record.learner_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reserved transaction found for session: %', p_session_id;
  END IF;
  
  -- Calculate credits amount (absolute value of reserved transaction)
  v_credits_amount := ABS(v_reserved_transaction.amount);
  
  IF v_credits_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid credits amount: %', v_credits_amount;
  END IF;
  
  -- Get current credits balances from profiles table
  SELECT credits INTO v_learner_credits_before
  FROM profiles
  WHERE user_id = v_session_record.learner_id
  FOR UPDATE; -- Lock row for atomicity
  
  SELECT credits INTO v_teacher_credits_before
  FROM profiles
  WHERE user_id = v_session_record.teacher_id
  FOR UPDATE; -- Lock row for atomicity
  
  -- Calculate new balances
  v_learner_credits_after := v_learner_credits_before - v_credits_amount;
  v_teacher_credits_after := v_teacher_credits_before + v_credits_amount;
  
  -- Validate learner has enough credits
  IF v_learner_credits_before < v_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits: Learner has %, required %', 
      v_learner_credits_before, v_credits_amount;
  END IF;
  
  -- Convert reserved transaction to 'spent' for learner
  UPDATE credit_transactions
  SET status = 'spent',
      balance_after = v_learner_credits_after,
      description = format('Credits spent for completed session %s', p_session_id),
      updated_at = NOW()
  WHERE id = v_reserved_transaction.id
  RETURNING id INTO v_spent_transaction_id;
  
  -- Create 'earned' transaction for teacher
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    status,
    description
  ) VALUES (
    v_session_record.teacher_id,
    'earned',
    v_credits_amount, -- Positive amount
    v_teacher_credits_after,
    p_session_id,
    'earned', -- ENUM status
    format('Credits earned from completed session %s', p_session_id)
  ) RETURNING id INTO v_earned_transaction_id;
  
  -- UPDATE PROFILES BALANCE: Only after verifying session is completed
  -- Update learner's credits (subtract)
  UPDATE profiles
  SET credits = v_learner_credits_after,
      updated_at = NOW()
  WHERE user_id = v_session_record.learner_id;
  
  -- Update teacher's credits (add)
  UPDATE profiles
  SET credits = v_teacher_credits_after,
      updated_at = NOW()
  WHERE user_id = v_session_record.teacher_id;
  
  -- Update session to mark credits as finalized
  UPDATE skill_sessions
  SET credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Build result
  v_result := json_build_object(
    'success', true,
    'session_id', p_session_id,
    'spent_transaction_id', v_spent_transaction_id,
    'earned_transaction_id', v_earned_transaction_id,
    'learner_credits_before', v_learner_credits_before,
    'learner_credits_after', v_learner_credits_after,
    'teacher_credits_before', v_teacher_credits_before,
    'teacher_credits_after', v_teacher_credits_after,
    'credits_amount', v_credits_amount
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- ============================================
-- Step 8: Update cancel_expired_pending_swaps to use ENUM
-- ============================================
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
  -- Find all reserved transactions that have expired
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
    WHERE ct.status = 'reserved' -- Use ENUM value
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at < NOW()
      AND ss.status = 'requested' -- Only cancel if session hasn't been accepted
    FOR UPDATE OF ct -- Lock rows for atomicity
  LOOP
    -- Cancel the transaction directly
    BEGIN
      -- Update transaction to cancelled status (ENUM)
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
-- Step 9: Update execute_skill_swap to use ENUM status
-- ============================================
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
  v_learner_credits INTEGER;
  v_pending_transaction_id UUID;
  v_existing_pending_id UUID;
BEGIN
  -- IDEMPOTENCY: Check if reserved transaction already exists
  SELECT id INTO v_existing_pending_id
  FROM credit_transactions
  WHERE session_id = p_session_id
    AND status = 'reserved' -- Use ENUM value
    AND user_id = p_learner_id
  LIMIT 1;
  
  IF v_existing_pending_id IS NOT NULL THEN
    RETURN v_existing_pending_id;
  END IF;
  
  -- VALIDATION: Verify session exists
  SELECT id, learner_id, teacher_id, status, credits_amount
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  IF v_session_record.learner_id != p_learner_id THEN
    RAISE EXCEPTION 'Learner ID mismatch. Expected: %, Got: %', 
      v_session_record.learner_id, p_learner_id;
  END IF;
  
  IF v_session_record.teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'Teacher ID mismatch. Expected: %, Got: %', 
      v_session_record.teacher_id, p_teacher_id;
  END IF;
  
  IF v_session_record.status NOT IN ('requested', 'accepted', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot create swap for session with status: %', v_session_record.status;
  END IF;
  
  IF v_session_record.credits_amount IS NOT NULL THEN
    p_credits_amount := v_session_record.credits_amount;
  END IF;
  
  IF p_credits_amount <= 0 THEN
    RAISE EXCEPTION 'Credits amount must be positive, got: %', p_credits_amount;
  END IF;
  
  -- Check learner's credits from profiles table
  SELECT credits INTO v_learner_credits
  FROM profiles
  WHERE user_id = p_learner_id
  FOR UPDATE;
  
  IF v_learner_credits < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', 
      v_learner_credits, p_credits_amount;
  END IF;
  
  -- CREATE RESERVED TRANSACTION WITH ENUM STATUS
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    status, -- ENUM type
    expires_at,
    description
  ) VALUES (
    p_learner_id,
    'locked', -- Transaction type
    -p_credits_amount,
    v_learner_credits - p_credits_amount,
    p_session_id,
    'reserved', -- ENUM status value
    NOW() + INTERVAL '24 hours',
    format('Credits reserved for session %s', p_session_id)
  ) RETURNING id INTO v_pending_transaction_id;
  
  -- Update session to track that credits are reserved
  UPDATE skill_sessions
  SET credits_locked = TRUE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN v_pending_transaction_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ============================================
-- Step 10: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION get_profile_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_skill_swap(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_expired_pending_swaps() TO authenticated;
GRANT EXECUTE ON FUNCTION execute_skill_swap(UUID, UUID, UUID, INTEGER) TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TYPE transaction_status IS 
'ENUM type for credit transaction status: reserved, spent, earned, cancelled';

COMMENT ON COLUMN credit_transactions.status IS 
'Transaction status using ENUM type: reserved (pending), spent (learner paid), earned (teacher received), cancelled (voided)';

COMMENT ON COLUMN profiles.credits IS 
'Current credit balance for the user. Updated by complete_skill_swap after session completion.';

COMMENT ON FUNCTION complete_skill_swap IS 
'Finalizes a skill swap by:
1. Verifying session_status is ''completed''
2. Converting reserved transaction to spent/earned
3. Updating profiles.credits balance for both learner and teacher
Only executes if session is marked as completed. All operations are atomic.';
