-- ============================================
-- Notification Helper Functions
-- ============================================
-- Functions to create specific notification types

-- ============================================
-- Step 1: Class Starting Soon Notification
-- ============================================
-- This should be called by a scheduled job or Edge Function
-- that checks for classes starting in the next 15 minutes

CREATE OR REPLACE FUNCTION notify_class_starting_soon(
  p_class_id UUID
)
RETURNS INTEGER -- Returns count of notifications created
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_record RECORD;
  v_attendee_record RECORD;
  v_notification_count INTEGER := 0;
BEGIN
  -- Get class details
  SELECT * INTO v_class_record
  FROM live_classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Check if class is starting soon (within 15 minutes)
  IF v_class_record.scheduled_at > NOW() + INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Class is not starting soon enough';
  END IF;

  IF v_class_record.status NOT IN ('scheduled', 'live') THEN
    RAISE EXCEPTION 'Class is not in a valid state for notifications';
  END IF;

  -- Notify all attendees
  FOR v_attendee_record IN
    SELECT DISTINCT p.user_id
    FROM live_class_attendance lca
    JOIN profiles p ON lca.user_id = p.id
    WHERE lca.class_id = p_class_id
    AND lca.paid_status IN ('reserved', 'paid')
  LOOP
    PERFORM create_notification(
      v_attendee_record.user_id,
      'class_starting_soon',
      '🔔 Class Starting Soon',
      'Your class "' || v_class_record.title || '" starts in ' ||
      EXTRACT(EPOCH FROM (v_class_record.scheduled_at - NOW()))::INTEGER / 60 || ' minutes!',
      p_class_id,
      'live_class',
      jsonb_build_object(
        'class_id', p_class_id,
        'class_title', v_class_record.title,
        'scheduled_at', v_class_record.scheduled_at
      )
    );
    v_notification_count := v_notification_count + 1;
  END LOOP;

  RETURN v_notification_count;
END;
$$;

-- ============================================
-- Step 2: New Skill Match Notification
-- ============================================
-- Called when a new skill match is found for a user

CREATE OR REPLACE FUNCTION notify_new_skill_match(
  p_user_id UUID,
  p_skill_id UUID,
  p_match_score DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_skill_record RECORD;
  v_notification_id UUID;
BEGIN
  -- Get skill details
  SELECT s.*, p.username as teacher_username, p.full_name as teacher_name
  INTO v_skill_record
  FROM skills s
  JOIN profiles p ON s.user_id = p.user_id
  WHERE s.id = p_skill_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;

  -- Create notification
  SELECT create_notification(
    p_user_id,
    'new_skill_match',
    '✨ New Skill Match Found!',
    CASE
      WHEN p_match_score IS NOT NULL THEN
        'We found a match for your desired skill: "' || v_skill_record.name || '" (Match: ' || ROUND(p_match_score * 100, 0) || '%)'
      ELSE
        'We found a match for your desired skill: "' || v_skill_record.name || '"'
    END,
    p_skill_id,
    'skill',
    jsonb_build_object(
      'skill_id', p_skill_id,
      'skill_name', v_skill_record.name,
      'teacher_name', COALESCE(v_skill_record.teacher_name, v_skill_record.teacher_username, 'Unknown'),
      'match_score', p_match_score
    )
  ) INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ============================================
-- Step 3: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION notify_class_starting_soon(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_class_starting_soon(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION notify_new_skill_match(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_new_skill_match(UUID, UUID, DECIMAL) TO service_role;
