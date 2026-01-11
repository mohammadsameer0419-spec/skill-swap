-- ============================================
-- Session Management Functions
-- ============================================
-- Full lifecycle management for skill sessions
-- 
-- NOTE: These functions have been enhanced in 008_enhanced_session_functions.sql
-- with atomicity, idempotency, role validation, failure rollback, and explicit ledger entries.
-- This file is kept for reference. Use 008_enhanced_session_functions.sql for production.

-- Create a session request
-- Transaction pattern:
-- 1. Validate learner balance >= required_credits
-- 2. INSERT INTO skill_sessions (status = 'requested')
-- 3. INSERT INTO credit_transactions (type = 'locked')
CREATE OR REPLACE FUNCTION create_session_request(
  p_learner_id UUID,
  p_teacher_id UUID,
  p_skill_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_skill_record RECORD;
  v_learner_balance INTEGER;
  v_session_id UUID;
  v_balance_after INTEGER;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- 1. Validate learner balance >= required_credits
  -- Get skill details first
  SELECT id, user_id, credits_required, status
  INTO v_skill_record
  FROM skills
  WHERE id = p_skill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
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
  
  -- Calculate current balance
  SELECT COALESCE(SUM(amount), 0) INTO v_learner_balance
  FROM credit_transactions
  WHERE user_id = p_learner_id;
  
  -- Validate balance >= required credits
  IF v_learner_balance < v_skill_record.credits_required THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', 
      v_learner_balance, 
      v_skill_record.credits_required;
  END IF;
  
  -- 2. INSERT INTO skill_sessions (status = 'requested')
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
    v_skill_record.credits_required,
    TRUE  -- Mark as locked since we're locking credits
  ) RETURNING id INTO v_session_id;
  
  -- 3. INSERT INTO credit_transactions (type = 'locked')
  -- Calculate balance after this transaction
  v_balance_after := v_learner_balance - v_skill_record.credits_required;
  
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    session_id,
    description
  ) VALUES (
    p_learner_id,
    'locked',
    -v_skill_record.credits_required,  -- Negative amount for lock
    v_balance_after,
    v_session_id,
    format('Credits locked for session %s', v_session_id)
  );
  
  -- Increment skill request count
  UPDATE skills
  SET requests_count = requests_count + 1
  WHERE id = p_skill_id;
  
  -- COMMIT (implicit - function completes successfully)
  RETURN v_session_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- Accept a session request
CREATE OR REPLACE FUNCTION accept_session_request(
  p_session_id UUID,
  p_teacher_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
BEGIN
  -- Get session
  SELECT id, teacher_id, status, credits_locked
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF v_session_record.teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'Only the teacher can accept this session';
  END IF;
  
  IF v_session_record.status != 'requested' THEN
    RAISE EXCEPTION 'Session is not in requested status. Current status: %', v_session_record.status;
  END IF;
  
  IF NOT v_session_record.credits_locked THEN
    RAISE EXCEPTION 'Credits are not locked for this session';
  END IF;
  
  -- Update status
  UPDATE skill_sessions
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN TRUE;
END;
$$;

-- Schedule a session
CREATE OR REPLACE FUNCTION schedule_session(
  p_session_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
BEGIN
  -- Get session
  SELECT id, learner_id, teacher_id, status
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can schedule this session';
  END IF;
  
  IF v_session_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Session must be accepted before scheduling';
  END IF;
  
  IF p_scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;
  
  -- Update session
  UPDATE skill_sessions
  SET status = 'scheduled',
      scheduled_at = p_scheduled_at,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN TRUE;
END;
$$;

-- Start a session
CREATE OR REPLACE FUNCTION start_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
BEGIN
  -- Get session
  SELECT id, learner_id, teacher_id, status, scheduled_at
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can start this session';
  END IF;
  
  IF v_session_record.status NOT IN ('accepted', 'scheduled') THEN
    RAISE EXCEPTION 'Session cannot be started from status: %', v_session_record.status;
  END IF;
  
  -- Update session
  UPDATE skill_sessions
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN TRUE;
END;
$$;

-- Complete a session
CREATE OR REPLACE FUNCTION complete_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_transfer_result JSON;
BEGIN
  -- Get session
  SELECT id, learner_id, teacher_id, skill_id, status, credits_amount, credits_locked
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can complete this session';
  END IF;
  
  IF v_session_record.status != 'in_progress' THEN
    RAISE EXCEPTION 'Session must be in progress to complete. Current status: %', v_session_record.status;
  END IF;
  
  -- Transfer credits (learner to teacher)
  v_transfer_result := transfer_credits(
    v_session_record.learner_id,
    v_session_record.teacher_id,
    v_session_record.credits_amount,
    p_session_id,
    format('Completed session %s', p_session_id)
  );
  
  -- Unlock any remaining locked credits (if any)
  IF v_session_record.credits_locked THEN
    PERFORM unlock_credits_from_session(
      v_session_record.learner_id,
      v_session_record.credits_amount,
      p_session_id
    );
  END IF;
  
  -- Update session status
  UPDATE skill_sessions
  SET status = 'completed',
      completed_at = NOW(),
      credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Update skill completed count
  UPDATE skills
  SET completed_count = completed_count + 1
  WHERE id = v_session_record.skill_id;
  
  -- Update profile completed sessions count
  UPDATE profiles
  SET completed_sessions = completed_sessions + 1
  WHERE user_id IN (v_session_record.learner_id, v_session_record.teacher_id);
  
  RETURN v_transfer_result;
END;
$$;

-- Cancel a session
CREATE OR REPLACE FUNCTION cancel_session(
  p_session_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_refund_transaction_id UUID;
BEGIN
  -- Get session
  SELECT id, learner_id, teacher_id, status, credits_amount, credits_locked
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can cancel this session';
  END IF;
  
  IF v_session_record.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a session that is already %', v_session_record.status;
  END IF;
  
  -- Unlock credits if they were locked
  IF v_session_record.credits_locked THEN
    PERFORM unlock_credits_from_session(
      v_session_record.learner_id,
      v_session_record.credits_amount,
      p_session_id
    );
  END IF;
  
  -- Update session status
  UPDATE skill_sessions
  SET status = 'cancelled',
      cancelled_by = p_user_id,
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'cancelled'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_session_request(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_session_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_session(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION start_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_session(UUID, UUID, TEXT) TO authenticated;
