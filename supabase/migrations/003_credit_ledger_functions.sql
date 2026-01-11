-- ============================================
-- Credit Ledger System Functions
-- ============================================
-- Transaction-based credit system with full audit trail
--
-- NOTE: These functions have been enhanced in 009_enhanced_credit_functions.sql
-- with atomicity, idempotency, role validation, failure rollback, and explicit ledger entries.
-- This file is kept for reference. Use 009_enhanced_credit_functions.sql for production.

-- Get current credit balance for a user
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_transactions
  WHERE user_id = p_user_id;
  
  RETURN v_balance;
END;
$$;

-- Record a credit transaction
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
BEGIN
  -- Calculate balance after transaction
  v_balance_after := get_user_credit_balance(p_user_id) + p_amount;
  
  -- Insert transaction
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
    p_description
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Lock credits for a session
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
BEGIN
  -- Check current balance
  v_current_balance := get_user_credit_balance(p_user_id);
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_current_balance, p_amount;
  END IF;
  
  -- Record lock transaction
  v_transaction_id := record_credit_transaction(
    p_user_id,
    'locked',
    -p_amount,
    p_session_id,
    format('Credits locked for session %s', p_session_id)
  );
  
  -- Update session to mark credits as locked
  UPDATE skill_sessions
  SET credits_locked = TRUE
  WHERE id = p_session_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Unlock credits from a session
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
BEGIN
  -- Record unlock transaction
  v_transaction_id := record_credit_transaction(
    p_user_id,
    'unlocked',
    p_amount,
    p_session_id,
    format('Credits unlocked from session %s', p_session_id)
  );
  
  -- Update session to mark credits as unlocked
  UPDATE skill_sessions
  SET credits_locked = FALSE
  WHERE id = p_session_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Transfer credits (spend from learner, earn for teacher)
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
BEGIN
  -- Verify learner has sufficient credits (check unlocked balance)
  v_learner_balance := get_user_credit_balance(p_learner_id);
  
  IF v_learner_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_learner_balance, p_amount;
  END IF;
  
  -- Prevent self-transfer
  IF p_learner_id = p_teacher_id THEN
    RAISE EXCEPTION 'Cannot transfer credits to yourself';
  END IF;
  
  -- Record spend transaction for learner
  v_spend_transaction_id := record_credit_transaction(
    p_learner_id,
    'spent',
    -p_amount,
    p_session_id,
    COALESCE(p_description, format('Spent %s credits for session', p_amount))
  );
  
  -- Record earn transaction for teacher
  v_earn_transaction_id := record_credit_transaction(
    p_teacher_id,
    'earned',
    p_amount,
    p_session_id,
    COALESCE(p_description, format('Earned %s credits from session', p_amount))
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
END;
$$;

-- Get detailed credit balance (total, available, locked)
CREATE OR REPLACE FUNCTION get_user_credit_balance_detailed(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_locked INTEGER;
  v_available INTEGER;
  v_result JSON;
BEGIN
  -- Calculate total balance (sum of all transactions)
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM credit_transactions
  WHERE user_id = p_user_id;
  
  -- Calculate locked credits (sum of credits locked for active sessions)
  -- Only count locked credits from sessions where credits_locked = TRUE
  SELECT COALESCE(SUM(ABS(ct.amount)), 0) INTO v_locked
  FROM credit_transactions ct
  INNER JOIN skill_sessions ss ON ct.session_id = ss.id
  WHERE ct.user_id = p_user_id
    AND ct.type = 'locked'
    AND ss.credits_locked = TRUE;
  
  -- Calculate available balance (total - locked)
  v_available := v_total - v_locked;
  
  -- Build result JSON
  v_result := json_build_object(
    'total', v_total,
    'available', v_available,
    'locked', v_locked
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_credit_balance_detailed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_credit_transaction(UUID, TEXT, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_credits_for_session(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_credits_from_session(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_credits(UUID, UUID, INTEGER, UUID, TEXT) TO authenticated;
