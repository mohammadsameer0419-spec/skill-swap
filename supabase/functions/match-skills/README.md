# Match Skills Edge Function

AI-powered semantic skill matching using OpenAI embeddings.

## Overview

This Edge Function finds the top N semantic matches between desired skills and available skills in the database using OpenAI's embedding model.

## Features

- **Semantic Matching**: Uses OpenAI `text-embedding-3-small` for fast, cost-effective embeddings
- **Batch Processing**: Efficiently processes multiple skills in batches
- **Filtering**: Supports filtering by level, category, and credits
- **Similarity Scoring**: Returns cosine similarity scores (0-1, higher = better match)
- **Performance**: Optimized for speed with batch processing

## Setup

### 1. Set OpenAI API Key

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key
```

Or via Supabase Dashboard:
- Settings → Edge Functions → Secrets
- Add `OPENAI_API_KEY`

### 2. Deploy

```bash
supabase functions deploy match-skills
```

## Usage

### Request

```typescript
POST /functions/v1/match-skills
Authorization: Bearer <token>
Content-Type: application/json

{
  "desired_skills": ["JavaScript", "React", "TypeScript"],
  "limit": 5,
  "filters": {
    "level": "intermediate",
    "max_credits": 10
  }
}
```

### Response

```typescript
{
  "matches": [
    {
      "skill_id": "uuid",
      "skill_name": "React Development",
      "skill_description": "Learn React from scratch",
      "teacher_name": "John Doe",
      "teacher_id": "uuid",
      "similarity_score": 0.92,
      "credits_required": 5,
      "level": "intermediate",
      "category_name": "Web Development"
    }
  ],
  "total_available": 42,
  "processing_time_ms": 1250
}
```

## Algorithm

1. Fetch available active skills from database
2. Create embedding for desired skills (combined query)
3. Create embeddings for all available skills (batch processing)
4. Calculate cosine similarity between query and each skill
5. Sort by similarity score (descending)
6. Return top N matches

## Performance

- **Batch Size**: 100 skills per batch (configurable)
- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Cost**: ~$0.02 per 1M tokens
- **Speed**: ~1-2 seconds for 100 skills

## Error Handling

- **400**: Invalid request (missing required fields)
- **500**: OpenAI API error or database error
- Returns error details in response body

## Testing

```bash
# Test locally
supabase functions serve match-skills

# Test with curl
curl -X POST http://localhost:54321/functions/v1/match-skills \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "desired_skills": ["JavaScript"],
    "limit": 5
  }'
```

## Monitoring

Check function logs:
```bash
supabase functions logs match-skills
```

## Future Enhancements

- [ ] Cache embeddings in database
- [ ] Multi-factor ranking (similarity + reputation + credits)
- [ ] Personalization based on user history
- [ ] Streaming results for large datasets
