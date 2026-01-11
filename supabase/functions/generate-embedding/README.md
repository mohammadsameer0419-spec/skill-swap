# Generate Embedding Edge Function

Server-side OpenAI embedding generation for semantic skill matching.

## Overview

This Edge Function generates embeddings for user search queries using OpenAI's API. It keeps the OpenAI API key secure on the server and offloads the heavy computation from the user's browser.

## Features

- **Secure**: OpenAI API key stored server-side in environment variables
- **Fast**: Uses `text-embedding-3-small` model for cost-effective, fast embeddings
- **Scalable**: Runs on Supabase Edge Functions (Deno runtime) with automatic scaling
- **Offloaded**: Heavy embedding computation happens server-side, not in the browser

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
supabase functions deploy generate-embedding
```

## Usage

### Request

```typescript
POST /functions/v1/generate-embedding
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "JavaScript, React, TypeScript"
}
```

### Response

```typescript
{
  "embedding": [0.123, -0.456, 0.789, ...] // 1536-dimensional vector
}
```

## Integration

This function is called by the `useSkillMatches` hook before calling the `find_similar_skills` RPC function:

```typescript
// In useSkillMatches hook
const searchEmbeddings = await generateEmbedding(memoizedParams.desired_skills)
const { data } = await supabase.rpc('find_similar_skills', {
  p_query_embedding_json: searchEmbeddings,
  // ... other params
})
```

## Error Handling

- **400**: Invalid request (missing or empty text)
- **500**: Server error (OpenAI API key not configured, API error, etc.)

## Performance

- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Cost**: ~$0.00002 per 1K tokens
- **Latency**: Typically 100-300ms per request
- **Scalability**: Automatic scaling with Supabase Edge Functions

## Security

- OpenAI API key is never exposed to the client
- All embedding generation happens server-side
- Authentication required via Supabase Auth
