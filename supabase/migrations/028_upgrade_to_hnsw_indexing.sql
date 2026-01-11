-- ============================================
-- Upgrade to HNSW Indexing for Vector Search
-- ============================================
-- Upgrades from IVFFlat to HNSW for better performance at scale
-- HNSW provides sub-millisecond search even with millions of records

-- ============================================
-- Step 1: Drop Existing IVFFlat Index
-- ============================================
DROP INDEX IF EXISTS idx_skills_embedding_vector;

-- ============================================
-- Step 2: Create HNSW Index
-- ============================================
-- HNSW (Hierarchical Navigable Small World) index
-- Better performance than IVFFlat, especially at scale
-- m: number of connections per layer (default 16)
-- ef_construction: size of candidate set during construction (default 64)

CREATE INDEX idx_skills_embedding_vector_hnsw 
ON skills 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding IS NOT NULL AND status = 'active';

-- ============================================
-- Step 3: Update Comments
-- ============================================
COMMENT ON INDEX idx_skills_embedding_vector_hnsw IS 
'HNSW index for vector similarity search. Provides sub-millisecond search performance even with millions of records. Uses cosine similarity for semantic matching.';

-- ============================================
-- Performance Notes:
-- ============================================
-- HNSW advantages over IVFFlat:
-- 1. Better query performance at scale (O(log n) complexity)
-- 2. No need to rebuild index when data changes
-- 3. Better recall accuracy
-- 4. Handles millions of vectors efficiently
--
-- The find_similar_skills() RPC function will automatically use this index
-- when executing: ORDER BY embedding <=> query_embedding
--
-- Query performance: Sub-millisecond even with millions of skills
-- Index size: Larger than IVFFlat but acceptable trade-off for performance
