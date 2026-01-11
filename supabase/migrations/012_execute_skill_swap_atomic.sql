-- ============================================
-- Execute Skill Swap Function (Atomic)
-- ============================================
-- Creates a skill swap transaction atomically:
-- 1. Checks if learner's available_balance (total credits - reserved credits) >= 1
-- 2. Inserts a row into credit_transactions with status = 'reserved'
-- 3. Links this transaction to a session_id
-- 4. All wrapped in a BEGIN...COMMIT block (implicit in PL/pgSQL functions)
--
-- Note: This function creates the transaction. The session should be created separately
-- or passed as a parameter. For atomic session+transaction creation, see alternative below.

-- ============================================
-- Step 1: Update status to include 'reserved'
-- ============================================
-- Add 'reserved' as a valid status value
ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_status_check;

ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_status_check 
CHECK (status IN ('pending', 'reserved', 'completed', 'cancelled'));

-- ============================================
-- Step 2: Helper function to get total credits (raw balance)
-- ============================================
-- Total Credits: The raw balance (sum of ALL transactions)
CREATE OR REPLACE FUNCTION get_total_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Total Credits: Sum of ALL transactions (raw balance)
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM credit_transactions
  WHERE user_id = p_user_id;
  
  RETURN v_total;
END;
$$;

-- ============================================
-- Step 2b: Helper function to get reserved credits
-- ============================================
-- Returns sum of reserved/pending credits
CREATE OR REPLACE FUNCTION get_reserved_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reserved INTEGER;
BEGIN
  -- Calculate reserved credits (sum of reserved/pending transactions)
  -- Use ABS() since reserved transactions have negative amounts
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_reserved
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND status IN ('reserved', 'pending');
  
  RETURN v_reserved;
END;
$$;

-- ============================================
-- Step 2c: Helper function to get available balance
-- ============================================
-- Available to Spend: Total Credits - Reserved Credits
CREATE OR REPLACE FUNCTION get_available_credit_balance_v2(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_credits INTEGER;
  v_reserved_credits INTEGER;
  v_available_balance INTEGER;
BEGIN
  -- Total Credits: The raw balance (sum of ALL transactions)
  v_total_credits := get_total_credits(p_user_id);
  
  -- Reserved Credits: Sum of reserved/pending transactions
  v_reserved_credits := get_reserved_credits(p_user_id);
  
  -- Available to Spend: Total - Reserved
  v_available_balance := v_total_credits - v_reserved_credits;
  
  RETURN v_available_balance;
END;
$$;

-- ============================================
-- Step 3: Execute Skill Swap Function (Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION execute_skill_swap(
  p_session_id UUID,
  p_learner_id UUID,
  p_credits_amount INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_balance INTEGER;
  v_transaction_id UUID;
  v_session_record RECORD;
  v_existing_transaction_id UUID;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- IDEMPOTENCY: Check if reserved transaction already exists for this session
  SELECT id INTO v_existing_transaction_id
  FROM credit_transactions
  WHERE session_id = p_session_id
    AND status = 'reserved'
    AND user_id = p_learner_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF v_existing_transaction_id IS NOT NULL THEN
    -- Idempotent: return existing transaction ID
    RETURN v_existing_transaction_id;
  END IF;
  
  -- VALIDATION: Verify session exists and is valid
  SELECT id, learner_id, teacher_id, status, credits_amount
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Lock row for atomicity
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  -- Validate session participant
  IF v_session_record.learner_id != p_learner_id THEN
    RAISE EXCEPTION 'Learner ID mismatch. Expected: %, Got: %', 
      v_session_record.learner_id, p_learner_id;
  END IF;
  
  -- Use session's credits_amount if provided, otherwise use parameter
  IF v_session_record.credits_amount IS NOT NULL THEN
    p_credits_amount := v_session_record.credits_amount;
  END IF;
  
  IF p_credits_amount < 1 THEN
    RAISE EXCEPTION 'Credits amount must be >= 1, got: %', p_credits_amount;
  END IF;
  
  -- CHECK: Verify learner's available_balance >= credits_amount
  -- Available balance = total credits - reserved credits
  v_available_balance := get_available_credit_balance_v2(p_learner_id);
  
  IF v_available_balance < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available balance: %, Required: %', 
      v_available_balance, p_credits_amount;
  END IF;
  
  -- INSERT: Create transaction with status = 'reserved'
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
    'locked', -- Transaction type (negative amount indicates deduction)
    -p_credits_amount, -- Negative amount (will be deducted when finalized)
    v_available_balance - p_credits_amount, -- Projected balance after reservation
    p_session_id, -- Link to session
    'reserved', -- Status = 'reserved'
    format('Credits reserved for session %s', p_session_id)
  ) RETURNING id INTO v_transaction_id;
  
  -- Update session to mark credits as reserved
  UPDATE skill_sessions
  SET credits_locked = TRUE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  -- COMMIT (implicit - function completes successfully)
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- ============================================
-- Alternative: Create Session + Transaction Atomically
-- ============================================
-- If you need to create both session and transaction in one atomic operation:
CREATE OR REPLACE FUNCTION execute_skill_swap_with_session(
  p_learner_id UUID,
  p_teacher_id UUID,
  p_skill_id UUID,
  p_credits_amount INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_balance INTEGER;
  v_transaction_id UUID;
  v_session_id UUID;
  v_skill_record RECORD;
  v_result JSON;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- Validate skill exists
  SELECT id, user_id, credits_required, status
  INTO v_skill_record
  FROM skills
  WHERE id = p_skill_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found: %', p_skill_id;
  END IF;
  
  IF v_skill_record.user_id != p_teacher_id THEN
    RAISE EXCEPTION 'Skill does not belong to specified teacher';
  END IF;
  
  IF v_skill_record.status != 'active' THEN
    RAISE EXCEPTION 'Skill is not active';
  END IF;
  
  IF p_learner_id = p_teacher_id THEN
    RAISE EXCEPTION 'Cannot create session with yourself';
  END IF;
  
  -- Use skill's credits_required if not specified
  IF p_credits_amount IS NULL OR p_credits_amount < 1 THEN
    p_credits_amount := v_skill_record.credits_required;
  END IF;
  
  -- CHECK: Verify learner's available_balance >= credits_amount
  v_available_balance := get_available_credit_balance_v2(p_learner_id);
  
  IF v_available_balance < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available balance: %, Required: %', 
      v_available_balance, p_credits_amount;
  END IF;
  
  -- CREATE SESSION
  INSERT INTO skill_sessions (
    learner_id,
    teacher_id,
    skill_id,
    status,
    credits_amount,
    credits_locked
  ) VALUES (
    p_learner_id,
    p_teacher_id,
    p_skill_id,
    'requested',
    p_credits_amount,
    TRUE -- Credits will be reserved
  ) RETURNING id INTO v_session_id;
  
  -- INSERT: Create transaction with status = 'reserved'
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
    'locked',
    -p_credits_amount,
    v_available_balance - p_credits_amount,
    v_session_id, -- Link to newly created session
    'reserved',
    format('Credits reserved for session %s', v_session_id)
  ) RETURNING id INTO v_transaction_id;
  
  -- Build result
  v_result := json_build_object(
    'success', true,
    'session_id', v_session_id,
    'transaction_id', v_transaction_id,
    'available_balance_before', v_available_balance,
    'available_balance_after', v_available_balance - p_credits_amount,
    'credits_amount', p_credits_amount
  );
  
  -- COMMIT (implicit - function completes successfully)
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- ============================================
-- Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION get_total_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reserved_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_credit_balance_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_skill_swap(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_skill_swap_with_session(UUID, UUID, UUID, INTEGER) TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON FUNCTION execute_skill_swap IS 
'Atomically creates a reserved credit transaction for a skill swap. 
Checks that available_balance (total - reserved) >= credits_amount.
Links transaction to existing session_id. All operations wrapped in atomic transaction.';

COMMENT ON FUNCTION execute_skill_swap_with_session IS 
'Atomically creates both session and reserved credit transaction.
Use this if you need to create session and transaction in one operation.';

COMMENT ON FUNCTION get_total_credits IS 
'Total Credits: The raw balance. Sum of ALL transactions regardless of status.';

COMMENT ON FUNCTION get_reserved_credits IS 
'Returns sum of reserved/pending credits. Reserved credits are those with status = ''reserved'' or ''pending''.';

COMMENT ON FUNCTION get_available_credit_balance_v2 IS 
'Available to Spend: Total Credits - Reserved Credits.
Total Credits = raw balance (sum of all transactions).
Reserved Credits = sum of transactions with status ''reserved'' or ''pending''.';
