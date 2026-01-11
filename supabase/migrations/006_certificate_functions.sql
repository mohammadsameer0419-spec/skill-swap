-- ============================================
-- Certificate Generation Functions
-- ============================================
-- Immutable certificate records

-- Generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT := 'MSS';
  v_timestamp TEXT;
  v_random TEXT;
  v_cert_number TEXT;
BEGIN
  -- Format: MSS-YYYYMMDD-HHMMSS-RRRR
  -- RRRR = random 4-digit number
  v_timestamp := TO_CHAR(NOW(), 'YYYYMMDD-HHMMSS');
  v_random := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  v_cert_number := format('%s-%s-%s', v_prefix, v_timestamp, v_random);
  
  -- Ensure uniqueness (retry if collision)
  WHILE EXISTS (SELECT 1 FROM certificates WHERE certificate_number = v_cert_number) LOOP
    v_random := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    v_cert_number := format('%s-%s-%s', v_prefix, v_timestamp, v_random);
  END LOOP;
  
  RETURN v_cert_number;
END;
$$;

-- Create certificate for completed session
CREATE OR REPLACE FUNCTION create_certificate(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_skill_record RECORD;
  v_teacher_profile RECORD;
  v_certificate_id UUID;
  v_certificate_number TEXT;
BEGIN
  -- Get session details
  SELECT id, learner_id, teacher_id, skill_id, status, completed_at
  INTO v_session_record
  FROM skill_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Session must be completed
  IF v_session_record.status != 'completed' THEN
    RAISE EXCEPTION 'Can only create certificates for completed sessions';
  END IF;
  
  -- Verify user is the learner
  IF v_session_record.learner_id != p_user_id THEN
    RAISE EXCEPTION 'Only the learner can create a certificate for this session';
  END IF;
  
  -- Check if certificate already exists
  IF EXISTS (
    SELECT 1 FROM certificates
    WHERE session_id = p_session_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Certificate already exists for this session';
  END IF;
  
  -- Get skill details
  SELECT id, name, user_id
  INTO v_skill_record
  FROM skills
  WHERE id = v_session_record.skill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;
  
  -- Get teacher profile
  SELECT user_id, full_name, username
  INTO v_teacher_profile
  FROM profiles
  WHERE user_id = v_session_record.teacher_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teacher profile not found';
  END IF;
  
  -- Generate certificate number
  v_certificate_number := generate_certificate_number();
  
  -- Create certificate
  INSERT INTO certificates (
    certificate_number,
    user_id,
    skill_id,
    session_id,
    skill_name,
    teacher_id,
    teacher_name,
    issued_at
  ) VALUES (
    v_certificate_number,
    p_user_id,
    v_skill_record.id,
    p_session_id,
    v_skill_record.name,
    v_teacher_profile.user_id,
    COALESCE(v_teacher_profile.full_name, v_teacher_profile.username, 'Unknown'),
    COALESCE(v_session_record.completed_at, NOW())
  ) RETURNING id INTO v_certificate_id;
  
  RETURN v_certificate_id;
END;
$$;

-- Get user certificates
CREATE OR REPLACE FUNCTION get_user_certificates(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  certificate_number TEXT,
  skill_name TEXT,
  teacher_name TEXT,
  issued_at TIMESTAMPTZ,
  certificate_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.certificate_number,
    c.skill_name,
    c.teacher_name,
    c.issued_at,
    c.certificate_url
  FROM certificates c
  WHERE c.user_id = p_user_id
  ORDER BY c.issued_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_certificate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_certificates(UUID) TO authenticated;
