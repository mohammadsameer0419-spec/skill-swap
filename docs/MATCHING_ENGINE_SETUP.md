# AI-Powered Matching Engine Setup

## Overview

The matching engine uses OpenAI embeddings with **pgvector** for efficient database-side similarity search. This ensures we don't fetch all skills to the client - similarity is calculated in the database using vector indexes.

## Architecture

- **Database**: pgvector extension for vector similarity search
- **Edge Function**: `supabase/functions/match-skills/` (generates query embedding, calls DB function)
- **Database Function**: `find_similar_skills()` (uses pgvector for efficient search)
- **Client Service**: `src/lib/services/matchingService.ts`
- **Types**: `src/types/matching.types.ts`
- **AI Model**: OpenAI `text-embedding-3-small` (1536 dimensions)

## Key Benefits

- ✅ **Database-side similarity**: Uses pgvector for efficient vector search
- ✅ **No client-side filtering**: Only top N matches returned from database
- ✅ **Scalable**: Handles millions of skills efficiently with vector indexes
- ✅ **Fast**: IVFFlat index provides sub-millisecond similarity search

## Setup Instructions

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link Your Project

```bash
supabase link --project-ref your-project-ref
```

### 3. Set Environment Variables

Set the OpenAI API key in your Supabase project:

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Add secret: `OPENAI_API_KEY` with your OpenAI API key

**Option B: Using Supabase CLI**
```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key
```

### 4. Deploy the Edge Function

```bash
supabase functions deploy match-skills
```

### 5. Test the Function

```bash
supabase functions invoke match-skills \
  --body '{
    "desired_skills": ["JavaScript", "React", "TypeScript"],
    "limit": 5
  }'
```

## Usage

### Client-Side (TypeScript)

```typescript
import { matchingService } from '@/lib/services/matchingService'

// Find matches for multiple desired skills
const { data, error } = await matchingService.findMatches({
  desired_skills: ['JavaScript', 'React', 'TypeScript'],
  limit: 5,
  filters: {
    level: 'intermediate',
    max_credits: 10,
  },
})

if (data) {
  console.log(`Found ${data.matches.length} matches`)
  data.matches.forEach(match => {
    console.log(`${match.skill_name} - Similarity: ${match.similarity_score}`)
  })
}

// Find matches for a single skill
const { data: singleMatch } = await matchingService.findMatchesForSkill(
  'JavaScript',
  { level: 'beginner' },
  5
)
```

### React Hook (Recommended)

Create a custom hook for React components:

```typescript
import { useQuery } from '@tanstack/react-query'
import { matchingService } from '@/lib/services/matchingService'
import type { MatchSkillsRequest } from '@/types/matching.types'

export function useSkillMatches(request: MatchSkillsRequest) {
  return useQuery({
    queryKey: ['skill-matches', request],
    queryFn: () => matchingService.findMatches(request),
    enabled: request.desired_skills.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
```

## API Reference

### Edge Function: `match-skills`

**Endpoint**: `POST /functions/v1/match-skills`

**Headers**:
- `Authorization: Bearer <anon-key>` (or user token)
- `Content-Type: application/json`

**Request Body**:
```typescript
{
  desired_skills: string[]      // Required: Array of skill names/descriptions
  limit?: number                 // Optional: Number of matches (default: 5)
  user_id?: string              // Optional: Exclude user's own skills
  filters?: {
    level?: string              // Optional: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    category_id?: string        // Optional: Filter by category
    max_credits?: number        // Optional: Maximum credits required
  }
}
```

**Response**:
```typescript
{
  matches: SkillMatch[]         // Array of matched skills (sorted by similarity)
  total_available: number       // Total available skills that were considered
  processing_time_ms: number    // Processing time in milliseconds
}

// SkillMatch:
{
  skill_id: string
  skill_name: string
  skill_description: string | null
  teacher_name: string | null
  teacher_id: string
  similarity_score: number      // 0-1, higher = better match
  credits_required: number
  level: string
  category_name: string | null
}
```

## How It Works

1. **Input**: User provides desired skills (array of strings)
2. **Fetch**: Edge function fetches available active skills from database
3. **Embeddings**: Creates embeddings for:
   - Desired skills (combined into single query)
   - Each available skill (name + description)
4. **Similarity**: Calculates cosine similarity between query and each skill
5. **Ranking**: Sorts by similarity score (descending)
6. **Response**: Returns top N matches with metadata

## Performance Considerations

- **Batch Processing**: Skills are processed in batches of 100 for efficiency
- **Caching**: Consider caching results on client-side (5 minutes recommended)
- **Rate Limiting**: OpenAI API has rate limits (check your plan)
- **Cost**: `text-embedding-3-small` is cost-effective (~$0.02 per 1M tokens)

## Error Handling

The service returns errors in a consistent format:

```typescript
{
  data: null,
  error: Error | null
}
```

Common errors:
- `400`: Invalid request (missing desired_skills)
- `500`: OpenAI API error or database error
- Network errors: Handled by the service layer

## Testing

### Unit Tests (Recommended)

```typescript
import { matchingService } from '@/lib/services/matchingService'

describe('MatchingService', () => {
  it('should find matches for desired skills', async () => {
    const { data, error } = await matchingService.findMatches({
      desired_skills: ['JavaScript'],
      limit: 5,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.matches.length).toBeLessThanOrEqual(5)
  })
})
```

### Manual Testing

1. Ensure you have active skills in your database
2. Call the function with test data
3. Verify matches are relevant
4. Check similarity scores (should be 0-1, higher = better)

## Troubleshooting

### "OpenAI API key not configured"
- Set `OPENAI_API_KEY` secret in Supabase dashboard or CLI

### "Failed to fetch available skills"
- Check database connection
- Verify RLS policies allow reading skills
- Ensure skills table exists

### Low similarity scores
- Try more specific skill names
- Add descriptions to desired skills
- Check if available skills have descriptions

### Function timeout
- Reduce batch size if you have many skills
- Consider pagination or filtering before matching
- Check function timeout limits (default: 60s)

## Future Enhancements

- [ ] Caching embeddings in database
- [ ] Multi-factor ranking (similarity + reputation + credits)
- [ ] Personalization based on user history
- [ ] Batch matching for multiple users
- [ ] Streaming results for large datasets
