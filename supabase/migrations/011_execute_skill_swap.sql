-- ============================================
-- Execute Skill Swap Function
-- ============================================
-- Implements credit ledger system for skill swaps:
-- 1. Creates a 'Pending' transaction record
-- 2. Verifies the learner has enough credits
-- 3. Updates the profile balance ONLY after the session is marked as 'Complete' by both parties
--
-- Transaction Flow:
-- - Pending: Created when swap is initiated, credits are reserved but not deducted
-- - Spent: Learner's credits are deducted when session completes
-- - Earned: Teacher's credits are added when session completes

-- ============================================
-- Step 1: Add 'pending' to transaction types
-- ============================================
-- Update the CHECK constraint to include 'pending' type
ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN (
  'pending',    -- Pending transaction (reserved but not applied)
  'earned',     -- Earned from teaching
  'spent',      -- Spent on learning
  'refund',     -- Refund from cancellation
  'adjustment', -- Admin adjustment
  'locked',     -- Locked for session
  'unlocked'    -- Unlocked from session
));

-- ============================================
-- Step 2: Add status tracking to credit_transactions
-- ============================================
-- Add status column to track pending -> completed transitions
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' 
CHECK (status IN ('pending', 'completed', 'cancelled'));

-- Add updated_at column if it doesn't exist (for tracking transaction updates)
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for pending transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status 
ON credit_transactions(status) 
WHERE status = 'pending';

-- ============================================
-- Step 3: Helper function to get available balance
-- ============================================
-- Returns balance excluding pending transactions
CREATE OR REPLACE FUNCTION get_available_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Sum all transactions except pending ones
  -- Pending transactions don't affect available balance
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND status != 'pending';
  
  RETURN v_balance;
END;
$$;

-- ============================================
-- Step 4: Execute Skill Swap Function
-- ============================================
-- Creates a pending transaction and verifies learner has enough credits
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
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    status,
    description
  ) VALUES (
    p_learner_id,
    'pending',
    -p_credits_amount, -- Negative amount (will be deducted when completed)
    v_learner_balance - p_credits_amount, -- Projected balance after completion
    p_session_id,
    'pending',
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
-- Step 5: Complete Skill Swap Function
-- ============================================
-- Converts pending transaction to spent/earned when session completes
-- Only executes if session is marked as 'Complete' by both parties
CREATE OR REPLACE FUNCTION complete_skill_swap(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_pending_transaction RECORD;
  v_learner_balance INTEGER;
  v_teacher_balance INTEGER;
  v_spent_transaction_id UUID;
  v_earned_transaction_id UUID;
  v_credits_amount INTEGER;
  v_result JSON;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- VALIDATION: Verify session exists and is completed
  SELECT id, learner_id, teacher_id, status, credits_amount
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  -- CRITICAL: Only proceed if session is marked as 'completed'
  IF v_session_record.status != 'completed' THEN
    RAISE EXCEPTION 'Session must be marked as completed before finalizing swap. Current status: %', 
      v_session_record.status;
  END IF;
  
  -- Find pending transaction for this session
  SELECT id, user_id, amount
  INTO v_pending_transaction
  FROM credit_transactions
  WHERE session_id = p_session_id
    AND type = 'pending'
    AND status = 'pending'
    AND user_id = v_session_record.learner_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending transaction found for session: %', p_session_id;
  END IF;
  
  -- Get current balances (excluding pending transactions)
  v_learner_balance := get_available_credit_balance(v_session_record.learner_id);
  v_teacher_balance := get_available_credit_balance(v_session_record.teacher_id);
  
  -- Calculate credits amount (absolute value of pending transaction)
  v_credits_amount := ABS(v_pending_transaction.amount);
  
  -- Convert pending transaction to 'spent' for learner
  UPDATE credit_transactions
  SET type = 'spent',
      status = 'completed',
      balance_after = v_learner_balance - v_credits_amount,
      description = format('Credits spent for completed session %s', p_session_id),
      updated_at = NOW()
  WHERE id = v_pending_transaction.id
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
    v_teacher_balance + v_credits_amount,
    p_session_id,
    'completed',
    format('Credits earned from completed session %s', p_session_id)
  ) RETURNING id INTO v_earned_transaction_id;
  
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
    'learner_balance_after', v_learner_balance - v_credits_amount,
    'teacher_balance_after', v_teacher_balance + v_credits_amount,
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
-- Step 6: Cancel Pending Swap Function
-- ============================================
-- Cancels a pending transaction if session is cancelled
CREATE OR REPLACE FUNCTION cancel_pending_swap(
  p_session_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_transaction_id UUID;
BEGIN
  -- Find and cancel pending transaction
  UPDATE credit_transactions
  SET status = 'cancelled',
      description = COALESCE(description, '') || ' - Cancelled',
      updated_at = NOW()
  WHERE session_id = p_session_id
    AND type = 'pending'
    AND status = 'pending'
  RETURNING id INTO v_pending_transaction_id;
  
  IF v_pending_transaction_id IS NULL THEN
    RAISE EXCEPTION 'No pending transaction found to cancel for session: %', p_session_id;
  END IF;
  
  -- Update session to unlock credits
  UPDATE skill_sessions
  SET credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN v_pending_transaction_id;
END;
$$;

-- ============================================
-- Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION get_available_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_skill_swap(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_skill_swap(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_pending_swap(UUID) TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON FUNCTION execute_skill_swap IS 
'Creates a pending transaction for a skill swap. Verifies learner has enough credits. 
Credits are reserved but not deducted until session is completed.';

COMMENT ON FUNCTION complete_skill_swap IS 
'Finalizes a skill swap by converting pending transaction to spent/earned. 
Only executes if session status is "completed". Updates balances for both parties.';

COMMENT ON FUNCTION cancel_pending_swap IS 
'Cancels a pending swap transaction if the session is cancelled. 
Unlocks the reserved credits.';

COMMENT ON COLUMN credit_transactions.status IS 
'Transaction status: pending (reserved), completed (finalized), cancelled (voided)';
