-- RPC function to handle skill exchange between learner and teacher
-- Subtracts 1 credit from learner and adds 1 credit to teacher
-- Uses a transaction to ensure atomicity (both succeed or both fail)

CREATE OR REPLACE FUNCTION handle_skill_exchange(
  learner_id UUID,
  teacher_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  learner_credits INTEGER;
  teacher_credits INTEGER;
  result JSON;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Check if learner has sufficient credits
  SELECT credits INTO learner_credits
  FROM profiles
  WHERE user_id = learner_id
  FOR UPDATE; -- Lock row for update
  
  IF learner_credits IS NULL THEN
    RAISE EXCEPTION 'Learner profile not found';
  END IF;
  
  IF learner_credits < 1 THEN
    RAISE EXCEPTION 'Insufficient credits. Learner has % credits, but needs 1', learner_credits;
  END IF;
  
  -- Get teacher's current credits (with lock)
  SELECT credits INTO teacher_credits
  FROM profiles
  WHERE user_id = teacher_id
  FOR UPDATE; -- Lock row for update
  
  IF teacher_credits IS NULL THEN
    RAISE EXCEPTION 'Teacher profile not found';
  END IF;
  
  -- Prevent self-exchange
  IF learner_id = teacher_id THEN
    RAISE EXCEPTION 'Cannot exchange credits with yourself';
  END IF;
  
  -- Update learner credits (subtract 1)
  UPDATE profiles
  SET credits = credits - 1,
      updated_at = NOW()
  WHERE user_id = learner_id;
  
  -- Update teacher credits (add 1)
  UPDATE profiles
  SET credits = credits + 1,
      updated_at = NOW()
  WHERE user_id = teacher_id;
  
  -- Get updated values for response
  SELECT credits INTO learner_credits
  FROM profiles
  WHERE user_id = learner_id;
  
  SELECT credits INTO teacher_credits
  FROM profiles
  WHERE user_id = teacher_id;
  
  -- Return success response with updated credits
  result := json_build_object(
    'success', true,
    'learner_id', learner_id,
    'teacher_id', teacher_id,
    'learner_new_credits', learner_credits,
    'teacher_new_credits', teacher_credits,
    'message', 'Credit exchange completed successfully'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Any error will automatically rollback the transaction
    -- Return error response
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'learner_id', learner_id,
      'teacher_id', teacher_id
    );
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_skill_exchange(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION handle_skill_exchange(UUID, UUID) IS 
'Handles credit exchange between learner and teacher. Subtracts 1 credit from learner and adds 1 credit to teacher. Wrapped in a transaction for atomicity.';
