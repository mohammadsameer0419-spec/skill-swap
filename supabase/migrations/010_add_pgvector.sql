-- ============================================
-- Add pgvector Extension for Embeddings
-- ============================================
-- Enables vector similarity search for AI-powered matching

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Add Embedding Column to Skills Table
-- ============================================
-- Stores OpenAI embeddings for semantic search
-- Dimensions: 1536 (for text-embedding-3-small model)

ALTER TABLE skills 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search
-- Note: This will be upgraded to HNSW in migration 028 for better performance at scale
-- IVFFlat is good for smaller datasets, HNSW is better for large-scale production
-- Using cosine similarity for semantic matching
CREATE INDEX IF NOT EXISTS idx_skills_embedding_vector 
ON skills 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL AND status = 'active';

-- ============================================
-- Function: Find Similar Skills using pgvector
-- ============================================
-- Uses vector similarity search to find top N matches
-- This is much more efficient than fetching all skills

CREATE OR REPLACE FUNCTION find_similar_skills(
  p_query_embedding_json JSONB,  -- Accept JSON array, convert to vector
  p_limit INTEGER DEFAULT 5,
  p_user_id UUID DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_max_credits INTEGER DEFAULT NULL
)
RETURNS TABLE (
  skill_id UUID,
  skill_name TEXT,
  skill_description TEXT,
  teacher_id UUID,
  teacher_name TEXT,
  similarity_score FLOAT,
  credits_required INTEGER,
  level TEXT,
  category_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_query_embedding vector(1536);
BEGIN
  -- Convert JSON array to vector
  v_query_embedding := (SELECT vector(ARRAY(SELECT jsonb_array_elements_text(p_query_embedding_json))::float[]));
  
  RETURN QUERY
  SELECT 
    s.id AS skill_id,
    s.name AS skill_name,
    s.description AS skill_description,
    s.user_id AS teacher_id,
    COALESCE(p.full_name, p.username, 'Unknown') AS teacher_name,
    -- Cosine similarity: 1 - (distance), higher is better
    (1 - (s.embedding <=> v_query_embedding))::FLOAT AS similarity_score,
    s.credits_required,
    s.level,
    sc.name AS category_name
  FROM skills s
  INNER JOIN profiles p ON s.user_id = p.user_id
  LEFT JOIN skill_categories sc ON s.category_id = sc.id
  WHERE s.status = 'active'
    AND s.embedding IS NOT NULL
    AND (p_user_id IS NULL OR s.user_id != p_user_id)
    AND (p_level IS NULL OR s.level = p_level)
    AND (p_category_id IS NULL OR s.category_id = p_category_id)
    AND (p_max_credits IS NULL OR s.credits_required <= p_max_credits)
  ORDER BY s.embedding <=> v_query_embedding  -- Order by cosine distance (ascending = most similar)
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_similar_skills(JSONB, INTEGER, UUID, TEXT, UUID, INTEGER) TO authenticated;

-- ============================================
-- Function: Update Skill Embedding
-- ============================================
-- Called when a skill is created or updated
-- Embeddings should be generated via Edge Function and stored here

CREATE OR REPLACE FUNCTION update_skill_embedding(
  p_skill_id UUID,
  p_embedding_json JSONB  -- Accept JSON array, convert to vector
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  -- Convert JSON array to vector
  v_embedding := (SELECT vector(ARRAY(SELECT jsonb_array_elements_text(p_embedding_json))::float[]));
  
  UPDATE skills
  SET embedding = v_embedding,
      updated_at = NOW()
  WHERE id = p_skill_id;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_skill_embedding(UUID, JSONB) TO authenticated;

-- Add comment
COMMENT ON COLUMN skills.embedding IS 'OpenAI embedding vector (1536 dimensions) for semantic similarity search using pgvector';
COMMENT ON FUNCTION find_similar_skills IS 'Finds similar skills using pgvector cosine similarity. Returns top N matches efficiently using vector index.';
COMMENT ON FUNCTION update_skill_embedding IS 'Updates the embedding vector for a skill. Called after generating embedding via OpenAI API.';
