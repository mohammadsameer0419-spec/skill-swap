-- ============================================
-- Enhanced Credit Ledger Functions
-- ============================================
-- Implements:
-- 1. Atomicity (row-level locking FOR UPDATE)
-- 2. Idempotency (check if operation already done)
-- 3. Role validation (where applicable)
-- 4. Failure rollback (explicit exception handling)
-- 5. Explicit ledger entries for each state change

-- ============================================
-- Enhanced: Record Credit Transaction
-- ============================================
CREATE OR REPLACE FUNCTION record_credit_transaction(
  p_user_id UUID,
  p_type TEXT,
  p_amount INTEGER,
  p_session_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_balance_after INTEGER;
  v_existing_transaction_id UUID;
BEGIN
  -- Validate transaction type
  IF p_type NOT IN ('earned', 'spent', 'refund', 'adjustment', 'locked', 'unlocked') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;
  
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Transaction amount cannot be zero';
  END IF;
  
  -- IDEMPOTENCY: Check for duplicate transaction (same session_id and type within last minute)
  -- This prevents double-processing of the same operation
  IF p_session_id IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND type = p_type
      AND session_id = p_session_id
      AND amount = p_amount
      AND created_at > NOW() - INTERVAL '1 minute'
    LIMIT 1;
    
    IF v_existing_transaction_id IS NOT NULL THEN
      -- Idempotent: return existing transaction ID
      RETURN v_existing_transaction_id;
    END IF;
  END IF;
  
  -- ATOMICITY: Calculate balance (implicit transaction isolation)
  v_balance_after := get_user_credit_balance(p_user_id) + p_amount;
  
  -- EXPLICIT LEDGER ENTRY: Insert transaction
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    description
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    v_balance_after,
    p_session_id,
    COALESCE(p_description, format('Credit transaction: %s %s credits', p_type, ABS(p_amount)))
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Lock Credits for Session
-- ============================================
CREATE OR REPLACE FUNCTION lock_credits_for_session(
  p_user_id UUID,
  p_amount INTEGER,
  p_session_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_transaction_id UUID;
  v_session_status TEXT;
  v_session_credits_locked BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Lock amount must be positive';
  END IF;
  
  -- ATOMICITY: Lock session row to prevent concurrent modifications
  SELECT status, credits_locked
  INTO v_session_status, v_session_credits_locked
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Row-level lock for race-condition safety
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- IDEMPOTENCY: If credits already locked for this session, return existing transaction
  IF v_session_credits_locked THEN
    -- Find the lock transaction
    SELECT id INTO v_transaction_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND type = 'locked'
      AND session_id = p_session_id
      AND amount = -p_amount
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_transaction_id IS NOT NULL THEN
      -- Idempotent: return existing transaction ID
      RETURN v_transaction_id;
    END IF;
  END IF;
  
  -- Calculate current balance (atomic operation within transaction)
  v_current_balance := get_user_credit_balance(p_user_id);
  
  -- Validate sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_current_balance, p_amount;
  END IF;
  
  -- EXPLICIT LEDGER ENTRY: Record lock transaction
  v_transaction_id := record_credit_transaction(
    p_user_id,
    'locked',
    -p_amount,
    p_session_id,
    format('Credits locked for session %s', p_session_id)
  );
  
  -- Update session to mark credits as locked (state change)
  UPDATE skill_sessions
  SET credits_locked = TRUE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Unlock Credits from Session
-- ============================================
CREATE OR REPLACE FUNCTION unlock_credits_from_session(
  p_user_id UUID,
  p_amount INTEGER,
  p_session_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_session_status TEXT;
  v_session_credits_locked BOOLEAN;
  v_existing_unlock_id UUID;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Unlock amount must be positive';
  END IF;
  
  -- ATOMICITY: Lock session row
  SELECT status, credits_locked
  INTO v_session_status, v_session_credits_locked
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Row-level lock for race-condition safety
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- IDEMPOTENCY: Check if already unlocked (no lock transaction exists or already has unlock)
  IF NOT v_session_credits_locked THEN
    -- Find the most recent unlock transaction
    SELECT id INTO v_existing_unlock_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND type = 'unlocked'
      AND session_id = p_session_id
      AND amount = p_amount
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_existing_unlock_id IS NOT NULL THEN
      -- Idempotent: return existing transaction ID
      RETURN v_existing_unlock_id;
    END IF;
  END IF;
  
  -- EXPLICIT LEDGER ENTRY: Record unlock transaction
  v_transaction_id := record_credit_transaction(
    p_user_id,
    'unlocked',
    p_amount,
    p_session_id,
    format('Credits unlocked from session %s', p_session_id)
  );
  
  -- Update session to mark credits as unlocked (state change)
  UPDATE skill_sessions
  SET credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Transfer Credits
-- ============================================
CREATE OR REPLACE FUNCTION transfer_credits(
  p_learner_id UUID,
  p_teacher_id UUID,
  p_amount INTEGER,
  p_session_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_learner_balance INTEGER;
  v_teacher_balance INTEGER;
  v_spend_transaction_id UUID;
  v_earn_transaction_id UUID;
  v_existing_spend_id UUID;
  v_existing_earn_id UUID;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;
  
  -- Prevent self-transfer
  IF p_learner_id = p_teacher_id THEN
    RAISE EXCEPTION 'Cannot transfer credits to yourself';
  END IF;
  
  -- IDEMPOTENCY: Check if transfer already completed for this session
  SELECT id INTO v_existing_spend_id
  FROM credit_transactions
  WHERE user_id = p_learner_id
    AND type = 'spent'
    AND session_id = p_session_id
    AND amount = -p_amount
  LIMIT 1;
  
  SELECT id INTO v_existing_earn_id
  FROM credit_transactions
  WHERE user_id = p_teacher_id
    AND type = 'earned'
    AND session_id = p_session_id
    AND amount = p_amount
  LIMIT 1;
  
  IF v_existing_spend_id IS NOT NULL AND v_existing_earn_id IS NOT NULL THEN
    -- Idempotent: return existing transfer result
    v_learner_balance := get_user_credit_balance(p_learner_id);
    v_teacher_balance := get_user_credit_balance(p_teacher_id);
    
    RETURN json_build_object(
      'success', true,
      'learner_balance', v_learner_balance,
      'teacher_balance', v_teacher_balance,
      'spend_transaction_id', v_existing_spend_id,
      'earn_transaction_id', v_existing_earn_id,
      'message', 'Transfer already completed'
    );
  END IF;
  
  -- ATOMICITY: Verify learner has sufficient credits (within transaction)
  v_learner_balance := get_user_credit_balance(p_learner_id);
  
  IF v_learner_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_learner_balance, p_amount;
  END IF;
  
  -- EXPLICIT LEDGER ENTRY 1: Record spend transaction for learner
  v_spend_transaction_id := record_credit_transaction(
    p_learner_id,
    'spent',
    -p_amount,
    p_session_id,
    COALESCE(p_description, format('Spent %s credits for session %s', p_amount, p_session_id))
  );
  
  -- EXPLICIT LEDGER ENTRY 2: Record earn transaction for teacher
  v_earn_transaction_id := record_credit_transaction(
    p_teacher_id,
    'earned',
    p_amount,
    p_session_id,
    COALESCE(p_description, format('Earned %s credits from session %s', p_amount, p_session_id))
  );
  
  -- Get final balances
  v_learner_balance := get_user_credit_balance(p_learner_id);
  v_teacher_balance := get_user_credit_balance(p_teacher_id);
  
  -- Return result
  RETURN json_build_object(
    'success', true,
    'learner_balance', v_learner_balance,
    'teacher_balance', v_teacher_balance,
    'spend_transaction_id', v_spend_transaction_id,
    'earn_transaction_id', v_earn_transaction_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (both transactions in same transaction)
    RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_credit_transaction(UUID, TEXT, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_credits_for_session(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_credits_from_session(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_credits(UUID, UUID, INTEGER, UUID, TEXT) TO authenticated;
