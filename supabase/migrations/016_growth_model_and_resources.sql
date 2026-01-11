-- ============================================
-- Skill Growth & Resource Ecosystem
-- ============================================
-- Implements 5-Level Growth Model, Onboarding, and Learning Resources

-- ============================================
-- Step 1: Create User Levels ENUM
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_level AS ENUM (
    'beginner',  -- Level 1: Automatic on signup
    'learner',   -- Level 2: 3 Sessions + 4.0 Avg Rating
    'skilled',   -- Level 3: 10 Sessions + 4.2 Avg Rating
    'advanced',  -- Level 4: 25 Sessions + 4.5 Avg Rating
    'expert'     -- Level 5: 50 Sessions + 4.8 Avg Rating
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Step 2: Add level tracking to profiles
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS level user_level NOT NULL DEFAULT 'beginner';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS level_progress JSONB DEFAULT '{}'::JSONB;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS level_unlocked_at TIMESTAMPTZ;

-- Index for level queries
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level);

-- ============================================
-- Step 3: Create Onboarding Steps Table
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_key TEXT UNIQUE NOT NULL, -- e.g., 'welcome', 'create-profile', 'first-skill'
  title TEXT NOT NULL,
  description TEXT,
  step_order INTEGER NOT NULL, -- Order of steps
  is_required BOOLEAN DEFAULT TRUE,
  component_type TEXT, -- 'form', 'video', 'tutorial', 'action'
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create user onboarding progress table
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  step_key TEXT NOT NULL REFERENCES onboarding_steps(step_key) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  UNIQUE(user_id, step_key)
);

-- Indexes
CREATE INDEX idx_user_onboarding_progress_user ON user_onboarding_progress(user_id, completed_at);
CREATE INDEX idx_onboarding_steps_order ON onboarding_steps(step_order);

-- ============================================
-- Step 4: Create Learning Resources Tables
-- ============================================
CREATE TABLE IF NOT EXISTS resource_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'video',
    'article',
    'tutorial',
    'documentation',
    'exercise',
    'path'
  )),
  category_id UUID REFERENCES resource_categories(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_minutes INTEGER, -- For videos/tutorials
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  required_level user_level DEFAULT 'beginner',
  skill_tags TEXT[], -- Tags for related skills
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL, -- Expert/Advanced can create
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User resource progress tracking
CREATE TABLE IF NOT EXISTS user_resource_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status TEXT DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes TEXT,
  UNIQUE(user_id, resource_id)
);

-- Curated learning paths (created by Experts)
CREATE TABLE IF NOT EXISTS curated_learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  required_level user_level DEFAULT 'beginner',
  is_published BOOLEAN DEFAULT FALSE,
  resource_ids UUID[] NOT NULL, -- Ordered array of resource IDs
  estimated_hours INTEGER,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User path progress
CREATE TABLE IF NOT EXISTS user_path_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES curated_learning_paths(id) ON DELETE CASCADE,
  current_resource_index INTEGER DEFAULT 0,
  completed_resources UUID[] DEFAULT ARRAY[]::UUID[],
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, path_id)
);

-- Indexes for learning resources
CREATE INDEX idx_learning_resources_category ON learning_resources(category_id);
CREATE INDEX idx_learning_resources_type ON learning_resources(resource_type);
CREATE INDEX idx_learning_resources_level ON learning_resources(required_level);
CREATE INDEX idx_learning_resources_featured ON learning_resources(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_user_resource_progress_user ON user_resource_progress(user_id, status);
CREATE INDEX idx_user_path_progress_user ON user_path_progress(user_id);

-- ============================================
-- Step 5: Insert Default Onboarding Steps
-- ============================================
INSERT INTO onboarding_steps (step_key, title, description, step_order, is_required, component_type, metadata) VALUES
  ('welcome', 'Welcome to Skill Swap!', 'Get started with our platform and learn how it works.', 1, TRUE, 'video', '{"duration": 120}'),
  ('create-profile', 'Create Your Profile', 'Tell us about yourself and your skills.', 2, TRUE, 'form', '{}'),
  ('add-first-skill', 'Add Your First Skill', 'Share a skill you can teach to others.', 3, TRUE, 'form', '{}'),
  ('browse-resources', 'Explore Learning Resources', 'Discover helpful resources to improve your skills.', 4, FALSE, 'tutorial', '{}'),
  ('first-session', 'Complete Your First Session', 'Join or create your first skill swap session.', 5, FALSE, 'action', '{}')
ON CONFLICT (step_key) DO NOTHING;

-- ============================================
-- Step 6: Insert Default Resource Categories
-- ============================================
INSERT INTO resource_categories (name, slug, description, icon, order_index) VALUES
  ('Getting Started', 'getting-started', 'Resources for new users', '🎯', 1),
  ('Video Tutorials', 'video-tutorials', 'Video guides and tutorials', '🎥', 2),
  ('Practice Exercises', 'practice-exercises', 'Hands-on practice tasks', '💪', 3),
  ('Documentation', 'documentation', 'Detailed guides and references', '📚', 4),
  ('Advanced Topics', 'advanced-topics', 'Expert-level content', '🚀', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Step 7: Functions to Calculate User Level
-- ============================================
CREATE OR REPLACE FUNCTION calculate_user_level(p_user_id UUID)
RETURNS user_level
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_completed_sessions INTEGER;
  v_avg_rating DECIMAL;
  v_current_level user_level;
BEGIN
  -- Get user profile with current stats
  SELECT 
    level,
    completed_sessions,
    reputation_score
  INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN 'beginner';
  END IF;
  
  v_completed_sessions := COALESCE(v_profile.completed_sessions, 0);
  v_avg_rating := COALESCE(v_profile.reputation_score, 0.0);
  v_current_level := v_profile.level;
  
  -- Calculate level based on requirements
  -- Level 5 (Expert): 50 Sessions + 4.8 Avg Rating
  IF v_completed_sessions >= 50 AND v_avg_rating >= 4.8 THEN
    RETURN 'expert';
  END IF;
  
  -- Level 4 (Advanced): 25 Sessions + 4.5 Avg Rating
  IF v_completed_sessions >= 25 AND v_avg_rating >= 4.5 THEN
    RETURN 'advanced';
  END IF;
  
  -- Level 3 (Skilled): 10 Sessions + 4.2 Avg Rating
  IF v_completed_sessions >= 10 AND v_avg_rating >= 4.2 THEN
    RETURN 'skilled';
  END IF;
  
  -- Level 2 (Learner): 3 Sessions + 4.0 Avg Rating
  IF v_completed_sessions >= 3 AND v_avg_rating >= 4.0 THEN
    RETURN 'learner';
  END IF;
  
  -- Level 1 (Beginner): Automatic
  RETURN 'beginner';
END;
$$;

-- Function to update user level automatically
CREATE OR REPLACE FUNCTION update_user_level(p_user_id UUID)
RETURNS user_level
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculated_level user_level;
  v_current_level user_level;
  v_level_progress JSONB;
BEGIN
  -- Calculate what level user should be
  v_calculated_level := calculate_user_level(p_user_id);
  
  -- Get current level
  SELECT level INTO v_current_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Only update if level increased
  IF v_calculated_level::TEXT > v_current_level::TEXT THEN
    -- Build progress tracking
    SELECT 
      completed_sessions,
      reputation_score
    INTO v_level_progress
    FROM profiles
    WHERE user_id = p_user_id;
    
    -- Update profile with new level
    UPDATE profiles
    SET 
      level = v_calculated_level,
      level_unlocked_at = CASE 
        WHEN level_unlocked_at IS NULL THEN NOW()
        ELSE level_unlocked_at
      END,
      level_progress = v_level_progress,
      updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN v_calculated_level;
  END IF;
  
  RETURN v_current_level;
END;
$$;

-- ============================================
-- Step 8: Functions to Check Level Permissions
-- ============================================
CREATE OR REPLACE FUNCTION check_level_permission(
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_level user_level;
BEGIN
  -- Get user's current level
  SELECT level INTO v_user_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Check permissions based on level
  -- Use numeric comparison: beginner=1, learner=2, skilled=3, advanced=4, expert=5
  CASE p_permission
    WHEN 'access_basic_resources' THEN
      -- All levels can access basic resources
      RETURN TRUE;
    
    WHEN 'access_practice_tasks' THEN
      -- Learner and above
      RETURN v_user_level IN ('learner', 'skilled', 'advanced', 'expert');
    
    WHEN 'access_guided_resources' THEN
      -- Learner and above
      RETURN v_user_level IN ('learner', 'skilled', 'advanced', 'expert');
    
    WHEN 'teach_beginners' THEN
      -- Skilled and above
      RETURN v_user_level IN ('skilled', 'advanced', 'expert');
    
    WHEN 'suggest_resources' THEN
      -- Skilled and above
      RETURN v_user_level IN ('skilled', 'advanced', 'expert');
    
    WHEN 'host_live_classes' THEN
      -- Advanced and above
      RETURN v_user_level IN ('advanced', 'expert');
    
    WHEN 'earn_bonus_credits' THEN
      -- Advanced and above (1.2x multiplier)
      RETURN v_user_level IN ('advanced', 'expert');
    
    WHEN 'mentor_status' THEN
      -- Expert only
      RETURN v_user_level = 'expert';
    
    WHEN 'upload_curated_paths' THEN
      -- Expert only
      RETURN v_user_level = 'expert';
    
    WHEN 'mod_rights' THEN
      -- Expert only
      RETURN v_user_level = 'expert';
    
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Function to get level requirements progress
CREATE OR REPLACE FUNCTION get_level_progress(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_current_level user_level;
  v_next_level user_level;
  v_result JSON;
  v_sessions_needed INTEGER;
  v_rating_needed DECIMAL;
BEGIN
  -- Get user stats
  SELECT 
    level,
    completed_sessions,
    reputation_score
  INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  v_current_level := v_profile.level;
  
  -- Determine next level and requirements
  CASE v_current_level
    WHEN 'beginner' THEN
      v_next_level := 'learner';
      v_sessions_needed := GREATEST(0, 3 - COALESCE(v_profile.completed_sessions, 0));
      v_rating_needed := GREATEST(0, 4.0 - COALESCE(v_profile.reputation_score, 0));
    
    WHEN 'learner' THEN
      v_next_level := 'skilled';
      v_sessions_needed := GREATEST(0, 10 - COALESCE(v_profile.completed_sessions, 0));
      v_rating_needed := GREATEST(0, 4.2 - COALESCE(v_profile.reputation_score, 0));
    
    WHEN 'skilled' THEN
      v_next_level := 'advanced';
      v_sessions_needed := GREATEST(0, 25 - COALESCE(v_profile.completed_sessions, 0));
      v_rating_needed := GREATEST(0, 4.5 - COALESCE(v_profile.reputation_score, 0));
    
    WHEN 'advanced' THEN
      v_next_level := 'expert';
      v_sessions_needed := GREATEST(0, 50 - COALESCE(v_profile.completed_sessions, 0));
      v_rating_needed := GREATEST(0, 4.8 - COALESCE(v_profile.reputation_score, 0));
    
    ELSE
      -- Already at max level
      RETURN json_build_object(
        'current_level', v_current_level,
        'is_max_level', TRUE,
        'progress_percentage', 100
      );
  END CASE;
  
  -- Calculate progress percentage
  DECLARE
    v_sessions_progress DECIMAL;
    v_rating_progress DECIMAL;
    v_total_progress DECIMAL;
    v_sessions_required INTEGER;
    v_rating_required DECIMAL;
  BEGIN
    -- Get requirements for next level
    CASE v_next_level
      WHEN 'learner' THEN
        v_sessions_required := 3;
        v_rating_required := 4.0;
      WHEN 'skilled' THEN
        v_sessions_required := 10;
        v_rating_required := 4.2;
      WHEN 'advanced' THEN
        v_sessions_required := 25;
        v_rating_required := 4.5;
      WHEN 'expert' THEN
        v_sessions_required := 50;
        v_rating_required := 4.8;
    END CASE;
    
    -- Sessions progress
    IF v_sessions_required > 0 THEN
      v_sessions_progress := LEAST(100, (v_profile.completed_sessions::DECIMAL / v_sessions_required) * 100);
    ELSE
      v_sessions_progress := 100;
    END IF;
    
    -- Rating progress
    IF v_rating_required > 0 THEN
      v_rating_progress := LEAST(100, (v_profile.reputation_score::DECIMAL / v_rating_required) * 100);
    ELSE
      v_rating_progress := 100;
    END IF;
    
    -- Average of both requirements (both must be met, so use minimum)
    v_total_progress := LEAST(v_sessions_progress, v_rating_progress);
    
    v_result := json_build_object(
      'current_level', v_current_level,
      'next_level', v_next_level,
      'completed_sessions', v_profile.completed_sessions,
      'reputation_score', v_profile.reputation_score,
      'sessions_needed', v_sessions_needed,
      'rating_needed', ROUND(v_rating_needed, 2),
      'sessions_progress', ROUND(v_sessions_progress, 2),
      'rating_progress', ROUND(v_rating_progress, 2),
      'progress_percentage', ROUND(v_total_progress, 2),
      'is_max_level', FALSE
    );
    
    RETURN v_result;
  END;
END;
$$;

-- ============================================
-- Step 9: Trigger to Auto-Update Level on Session Completion
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update level for both learner and teacher when session completes
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM update_user_level(NEW.learner_id);
    PERFORM update_user_level(NEW.teacher_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_level_on_session_complete ON skill_sessions;
CREATE TRIGGER trg_update_level_on_session_complete
  AFTER UPDATE ON skill_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
  EXECUTE FUNCTION trigger_update_user_level();

-- Also trigger on reputation update
CREATE OR REPLACE FUNCTION trigger_update_level_on_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update level when reputation changes
  IF NEW.reputation_score != OLD.reputation_score THEN
    PERFORM update_user_level(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_level_on_reputation ON profiles;
CREATE TRIGGER trg_update_level_on_reputation
  AFTER UPDATE OF reputation_score ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_level_on_reputation();

-- ============================================
-- Step 10: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION calculate_user_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_level_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_level_progress(UUID) TO authenticated;

-- ============================================
-- Step 11: Row Level Security Policies
-- ============================================
-- Onboarding progress (users can read/update their own)
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own onboarding progress"
  ON user_onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own onboarding progress"
  ON user_onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Learning resources (all authenticated users can read)
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view published resources"
  ON learning_resources FOR SELECT
  USING (auth.role() = 'authenticated');

-- Resource progress (users can manage their own)
ALTER TABLE user_resource_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own resource progress"
  ON user_resource_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Curated paths (all can read published, experts can create)
ALTER TABLE curated_learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view published paths"
  ON curated_learning_paths FOR SELECT
  USING (is_published = TRUE OR auth.uid() = created_by);
CREATE POLICY "Experts can create paths"
  ON curated_learning_paths FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND level = 'expert'
    )
  );

-- Path progress (users can manage their own)
ALTER TABLE user_path_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own path progress"
  ON user_path_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN profiles.level IS 'User level: beginner, learner, skilled, advanced, expert';
COMMENT ON COLUMN profiles.level_progress IS 'JSON tracking progress toward next level';
COMMENT ON FUNCTION calculate_user_level IS 'Calculates user level based on completed sessions and average rating';
COMMENT ON FUNCTION check_level_permission IS 'Checks if user has permission based on their level';
