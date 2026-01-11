-- ============================================
-- Top Experts and Trending Skills Functions
-- ============================================
-- Functions to fetch top experts and trending skills for dashboard

-- ============================================
-- Step 1: Get Top Experts (Level 5 with highest reputation)
-- ============================================
CREATE OR REPLACE FUNCTION get_top_experts(
  p_limit INTEGER DEFAULT 10,
  p_category_id UUID DEFAULT NULL -- Optional: filter by skill category
)
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  reputation_score DECIMAL,
  completed_sessions INTEGER,
  total_reviews INTEGER,
  level TEXT,
  primary_skill_category TEXT -- Most common category they teach
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.id AS profile_id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.reputation_score,
    p.completed_sessions,
    p.total_reviews,
    p.level,
    (
      SELECT sc.name
      FROM skills s
      JOIN skill_categories sc ON s.category_id = sc.id
      WHERE s.user_id = p.user_id
        AND s.status = 'active'
        AND (p_category_id IS NULL OR s.category_id = p_category_id)
      GROUP BY sc.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS primary_skill_category
  FROM profiles p
  WHERE p.level = 'expert' -- Level 5
    AND p.reputation_score >= 4.5 -- High reputation threshold
    AND p.completed_sessions >= 50 -- Expert requirement
  ORDER BY 
    p.reputation_score DESC,
    p.completed_sessions DESC,
    p.total_reviews DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- Step 2: Get Trending Skills
-- ============================================
-- Skills with most requests in the last 7 days
CREATE OR REPLACE FUNCTION get_trending_skills(
  p_limit INTEGER DEFAULT 20,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  skill_id UUID,
  skill_name TEXT,
  category_name TEXT,
  requests_count INTEGER,
  teacher_name TEXT,
  teacher_id UUID,
  credits_required INTEGER,
  level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS skill_id,
    s.name AS skill_name,
    sc.name AS category_name,
    COUNT(ss.id) AS requests_count,
    COALESCE(p.full_name, p.username, 'Unknown') AS teacher_name,
    s.user_id AS teacher_id,
    s.credits_required,
    s.level
  FROM skills s
  INNER JOIN profiles p ON s.user_id = p.user_id
  LEFT JOIN skill_categories sc ON s.category_id = sc.id
  LEFT JOIN skill_sessions ss ON s.id = ss.skill_id
    AND ss.created_at >= NOW() - (p_days || ' days')::INTERVAL
  WHERE s.status = 'active'
  GROUP BY 
    s.id,
    s.name,
    sc.name,
    p.full_name,
    p.username,
    s.user_id,
    s.credits_required,
    s.level
  ORDER BY 
    requests_count DESC,
    s.requests_count DESC,
    s.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- Step 3: Get User's Primary Field/Category
-- ============================================
-- Determines user's primary field based on their skills or desired skills
CREATE OR REPLACE FUNCTION get_user_primary_field(
  p_user_id UUID
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  skill_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id AS category_id,
    sc.name AS category_name,
    COUNT(*) AS skill_count
  FROM skills s
  JOIN skill_categories sc ON s.category_id = sc.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  GROUP BY sc.id, sc.name
  ORDER BY COUNT(*) DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- Step 4: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION get_top_experts(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_skills(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_primary_field(UUID) TO authenticated;
