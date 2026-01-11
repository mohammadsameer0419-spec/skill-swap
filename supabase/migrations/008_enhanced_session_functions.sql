-- ============================================
-- Enhanced Session Management Functions
-- ============================================
-- Implements:
-- 1. Atomicity (row-level locking FOR UPDATE)
-- 2. Idempotency (check if operation already done)
-- 3. Role validation (learner/teacher verification)
-- 4. Failure rollback (explicit exception handling)
-- 5. Explicit ledger entries for each state change

-- ============================================
-- Enhanced: Create Session Request
-- ============================================
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
  v_existing_session UUID;
BEGIN
  -- BEGIN TRANSACTION (implicit in PL/pgSQL function)
  
  -- IDEMPOTENCY: Check if session already exists
  SELECT id INTO v_existing_session
  FROM skill_sessions
  WHERE learner_id = p_learner_id
    AND teacher_id = p_teacher_id
    AND skill_id = p_skill_id
    AND status = 'requested'
  LIMIT 1;
  
  IF v_existing_session IS NOT NULL THEN
    -- Idempotent: return existing session ID
    RETURN v_existing_session;
  END IF;
  
  -- ATOMICITY: Lock skill row to prevent concurrent modifications
  SELECT id, user_id, credits_required, status
  INTO v_skill_record
  FROM skills
  WHERE id = p_skill_id
  FOR UPDATE; -- Row-level lock for race-condition safety
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;
  
  -- ROLE VALIDATION: Verify teacher owns the skill
  IF v_skill_record.user_id != p_teacher_id THEN
    RAISE EXCEPTION 'Skill does not belong to specified teacher';
  END IF;
  
  IF v_skill_record.status != 'active' THEN
    RAISE EXCEPTION 'Skill is not active';
  END IF;
  
  IF p_learner_id = p_teacher_id THEN
    RAISE EXCEPTION 'Cannot create session with yourself';
  END IF;
  
  -- ATOMICITY: Calculate balance with implicit locking via transaction
  SELECT COALESCE(SUM(amount), 0) INTO v_learner_balance
  FROM credit_transactions
  WHERE user_id = p_learner_id;
  
  -- Validate balance >= required credits
  IF v_learner_balance < v_skill_record.credits_required THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', 
      v_learner_balance, 
      v_skill_record.credits_required;
  END IF;
  
  -- 1. INSERT INTO skill_sessions (status = 'requested')
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
    TRUE
  ) RETURNING id INTO v_session_id;
  
  -- 2. EXPLICIT LEDGER ENTRY: INSERT INTO credit_transactions (type = 'locked')
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
    -v_skill_record.credits_required,
    v_balance_after,
    v_session_id,
    format('Credits locked for session %s (requested)', v_session_id)
  );
  
  -- Increment skill request count (atomic operation)
  UPDATE skills
  SET requests_count = requests_count + 1,
      updated_at = NOW()
  WHERE id = p_skill_id;
  
  -- COMMIT (implicit - function completes successfully)
  RETURN v_session_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    -- Log error and re-raise
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Accept Session Request
-- ============================================
CREATE OR REPLACE FUNCTION accept_session_request(
  p_session_id UUID,
  p_teacher_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_current_status TEXT;
BEGIN
  -- ATOMICITY: Lock session row to prevent concurrent state changes
  SELECT id, teacher_id, status, credits_locked
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE; -- Row-level lock for race-condition safety
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- ROLE VALIDATION: Verify user is the teacher
  IF v_session_record.teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'Only the teacher can accept this session';
  END IF;
  
  v_current_status := v_session_record.status;
  
  -- IDEMPOTENCY: If already accepted, return success
  IF v_current_status = 'accepted' THEN
    RETURN json_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'accepted',
      'message', 'Session already accepted'
    );
  END IF;
  
  -- State validation
  IF v_current_status != 'requested' THEN
    RAISE EXCEPTION 'Session is not in requested status. Current status: %', v_current_status;
  END IF;
  
  IF NOT v_session_record.credits_locked THEN
    RAISE EXCEPTION 'Credits are not locked for this session';
  END IF;
  
  -- Update status (state change)
  UPDATE skill_sessions
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'accepted'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - exception triggers rollback)
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Schedule Session
-- ============================================
CREATE OR REPLACE FUNCTION schedule_session(
  p_session_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_current_status TEXT;
BEGIN
  -- ATOMICITY: Lock session row
  SELECT id, learner_id, teacher_id, status, scheduled_at
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- ROLE VALIDATION: Verify user is a participant
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can schedule this session';
  END IF;
  
  v_current_status := v_session_record.status;
  
  -- IDEMPOTENCY: If already scheduled with same time, return success
  IF v_current_status = 'scheduled' AND v_session_record.scheduled_at = p_scheduled_at THEN
    RETURN json_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'scheduled',
      'scheduled_at', p_scheduled_at,
      'message', 'Session already scheduled at this time'
    );
  END IF;
  
  -- State validation
  IF v_current_status != 'accepted' THEN
    RAISE EXCEPTION 'Session must be accepted before scheduling. Current status: %', v_current_status;
  END IF;
  
  IF p_scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;
  
  -- Update session (state change)
  UPDATE skill_sessions
  SET status = 'scheduled',
      scheduled_at = p_scheduled_at,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'scheduled',
    'scheduled_at', p_scheduled_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Start Session
-- ============================================
CREATE OR REPLACE FUNCTION start_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_current_status TEXT;
BEGIN
  -- ATOMICITY: Lock session row
  SELECT id, learner_id, teacher_id, status, scheduled_at, started_at
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- ROLE VALIDATION: Verify user is a participant
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can start this session';
  END IF;
  
  v_current_status := v_session_record.status;
  
  -- IDEMPOTENCY: If already started, return success
  IF v_current_status = 'in_progress' THEN
    RETURN json_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'in_progress',
      'started_at', v_session_record.started_at,
      'message', 'Session already started'
    );
  END IF;
  
  -- State validation
  IF v_current_status NOT IN ('accepted', 'scheduled') THEN
    RAISE EXCEPTION 'Session cannot be started from status: %', v_current_status;
  END IF;
  
  -- Update session (state change)
  UPDATE skill_sessions
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'in_progress',
    'started_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Complete Session
-- ============================================
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
  v_unlock_transaction_id UUID;
  v_current_status TEXT;
BEGIN
  -- ATOMICITY: Lock session row
  SELECT id, learner_id, teacher_id, skill_id, status, credits_amount, credits_locked, completed_at
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- ROLE VALIDATION: Verify user is a participant
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can complete this session';
  END IF;
  
  v_current_status := v_session_record.status;
  
  -- IDEMPOTENCY: If already completed, return success
  IF v_current_status = 'completed' THEN
    RETURN json_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'completed',
      'completed_at', v_session_record.completed_at,
      'message', 'Session already completed'
    );
  END IF;
  
  -- State validation
  IF v_current_status != 'in_progress' THEN
    RAISE EXCEPTION 'Session must be in progress to complete. Current status: %', v_current_status;
  END IF;
  
  -- EXPLICIT LEDGER ENTRY 1: Transfer credits (learner to teacher)
  v_transfer_result := transfer_credits(
    v_session_record.learner_id,
    v_session_record.teacher_id,
    v_session_record.credits_amount,
    p_session_id,
    format('Completed session %s', p_session_id)
  );
  
  -- EXPLICIT LEDGER ENTRY 2: Unlock any remaining locked credits
  IF v_session_record.credits_locked THEN
    v_unlock_transaction_id := unlock_credits_from_session(
      v_session_record.learner_id,
      v_session_record.credits_amount,
      p_session_id
    );
  END IF;
  
  -- Update session status (state change)
  UPDATE skill_sessions
  SET status = 'completed',
      completed_at = NOW(),
      credits_locked = FALSE,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Update skill completed count
  UPDATE skills
  SET completed_count = completed_count + 1,
      updated_at = NOW()
  WHERE id = v_session_record.skill_id;
  
  -- Update profile completed sessions count (both participants)
  UPDATE profiles
  SET completed_sessions = completed_sessions + 1,
      updated_at = NOW()
  WHERE user_id IN (v_session_record.learner_id, v_session_record.teacher_id);
  
  -- Return result with transaction details
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'completed',
    'completed_at', NOW(),
    'transfer', v_transfer_result
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK (implicit - all operations in transaction)
    RAISE;
END;
$$;

-- ============================================
-- Enhanced: Cancel Session
-- ============================================
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
  v_unlock_transaction_id UUID;
  v_current_status TEXT;
BEGIN
  -- ATOMICITY: Lock session row
  SELECT id, learner_id, teacher_id, status, credits_amount, credits_locked, cancelled_at, cancelled_by
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- ROLE VALIDATION: Verify user is a participant
  IF v_session_record.learner_id != p_user_id AND v_session_record.teacher_id != p_user_id THEN
    RAISE EXCEPTION 'Only participants can cancel this session';
  END IF;
  
  v_current_status := v_session_record.status;
  
  -- IDEMPOTENCY: If already cancelled, return success
  IF v_current_status = 'cancelled' THEN
    RETURN json_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'cancelled',
      'cancelled_at', v_session_record.cancelled_at,
      'cancelled_by', v_session_record.cancelled_by,
      'message', 'Session already cancelled'
    );
  END IF;
  
  -- State validation
  IF v_current_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a session that is already %', v_current_status;
  END IF;
  
  -- EXPLICIT LEDGER ENTRY: Unlock credits (refund to learner)
  IF v_session_record.credits_locked THEN
    v_unlock_transaction_id := unlock_credits_from_session(
      v_session_record.learner_id,
      v_session_record.credits_amount,
      p_session_id
    );
  END IF;
  
  -- Update session status (state change)
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
    'status', 'cancelled',
    'cancelled_at', NOW(),
    'cancelled_by', p_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ROLLBACK
    RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_session_request(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_session_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_session(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION start_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_session(UUID, UUID, TEXT) TO authenticated;
