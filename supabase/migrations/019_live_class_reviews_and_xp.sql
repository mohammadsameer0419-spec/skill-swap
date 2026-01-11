-- ============================================
-- Live Class Reviews and XP System
-- ============================================
-- Adds support for reviewing live classes and XP tracking

-- ============================================
-- Step 1: Add class_id to reviews table (optional, for live classes)
-- ============================================
-- Make session_id nullable and add class_id for live class reviews
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES live_classes(id) ON DELETE RESTRICT;

-- Add constraint: either session_id or class_id must be present
ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_session_or_class_check;

ALTER TABLE reviews
ADD CONSTRAINT reviews_session_or_class_check 
CHECK (
  (session_id IS NOT NULL AND class_id IS NULL) OR 
  (session_id IS NULL AND class_id IS NOT NULL)
);

-- Update unique constraint to include class_id
-- Drop old constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'one_review_per_session_role'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT one_review_per_session_role;
  END IF;
END $$;

-- New constraint: one review per session/class and role
-- Use partial unique index for better flexibility
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_session_unique 
ON reviews(session_id, reviewer_id, role) 
WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_class_unique 
ON reviews(class_id, reviewer_id, role) 
WHERE class_id IS NOT NULL;

-- Index for live class reviews
CREATE INDEX IF NOT EXISTS idx_reviews_class ON reviews(class_id) WHERE class_id IS NOT NULL;

-- ============================================
-- Step 2: Create XP/Experience tracking (if not exists)
-- ============================================
-- Add XP column to profiles if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS experience_points INTEGER DEFAULT 0 NOT NULL CHECK (experience_points >= 0);

-- Index for XP queries
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(experience_points DESC);

-- ============================================
-- Step 3: Create increment_user_xp function
-- ============================================
CREATE OR REPLACE FUNCTION increment_user_xp(
  p_user_id UUID,
  p_xp_amount INTEGER DEFAULT 10
)
RETURNS INTEGER -- Returns new total XP
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_xp INTEGER;
BEGIN
  -- Increment XP
  UPDATE profiles
  SET 
    experience_points = experience_points + p_xp_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING experience_points INTO v_new_xp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN v_new_xp;
END;
$$;

-- ============================================
-- Step 4: Create live class review function
-- ============================================
CREATE OR REPLACE FUNCTION create_live_class_review(
  p_reviewer_id UUID,
  p_reviewee_id UUID,
  p_class_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_record RECORD;
  v_review_role TEXT;
  v_review_id UUID;
  v_host_profile_id UUID;
BEGIN
  -- Validate participants are different
  IF p_reviewer_id = p_reviewee_id THEN
    RAISE EXCEPTION 'Cannot review yourself';
  END IF;
  
  -- Get class details with host's user_id
  SELECT lc.*, p.user_id as host_user_id
  INTO v_class_record
  FROM live_classes lc
  JOIN profiles p ON lc.host_id = p.id
  WHERE lc.id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Live class not found';
  END IF;

  -- Verify class is completed
  IF v_class_record.status != 'completed' THEN
    RAISE EXCEPTION 'Can only review completed live classes';
  END IF;

  -- Get host's user_id (auth.users user_id) - already in v_class_record.host_user_id
  v_host_profile_id := v_class_record.host_user_id;

  -- Verify reviewer participated in class (either as host or attendee)
  IF v_host_profile_id != p_reviewer_id AND NOT EXISTS (
    SELECT 1 FROM live_class_attendance lca
    JOIN profiles p ON lca.user_id = p.id
    WHERE lca.class_id = p_class_id
    AND p.user_id = p_reviewer_id
    AND lca.paid_status IN ('paid', 'reserved')
  ) THEN
    RAISE EXCEPTION 'You did not participate in this live class';
  END IF;

  -- Verify reviewee participated in class
  IF v_host_profile_id != p_reviewee_id AND NOT EXISTS (
    SELECT 1 FROM live_class_attendance lca
    JOIN profiles p ON lca.user_id = p.id
    WHERE lca.class_id = p_class_id
    AND p.user_id = p_reviewee_id
    AND lca.paid_status IN ('paid', 'reserved')
  ) THEN
    RAISE EXCEPTION 'Reviewee did not participate in this live class';
  END IF;

  -- Determine reviewer role (host or attendee)
  IF v_host_profile_id = p_reviewer_id THEN
    v_review_role := 'teacher'; -- Host is like a teacher
  ELSE
    v_review_role := 'learner'; -- Attendee is like a learner
  END IF;

  -- Check if review already exists for this class/role
  IF EXISTS (
    SELECT 1 FROM reviews
    WHERE class_id = p_class_id
    AND reviewer_id = p_reviewer_id
    AND role = v_review_role
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this live class as %', v_review_role;
  END IF;
  
  -- Create review
  INSERT INTO reviews (
    reviewer_id,
    reviewee_id,
    class_id, -- Live class ID (session_id is NULL)
    rating,
    comment,
    role
  ) VALUES (
    p_reviewer_id,
    p_reviewee_id,
    p_class_id,
    p_rating,
    p_comment,
    v_review_role
  ) RETURNING id INTO v_review_id;
  
  -- Update reviewee reputation (recalculates average_rating)
  PERFORM update_user_reputation(p_reviewee_id);
  
  -- Increment XP for reviewer (reward for leaving a review)
  PERFORM increment_user_xp(p_reviewer_id, 5); -- 5 XP for leaving a review
  
  -- Increment XP for reviewee (reward for receiving a review)
  PERFORM increment_user_xp(p_reviewee_id, 10); -- 10 XP for receiving a review
  
  RETURN v_review_id;
END;
$$;

-- ============================================
-- Step 5: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION increment_user_xp(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_live_class_review(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
