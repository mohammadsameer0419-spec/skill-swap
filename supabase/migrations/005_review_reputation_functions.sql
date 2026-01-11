-- ============================================
-- Review and Reputation System Functions
-- ============================================
-- Bi-directional reviews with weighted reputation calculation

-- Create a review
CREATE OR REPLACE FUNCTION create_review(
  p_reviewer_id UUID,
  p_reviewee_id UUID,
  p_session_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_review_role TEXT;
  v_review_id UUID;
BEGIN
  -- Validate participants are different
  IF p_reviewer_id = p_reviewee_id THEN
    RAISE EXCEPTION 'Cannot review yourself';
  END IF;
  
  -- Get session details
  SELECT id, learner_id, teacher_id, status
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Verify reviewer participated in session
  IF v_session_record.learner_id != p_reviewer_id AND v_session_record.teacher_id != p_reviewer_id THEN
    RAISE EXCEPTION 'You did not participate in this session';
  END IF;
  
  -- Verify reviewee participated in session
  IF v_session_record.learner_id != p_reviewee_id AND v_session_record.teacher_id != p_reviewee_id THEN
    RAISE EXCEPTION 'Reviewee did not participate in this session';
  END IF;
  
  -- Session must be completed
  IF v_session_record.status != 'completed' THEN
    RAISE EXCEPTION 'Can only review completed sessions';
  END IF;
  
  -- Determine reviewer role
  IF v_session_record.learner_id = p_reviewer_id THEN
    v_review_role := 'learner';
  ELSE
    v_review_role := 'teacher';
  END IF;
  
  -- Check if review already exists for this session/role
  IF EXISTS (
    SELECT 1 FROM reviews
    WHERE session_id = p_session_id
    AND reviewer_id = p_reviewer_id
    AND role = v_review_role
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this session as %', v_review_role;
  END IF;
  
  -- Create review
  INSERT INTO reviews (
    reviewer_id,
    reviewee_id,
    session_id,
    rating,
    comment,
    role
  ) VALUES (
    p_reviewer_id,
    p_reviewee_id,
    p_session_id,
    p_rating,
    p_comment,
    v_review_role
  ) RETURNING id INTO v_review_id;
  
  -- Update reviewee reputation
  PERFORM update_user_reputation(p_reviewee_id);
  
  RETURN v_review_id;
END;
$$;

-- Calculate and update user reputation
CREATE OR REPLACE FUNCTION update_user_reputation(p_user_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_weighted_sum DECIMAL;
  v_total_weight DECIMAL;
  v_reputation DECIMAL;
  v_review_count INTEGER;
BEGIN
  -- Calculate weighted average reputation
  -- Recent reviews (last 30 days) get weight 1.5
  -- Older reviews get weight 1.0
  SELECT 
    COALESCE(SUM(
      rating * CASE 
        WHEN created_at > NOW() - INTERVAL '30 days' THEN 1.5
        ELSE 1.0
      END
    ), 0),
    COALESCE(SUM(
      CASE 
        WHEN created_at > NOW() - INTERVAL '30 days' THEN 1.5
        ELSE 1.0
      END
    ), 0),
    COUNT(*)
  INTO v_weighted_sum, v_total_weight, v_review_count
  FROM reviews
  WHERE reviewee_id = p_user_id;
  
  -- Calculate reputation (0.0 to 5.0)
  IF v_total_weight > 0 THEN
    v_reputation := ROUND((v_weighted_sum / v_total_weight)::DECIMAL, 2);
  ELSE
    v_reputation := 0.0;
  END IF;
  
  -- Clamp reputation between 0 and 5
  IF v_reputation > 5.0 THEN
    v_reputation := 5.0;
  ELSIF v_reputation < 0.0 THEN
    v_reputation := 0.0;
  END IF;
  
  -- Update profile
  UPDATE profiles
  SET 
    reputation_score = v_reputation,
    total_reviews = v_review_count,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_reputation;
END;
$$;

-- Get user reputation breakdown
CREATE OR REPLACE FUNCTION get_user_reputation_breakdown(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'reputation_score', COALESCE(reputation_score, 0),
    'total_reviews', COALESCE(total_reviews, 0),
    'completed_sessions', COALESCE(completed_sessions, 0),
    'rating_distribution', (
      SELECT json_object_agg(rating, count)
      FROM (
        SELECT rating, COUNT(*) as count
        FROM reviews
        WHERE reviewee_id = p_user_id
        GROUP BY rating
        ORDER BY rating
      ) AS dist
    )
  )
  INTO v_result
  FROM profiles
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_result, '{}'::JSON);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_review(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_reputation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reputation_breakdown(UUID) TO authenticated;
