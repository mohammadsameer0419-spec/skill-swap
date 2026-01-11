-- ============================================
-- Enhanced Micro-Certification System
-- ============================================
-- Adds verification_hash, updates schema, and creates auto-generation trigger

-- ============================================
-- Step 1: Update Certificates Table
-- ============================================

-- Add verification_hash column
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS verification_hash TEXT UNIQUE;

-- Add index for verification lookups
CREATE INDEX IF NOT EXISTS idx_certificates_verification_hash 
ON certificates(verification_hash) 
WHERE verification_hash IS NOT NULL;

-- Add unique constraint: user can't get two certificates for the same session
ALTER TABLE certificates
DROP CONSTRAINT IF EXISTS certificates_user_session_unique;

ALTER TABLE certificates
ADD CONSTRAINT certificates_user_session_unique 
UNIQUE (user_id, session_id);

-- Rename columns to match requirements (if needed, using aliases in functions)
-- Note: skill_id = subject_id, teacher_id = issuer_id
-- We'll keep both names for backward compatibility

-- ============================================
-- Step 2: Generate Verification Hash Function
-- ============================================
CREATE OR REPLACE FUNCTION generate_verification_hash(
  p_certificate_id UUID,
  p_user_id UUID,
  p_session_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash TEXT;
  v_secret TEXT := 'skillswap-cert-secret-2024'; -- In production, use env variable
BEGIN
  -- Generate a unique hash using certificate ID, user ID, and session ID
  -- Format: SHA256 hash of combined values
  v_hash := encode(
    digest(
      p_certificate_id::TEXT || '|' || p_user_id::TEXT || '|' || p_session_id::TEXT || '|' || v_secret,
      'sha256'
    ),
    'hex'
  );
  
  -- Take first 32 characters for shorter hash
  v_hash := SUBSTRING(v_hash, 1, 32);
  
  RETURN v_hash;
END;
$$;

-- ============================================
-- Step 3: Enhanced Certificate Generation Function
-- ============================================
CREATE OR REPLACE FUNCTION generate_certificate_on_completion(
  p_session_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_skill_record RECORD;
  v_learner_profile RECORD;
  v_teacher_profile RECORD;
  v_review_record RECORD;
  v_certificate_id UUID;
  v_certificate_number TEXT;
  v_verification_hash TEXT;
  v_has_4_star_review BOOLEAN := FALSE;
BEGIN
  -- Get session details
  SELECT 
    ss.id, 
    ss.learner_id, 
    ss.teacher_id, 
    ss.skill_id, 
    ss.status, 
    ss.completed_at
  INTO v_session_record
  FROM skill_sessions ss
  WHERE ss.id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Session must be completed
  IF v_session_record.status != 'completed' THEN
    RAISE EXCEPTION 'Can only generate certificates for completed sessions';
  END IF;
  
  -- Check if certificate already exists for this session/user combination
  IF EXISTS (
    SELECT 1 FROM certificates
    WHERE session_id = p_session_id
    AND user_id = v_session_record.learner_id
  ) THEN
    RAISE EXCEPTION 'Certificate already exists for this session';
  END IF;
  
  -- Check if learner gave teacher a 4+ star review
  SELECT rating INTO v_review_record
  FROM reviews
  WHERE session_id = p_session_id
  AND reviewer_id = v_session_record.learner_id
  AND reviewee_id = v_session_record.teacher_id
  AND role = 'learner'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No review found. Certificate can only be generated after learner reviews the session with 4+ stars.';
  END IF;
  
  IF v_review_record.rating < 4 THEN
    RAISE EXCEPTION 'Certificate can only be generated if learner gave teacher a rating of 4 stars or higher. Current rating: %', v_review_record.rating;
  END IF;
  
  v_has_4_star_review := TRUE;
  
  -- Get skill details
  SELECT id, name, user_id
  INTO v_skill_record
  FROM skills
  WHERE id = v_session_record.skill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;
  
  -- Get learner profile
  SELECT user_id, full_name, username
  INTO v_learner_profile
  FROM profiles
  WHERE user_id = v_session_record.learner_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learner profile not found';
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
  SELECT generate_certificate_number() INTO v_certificate_number;
  
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
    v_session_record.learner_id,
    v_skill_record.id,
    p_session_id,
    v_skill_record.name,
    v_teacher_profile.user_id,
    COALESCE(v_teacher_profile.full_name, v_teacher_profile.username, 'Unknown'),
    COALESCE(v_session_record.completed_at, NOW())
  ) RETURNING id INTO v_certificate_id;
  
  -- Generate and update verification hash
  SELECT generate_verification_hash(
    v_certificate_id,
    v_session_record.learner_id,
    p_session_id
  ) INTO v_verification_hash;
  
  UPDATE certificates
  SET verification_hash = v_verification_hash
  WHERE id = v_certificate_id;
  
  RETURN v_certificate_id;
END;
$$;

-- ============================================
-- Step 4: Trigger to Auto-Generate Certificates
-- ============================================
CREATE OR REPLACE FUNCTION trigger_generate_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_review_rating INTEGER;
BEGIN
  -- Only trigger when a review is created for a completed session
  -- And the review rating is 4 or higher
  IF NEW.rating >= 4 THEN
    -- Check if session is completed
    IF EXISTS (
      SELECT 1 FROM skill_sessions
      WHERE id = NEW.session_id
      AND status = 'completed'
    ) THEN
      -- Check if certificate doesn't already exist
      IF NOT EXISTS (
        SELECT 1 FROM certificates
        WHERE session_id = NEW.session_id
        AND user_id = NEW.reviewee_id
      ) THEN
        -- Only generate if learner is reviewing teacher (role = 'learner')
        IF NEW.role = 'learner' THEN
          -- Generate certificate for the learner (reviewee is the teacher, but certificate is for learner)
          -- Actually, wait - the learner is the one who should get the certificate
          -- So if learner is reviewing teacher, the certificate should be for the learner
          -- Let me check the logic: learner_id = reviewer_id, so reviewee_id = teacher_id
          -- Certificate should be for learner_id, which is NEW.reviewer_id
          BEGIN
            PERFORM generate_certificate_on_completion(NEW.session_id);
          EXCEPTION
            WHEN OTHERS THEN
              -- Log error but don't fail the review insertion
              RAISE WARNING 'Failed to generate certificate for session %: %', NEW.session_id, SQLERRM;
          END;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_certificate_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  WHEN (NEW.rating >= 4 AND NEW.role = 'learner')
  EXECUTE FUNCTION trigger_generate_certificate();

-- ============================================
-- Step 5: Verification Function
-- ============================================
CREATE OR REPLACE FUNCTION verify_certificate(
  p_verification_hash TEXT
)
RETURNS TABLE (
  certificate_id UUID,
  certificate_number TEXT,
  user_name TEXT,
  skill_name TEXT,
  teacher_name TEXT,
  issued_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_certificate_record RECORD;
BEGIN
  -- Find certificate by verification hash
  SELECT 
    c.id,
    c.certificate_number,
    p.full_name as user_name,
    c.skill_name,
    c.teacher_name,
    c.issued_at
  INTO v_certificate_record
  FROM certificates c
  JOIN profiles p ON c.user_id = p.user_id
  WHERE c.verification_hash = p_verification_hash;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TIMESTAMPTZ,
      FALSE::BOOLEAN;
    RETURN;
  END IF;
  
  -- Return certificate details
  RETURN QUERY SELECT 
    v_certificate_record.id,
    v_certificate_record.certificate_number,
    COALESCE(v_certificate_record.user_name, 'Unknown'),
    v_certificate_record.skill_name,
    v_certificate_record.teacher_name,
    v_certificate_record.issued_at,
    TRUE::BOOLEAN;
END;
$$;

-- ============================================
-- Step 6: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION generate_certificate_on_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_certificate_on_completion(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION verify_certificate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_certificate(TEXT) TO anon; -- Public access for verification
