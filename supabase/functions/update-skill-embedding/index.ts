// Supabase Edge Function: Update Skill Embedding
// Generates OpenAI embedding for a skill and stores it in the database
// Should be called when a skill is created or updated

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_EMBEDDINGS_MODEL = 'text-embedding-3-small'

interface UpdateEmbeddingRequest {
  skill_id: string
  name: string
  description?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role for admin operations
    )

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const requestData: UpdateEmbeddingRequest = await req.json()

    if (!requestData.skill_id || !requestData.name) {
      return new Response(
        JSON.stringify({ error: 'skill_id and name are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare text for embedding (name + description)
    const textParts = [requestData.name]
    if (requestData.description) {
      textParts.push(requestData.description)
    }
    const text = textParts.join(' - ')

    // Create embedding
    const embedding = await createEmbedding(text, OPENAI_API_KEY)

    // Store embedding in database using RPC function
    const { data, error } = await supabaseClient.rpc('update_skill_embedding', {
      p_skill_id: requestData.skill_id,
      p_embedding_json: embedding, // Pass array directly, Supabase converts to JSONB
    })

    if (error) {
      console.error('Error updating embedding:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update embedding', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, skill_id: requestData.skill_id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in update-skill-embedding function:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

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
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}
