// Supabase Edge Function: Generate Embedding
// Generates an OpenAI embedding for a given text.
// This is a lightweight function used by the matching hook to generate query embeddings.

import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_EMBEDDINGS_MODEL = 'text-embedding-3-small' // Fast and cost-effective

interface GenerateEmbeddingRequest {
  text: string
}

interface GenerateEmbeddingResponse {
  embedding: number[]
}

/**
 * Create embedding for text using OpenAI API
 */
async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDINGS_MODEL,
      input: text,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate OpenAI API key
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const requestData: GenerateEmbeddingRequest = await req.json()

    // Validate request
    if (!requestData.text || typeof requestData.text !== 'string' || requestData.text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'text is required and must be a non-empty string' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate embedding
    const embedding = await createEmbedding(requestData.text, OPENAI_API_KEY)

    const response: GenerateEmbeddingResponse = {
      embedding,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
