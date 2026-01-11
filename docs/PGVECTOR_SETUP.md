# pgvector Setup Guide

## Overview

This app uses pgvector (PostgreSQL extension) for efficient vector similarity search. Skills are stored with OpenAI embeddings, and similarity is calculated directly in the database.

## Why pgvector?

- ✅ **Database-side similarity**: No need to fetch all skills to calculate similarity
- ✅ **Fast**: IVFFlat index provides sub-millisecond search
- ✅ **Scalable**: Handles millions of vectors efficiently
- ✅ **Efficient**: Only returns top N matches, not all records

## Setup

### 1. Enable pgvector Extension

Run the migration:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Database Schema

The `skills` table has an `embedding` column:

```sql
ALTER TABLE skills 
ADD COLUMN embedding vector(1536);  -- 1536 dimensions for text-embedding-3-small
```

### 3. Vector Index

An IVFFlat index is created for fast similarity search:

```sql
CREATE INDEX idx_skills_embedding_vector 
ON skills 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL AND status = 'active';
```

**Note**: IVFFlat index parameters:
- `lists = 100`: Number of clusters (adjust based on data size)
- Recommended: `lists = rows / 1000` (minimum 10)

### 4. Database Function

The `find_similar_skills()` function uses pgvector:

```sql
SELECT 
  s.id,
  s.name,
  -- Cosine similarity: 1 - (distance), higher is better
  (1 - (s.embedding <=> p_query_embedding))::FLOAT AS similarity_score
FROM skills s
WHERE s.embedding IS NOT NULL
ORDER BY s.embedding <=> p_query_embedding  -- Cosine distance
LIMIT 5;
```

## Generating Embeddings

### For New Skills

When a skill is created, generate its embedding:

1. Call `update-skill-embedding` Edge Function
2. Or use a database trigger (recommended for production)

### For Existing Skills

Batch update embeddings for existing skills:

```typescript
// Example script to batch-update embeddings
import { supabase } from './lib/supabase'

async function updateAllSkillEmbeddings() {
  // Fetch all skills without embeddings
  const { data: skills } = await supabase
    .from('skills')
    .select('id, name, description')
    .is('embedding', null)
    .eq('status', 'active')

  for (const skill of skills) {
    // Call Edge Function to generate and store embedding
    await supabase.functions.invoke('update-skill-embedding', {
      body: {
        skill_id: skill.id,
        name: skill.name,
        description: skill.description,
      },
    })
  }
}
```

## Query Performance

### Index Tuning

For better performance with large datasets:

```sql
-- Rebuild index with more lists (for 10,000+ skills)
DROP INDEX IF EXISTS idx_skills_embedding_vector;
CREATE INDEX idx_skills_embedding_vector 
ON skills 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50)  -- Adjust based on data size
WHERE embedding IS NOT NULL AND status = 'active';
```

### Monitoring

Check index usage:

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM find_similar_skills(
  '[0.1, 0.2, ...]'::vector(1536),  -- Your query embedding
  5
);
```

## Limitations

- **Index Rebuild**: IVFFlat index needs rebuilding when data grows significantly
- **Memory**: Vector operations use memory proportional to data size
- **Accuracy**: IVFFlat is approximate (99% accuracy is typical)

## Alternatives

For even better performance at scale:

1. **HNSW Index** (PostgreSQL 15+):
   ```sql
   CREATE INDEX USING hnsw (embedding vector_cosine_ops);
   ```
   - More accurate than IVFFlat
   - Faster for very large datasets
   - More memory usage

2. **pgvector vs Client-side**:
   - ❌ Client-side: Fetch 1000s of skills, calculate similarity in JS
   - ✅ pgvector: Calculate in database, return only top N matches

## Troubleshooting

### "extension vector does not exist"
- Enable pgvector extension in your Supabase project
- Some hosting providers may require enabling it via dashboard

### "vector dimensions mismatch"
- Ensure embeddings are 1536 dimensions (text-embedding-3-small)
- Check embedding generation code

### "Index not used"
- Rebuild index if data changed significantly
- Check query is using cosine distance operator (`<=>`)

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Supabase pgvector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
