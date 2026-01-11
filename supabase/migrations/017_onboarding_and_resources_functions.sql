-- ============================================
-- Onboarding and Learning Resources Functions
-- ============================================
-- Helper functions for onboarding flows and resource management

-- ============================================
-- Step 1: Onboarding Functions
-- ============================================

-- Complete an onboarding step
CREATE OR REPLACE FUNCTION complete_onboarding_step(
  p_user_id UUID,
  p_step_key TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_step_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check if step exists
  IF NOT EXISTS (SELECT 1 FROM onboarding_steps WHERE step_key = p_step_key) THEN
    RAISE EXCEPTION 'Onboarding step not found: %', p_step_key;
  END IF;
  
  -- Check if already completed (idempotent)
  SELECT id INTO v_existing_id
  FROM user_onboarding_progress
  WHERE user_id = p_user_id AND step_key = p_step_key;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;
  
  -- Mark step as completed
  INSERT INTO user_onboarding_progress (user_id, step_key, metadata)
  VALUES (p_user_id, p_step_key, p_metadata)
  RETURNING id INTO v_step_id;
  
  RETURN v_step_id;
END;
$$;

-- Get user's onboarding progress
CREATE OR REPLACE FUNCTION get_user_onboarding_progress(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_total_steps INTEGER;
  v_completed_steps INTEGER;
  v_progress_percentage DECIMAL;
BEGIN
  -- Get total required steps
  SELECT COUNT(*) INTO v_total_steps
  FROM onboarding_steps
  WHERE is_required = TRUE;
  
  -- Get completed steps
  SELECT COUNT(*) INTO v_completed_steps
  FROM user_onboarding_progress uop
  INNER JOIN onboarding_steps os ON uop.step_key = os.step_key
  WHERE uop.user_id = p_user_id AND os.is_required = TRUE;
  
  -- Calculate progress
  IF v_total_steps > 0 THEN
    v_progress_percentage := (v_completed_steps::DECIMAL / v_total_steps::DECIMAL) * 100;
  ELSE
    v_progress_percentage := 0;
  END IF;
  
  -- Build result with step details
  SELECT json_build_object(
    'total_steps', v_total_steps,
    'completed_steps', v_completed_steps,
    'progress_percentage', ROUND(v_progress_percentage, 2),
    'is_complete', v_completed_steps >= v_total_steps,
    'steps', (
      SELECT json_agg(
        json_build_object(
          'step_key', os.step_key,
          'title', os.title,
          'description', os.description,
          'step_order', os.step_order,
          'is_required', os.is_required,
          'component_type', os.component_type,
          'completed', uop.completed_at IS NOT NULL,
          'completed_at', uop.completed_at
        ) ORDER BY os.step_order
      )
      FROM onboarding_steps os
      LEFT JOIN user_onboarding_progress uop 
        ON os.step_key = uop.step_key AND uop.user_id = p_user_id
    )
  )
  INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ============================================
-- Step 2: Learning Resources Functions
-- ============================================

-- Update resource progress
CREATE OR REPLACE FUNCTION update_resource_progress(
  p_user_id UUID,
  p_resource_id UUID,
  p_progress_percentage INTEGER,
  p_status TEXT DEFAULT 'in_progress'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_progress_id UUID;
  v_resource_record RECORD;
BEGIN
  -- Validate status
  IF p_status NOT IN ('started', 'in_progress', 'completed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  
  -- Validate progress percentage
  IF p_progress_percentage < 0 OR p_progress_percentage > 100 THEN
    RAISE EXCEPTION 'Progress percentage must be between 0 and 100';
  END IF;
  
  -- Check if resource exists and user has permission
  SELECT id, required_level INTO v_resource_record
  FROM learning_resources
  WHERE id = p_resource_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource not found';
  END IF;
  
  -- Check if user has required level
  IF NOT check_level_permission(p_user_id, 'access_basic_resources') THEN
    RAISE EXCEPTION 'Insufficient permissions to access this resource';
  END IF;
  
  -- Update or insert progress
  INSERT INTO user_resource_progress (
    user_id,
    resource_id,
    progress_percentage,
    status,
    last_accessed_at,
    completed_at
  ) VALUES (
    p_user_id,
    p_resource_id,
    p_progress_percentage,
    p_status,
    NOW(),
    CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id, resource_id) DO UPDATE
  SET 
    progress_percentage = EXCLUDED.progress_percentage,
    status = EXCLUDED.status,
    last_accessed_at = NOW(),
    completed_at = CASE 
      WHEN EXCLUDED.status = 'completed' AND user_resource_progress.completed_at IS NULL 
      THEN NOW() 
      WHEN EXCLUDED.status != 'completed' 
      THEN NULL
      ELSE user_resource_progress.completed_at
    END
  RETURNING id INTO v_progress_id;
  
  RETURN v_progress_id;
END;
$$;

-- Get resources available to user (based on level)
CREATE OR REPLACE FUNCTION get_available_resources(
  p_user_id UUID,
  p_category_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_level user_level;
  v_result JSON;
BEGIN
  -- Get user's level
  SELECT level INTO v_user_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Build result with available resources
  SELECT json_build_object(
    'total', COUNT(*) OVER(),
    'resources', json_agg(
      json_build_object(
        'id', lr.id,
        'title', lr.title,
        'description', lr.description,
        'resource_type', lr.resource_type,
        'category_id', lr.category_id,
        'category_name', rc.name,
        'url', lr.url,
        'thumbnail_url', lr.thumbnail_url,
        'duration_minutes', lr.duration_minutes,
        'difficulty_level', lr.difficulty_level,
        'required_level', lr.required_level,
        'skill_tags', lr.skill_tags,
        'is_featured', lr.is_featured,
        'view_count', lr.view_count,
        'progress', (
          SELECT json_build_object(
            'progress_percentage', urp.progress_percentage,
            'status', urp.status,
            'completed_at', urp.completed_at
          )
          FROM user_resource_progress urp
          WHERE urp.user_id = p_user_id AND urp.resource_id = lr.id
        )
      ) ORDER BY lr.is_featured DESC, lr.created_at DESC
    )
  )
  INTO v_result
  FROM learning_resources lr
  LEFT JOIN resource_categories rc ON lr.category_id = rc.id
  WHERE 
    -- Check level permission
    (lr.required_level IS NULL OR lr.required_level <= v_user_level) AND
    -- Optional filters
    (p_category_id IS NULL OR lr.category_id = p_category_id) AND
    (p_resource_type IS NULL OR lr.resource_type = p_resource_type)
  GROUP BY lr.id
  LIMIT p_limit
  OFFSET p_offset;
  
  RETURN v_result;
END;
$$;

-- Increment resource view count
CREATE OR REPLACE FUNCTION increment_resource_views(p_resource_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE learning_resources
  SET view_count = view_count + 1
  WHERE id = p_resource_id
  RETURNING view_count INTO v_new_count;
  
  RETURN COALESCE(v_new_count, 0);
END;
$$;

-- ============================================
-- Step 3: Curated Path Functions
-- ============================================

-- Create a curated learning path (Experts only)
CREATE OR REPLACE FUNCTION create_curated_path(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_resource_ids UUID[],
  p_estimated_hours INTEGER DEFAULT NULL,
  p_difficulty_level TEXT DEFAULT 'beginner',
  p_required_level user_level DEFAULT 'beginner'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path_id UUID;
  v_user_level user_level;
BEGIN
  -- Check if user is expert
  SELECT level INTO v_user_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_user_level != 'expert' THEN
    RAISE EXCEPTION 'Only Expert level users can create curated paths';
  END IF;
  
  -- Validate resource_ids array
  IF array_length(p_resource_ids, 1) IS NULL OR array_length(p_resource_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Path must contain at least one resource';
  END IF;
  
  -- Validate difficulty level
  IF p_difficulty_level NOT IN ('beginner', 'intermediate', 'advanced', 'expert') THEN
    RAISE EXCEPTION 'Invalid difficulty level: %', p_difficulty_level;
  END IF;
  
  -- Create path
  INSERT INTO curated_learning_paths (
    title,
    description,
    created_by,
    resource_ids,
    estimated_hours,
    difficulty_level,
    required_level,
    is_published
  ) VALUES (
    p_title,
    p_description,
    p_user_id,
    p_resource_ids,
    p_estimated_hours,
    p_difficulty_level,
    p_required_level,
    FALSE -- Start as draft
  ) RETURNING id INTO v_path_id;
  
  RETURN v_path_id;
END;
$$;

-- Start a learning path
CREATE OR REPLACE FUNCTION start_learning_path(
  p_user_id UUID,
  p_path_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path_record RECORD;
  v_user_level user_level;
  v_progress_id UUID;
BEGIN
  -- Get path details
  SELECT id, required_level, is_published, created_by
  INTO v_path_record
  FROM curated_learning_paths
  WHERE id = p_path_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Path not found';
  END IF;
  
  -- Check if path is published or user is creator
  IF NOT v_path_record.is_published AND v_path_record.created_by != p_user_id THEN
    RAISE EXCEPTION 'Path is not published';
  END IF;
  
  -- Get user level
  SELECT level INTO v_user_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Check level requirement
  IF v_path_record.required_level > v_user_level THEN
    RAISE EXCEPTION 'Insufficient level. Required: %, Current: %', 
      v_path_record.required_level, v_user_level;
  END IF;
  
  -- Create or update progress
  INSERT INTO user_path_progress (
    user_id,
    path_id,
    current_resource_index,
    completed_resources,
    progress_percentage,
    started_at
  ) VALUES (
    p_user_id,
    p_path_id,
    0,
    ARRAY[]::UUID[],
    0,
    NOW()
  )
  ON CONFLICT (user_id, path_id) DO UPDATE
  SET started_at = user_path_progress.started_at -- Don't overwrite if already started
  RETURNING id INTO v_progress_id;
  
  RETURN v_progress_id;
END;
$$;

-- ============================================
-- Step 4: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION complete_onboarding_step(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_onboarding_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_resource_progress(UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_resources(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_resource_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_curated_path(UUID, TEXT, TEXT, UUID[], INTEGER, TEXT, user_level) TO authenticated;
GRANT EXECUTE ON FUNCTION start_learning_path(UUID, UUID) TO authenticated;
