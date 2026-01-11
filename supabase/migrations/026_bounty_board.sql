-- ============================================
-- Bounty Board System (Pull Model)
-- ============================================
-- Allows users to post learning requests that Level 3+ users can claim

-- ============================================
-- Step 1: Create Bounties Table
-- ============================================
CREATE TABLE IF NOT EXISTS bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User who posted the bounty
  claimer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who claimed it (Level 3+)
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  credits_offered INTEGER NOT NULL CHECK (credits_offered > 0),
  category_id UUID REFERENCES skill_categories(id) ON DELETE SET NULL,
  skill_tags TEXT[], -- Array of skill tags/keywords
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'in_progress', 'completed', 'cancelled')),
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  expires_at TIMESTAMPTZ, -- Optional expiration date
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  session_id UUID REFERENCES skill_sessions(id) ON DELETE SET NULL, -- Link to skill session if created
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounties_poster_id ON bounties(poster_id);
CREATE INDEX IF NOT EXISTS idx_bounties_claimer_id ON bounties(claimer_id);
CREATE INDEX IF NOT EXISTS idx_bounties_category_id ON bounties(category_id);
CREATE INDEX IF NOT EXISTS idx_bounties_created_at ON bounties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounties_open_status ON bounties(status, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bounties_expires_at ON bounties(expires_at) WHERE expires_at IS NOT NULL AND status = 'open';

-- ============================================
-- Step 2: RLS Policies for Bounties
-- ============================================
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;

-- Anyone can view open bounties
CREATE POLICY "Anyone can view open bounties"
  ON bounties FOR SELECT
  USING (status = 'open' OR auth.uid() = poster_id OR auth.uid() = claimer_id);

-- Users can create their own bounties (must have enough credits)
CREATE POLICY "Users can create their own bounties"
  ON bounties FOR INSERT
  WITH CHECK (auth.uid() = poster_id);

-- Users can update their own bounties (if open or claimed by them)
CREATE POLICY "Users can update their own bounties"
  ON bounties FOR UPDATE
  USING (auth.uid() = poster_id AND status IN ('open', 'claimed', 'in_progress'))
  WITH CHECK (auth.uid() = poster_id);

-- Claimers can update bounties they claimed
CREATE POLICY "Claimers can update claimed bounties"
  ON bounties FOR UPDATE
  USING (auth.uid() = claimer_id AND status IN ('claimed', 'in_progress'))
  WITH CHECK (auth.uid() = claimer_id);

-- ============================================
-- Step 3: Function to Create Bounty
-- ============================================
CREATE OR REPLACE FUNCTION create_bounty(
  p_title TEXT,
  p_description TEXT,
  p_credits_offered INTEGER,
  p_category_id UUID DEFAULT NULL,
  p_skill_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_difficulty_level TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bounty_id UUID;
  v_poster_id UUID;
  v_available_credits INTEGER;
  v_balance_json JSON;
BEGIN
  v_poster_id := auth.uid();
  
  IF v_poster_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to create a bounty';
  END IF;

  -- Check user has enough available credits using the detailed balance function
  SELECT get_user_credit_balance_detailed(v_poster_id) INTO v_balance_json;
  v_available_credits := (v_balance_json->>'available')::INTEGER;

  IF v_available_credits < p_credits_offered THEN
    RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_available_credits, p_credits_offered;
  END IF;

  -- Reserve credits for the bounty (create reserved transaction)
  INSERT INTO credit_transactions (
    user_id,
    amount,
    transaction_type,
    status,
    description
  ) VALUES (
    v_poster_id,
    -p_credits_offered, -- Negative amount for reserve
    'locked', -- Transaction type
    'reserved', -- Status is 'reserved' (matches enum)
    'Bounty: ' || p_title
  );

  -- Create the bounty
  INSERT INTO bounties (
    poster_id,
    title,
    description,
    credits_offered,
    category_id,
    skill_tags,
    difficulty_level,
    expires_at
  ) VALUES (
    v_poster_id,
    p_title,
    p_description,
    p_credits_offered,
    p_category_id,
    p_skill_tags,
    p_difficulty_level,
    p_expires_at
  ) RETURNING id INTO v_bounty_id;

  RETURN v_bounty_id;
END;
$$;

-- ============================================
-- Step 4: Function to Claim Bounty
-- ============================================
CREATE OR REPLACE FUNCTION claim_bounty(
  p_bounty_id UUID
)
RETURNS UUID -- Returns session_id if skill session is created
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bounty RECORD;
  v_claimer_id UUID;
  v_claimer_profile_id UUID;
  v_poster_profile_id UUID;
  v_claimer_level TEXT;
  v_session_id UUID;
BEGIN
  v_claimer_id := auth.uid();
  
  IF v_claimer_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to claim a bounty';
  END IF;

  -- Get bounty details (with row lock)
  SELECT * INTO v_bounty
  FROM bounties
  WHERE id = p_bounty_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bounty not found';
  END IF;

  -- Check bounty is open
  IF v_bounty.status != 'open' THEN
    RAISE EXCEPTION 'Bounty is not available for claiming. Current status: %', v_bounty.status;
  END IF;

  -- Check user is not claiming their own bounty
  IF v_bounty.poster_id = v_claimer_id THEN
    RAISE EXCEPTION 'Cannot claim your own bounty';
  END IF;

  -- Get claimer's profile and level
  SELECT id, level INTO v_claimer_profile_id, v_claimer_level
  FROM profiles
  WHERE user_id = v_claimer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claimer profile not found';
  END IF;

  -- Check claimer is Level 3+ (skilled, advanced, or expert)
  IF v_claimer_level NOT IN ('skilled', 'advanced', 'expert') THEN
    RAISE EXCEPTION 'Only Level 3+ users (Skilled, Advanced, or Expert) can claim bounties';
  END IF;

  -- Get poster's profile ID
  SELECT id INTO v_poster_profile_id
  FROM profiles
  WHERE user_id = v_bounty.poster_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poster profile not found';
  END IF;

  -- Update bounty status to claimed
  UPDATE bounties
  SET 
    claimer_id = v_claimer_id,
    status = 'claimed',
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_bounty_id;

  -- Create a skill session from the bounty
  -- The claimer is the teacher, the poster is the learner
  INSERT INTO skill_sessions (
    learner_id,
    teacher_id,
    status,
    credits_required,
    description
  ) VALUES (
    v_poster_profile_id, -- Learner (bounty poster)
    v_claimer_profile_id, -- Teacher (bounty claimer)
    'accepted', -- Auto-accepted since claimer initiated
    v_bounty.credits_offered,
    'Bounty: ' || v_bounty.title || E'\n\n' || v_bounty.description
  ) RETURNING id INTO v_session_id;

  -- Link session to bounty
  UPDATE bounties
  SET session_id = v_session_id, status = 'in_progress'
  WHERE id = p_bounty_id;

  -- Update the credit transaction to link to session
  UPDATE credit_transactions
  SET 
    session_id = v_session_id,
    description = 'Bounty claimed: ' || v_bounty.title
  WHERE user_id = v_bounty.poster_id
    AND status = 'reserved'
    AND description LIKE 'Bounty: ' || v_bounty.title || '%'
    AND created_at >= NOW() - INTERVAL '1 hour' -- Within last hour (safety check)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session_id;
END;
$$;

-- ============================================
-- Step 5: Function to Cancel Bounty
-- ============================================
CREATE OR REPLACE FUNCTION cancel_bounty(
  p_bounty_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bounty RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to cancel a bounty';
  END IF;

  -- Get bounty (with row lock)
  SELECT * INTO v_bounty
  FROM bounties
  WHERE id = p_bounty_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bounty not found';
  END IF;

  -- Only poster can cancel (and only if not completed)
  IF v_bounty.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the bounty poster can cancel it';
  END IF;

  IF v_bounty.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a bounty that is already completed or cancelled';
  END IF;

  -- Cancel the bounty
  UPDATE bounties
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_bounty_id;

  -- Refund reserved credits if bounty was open
  IF v_bounty.status = 'open' THEN
    -- Create refund transaction
    INSERT INTO credit_transactions (
      user_id,
      amount,
      transaction_type,
      status,
      description
    ) VALUES (
      v_bounty.poster_id,
      v_bounty.credits_offered,
      'reserve',
      'cancelled',
      'Bounty cancelled: ' || v_bounty.title
    );

    -- Mark original reservation as cancelled
    UPDATE credit_transactions
    SET 
      status = 'cancelled',
      description = 'Bounty cancelled: ' || v_bounty.title
    WHERE user_id = v_bounty.poster_id
      AND status = 'reserved'
      AND description LIKE 'Bounty: ' || v_bounty.title || '%'
      AND created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================
-- Step 6: Function to Get Available Bounties
-- ============================================
CREATE OR REPLACE FUNCTION get_available_bounties(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_category_id UUID DEFAULT NULL,
  p_difficulty_level TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  poster_id UUID,
  poster_name TEXT,
  poster_avatar_url TEXT,
  title TEXT,
  description TEXT,
  credits_offered INTEGER,
  category_name TEXT,
  skill_tags TEXT[],
  difficulty_level TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  time_remaining INTERVAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.poster_id,
    COALESCE(p.full_name, p.username, 'Anonymous') AS poster_name,
    p.avatar_url AS poster_avatar_url,
    b.title,
    b.description,
    b.credits_offered,
    sc.name AS category_name,
    b.skill_tags,
    b.difficulty_level,
    b.expires_at,
    b.created_at,
    CASE 
      WHEN b.expires_at IS NOT NULL THEN b.expires_at - NOW()
      ELSE NULL
    END AS time_remaining
  FROM bounties b
  INNER JOIN profiles p ON b.poster_id = p.user_id
  LEFT JOIN skill_categories sc ON b.category_id = sc.id
  WHERE b.status = 'open'
    AND (p_category_id IS NULL OR b.category_id = p_category_id)
    AND (p_difficulty_level IS NULL OR b.difficulty_level = p_difficulty_level)
    AND (b.expires_at IS NULL OR b.expires_at > NOW())
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- Step 7: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION create_bounty(TEXT, TEXT, INTEGER, UUID, TEXT[], TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_bounty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_bounty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_bounties(INTEGER, INTEGER, UUID, TEXT) TO authenticated;

-- ============================================
-- Step 8: Auto-expire bounties trigger
-- ============================================
-- Create a function to expire bounties that have passed their expiration date
CREATE OR REPLACE FUNCTION expire_bounties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bounties
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE status = 'open'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
    
  -- Refund credits for expired bounties (same logic as cancel)
  -- This would need to be handled in a scheduled job or trigger
END;
$$;

-- Note: Set up a cron job to run expire_bounties() daily
-- Example: SELECT cron.schedule('expire-bounties', '0 0 * * *', $$SELECT expire_bounties()$$);
