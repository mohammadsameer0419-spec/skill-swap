// Supabase Edge Function: AI-Powered Skill Matching
// Uses OpenAI embeddings with pgvector for efficient database-side similarity search

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_EMBEDDINGS_MODEL = 'text-embedding-3-small'

interface MatchRequest {
    user_id?: string
    desired_skills: string[] // Array of skill names/descriptions user wants to learn
    limit?: number // Number of matches to return (default: 5)
    filters?: {
        level?: string
        category_id?: string
        max_credits?: number
    }
}

interface SkillMatch {
    skill_id: string
    skill_name: string
    skill_description: string | null
    teacher_name: string | null
    teacher_id: string
    similarity_score: number
    credits_required: number
    level: string
    category_name: string | null
}

interface MatchResponse {
    matches: SkillMatch[]
    total_available: number
    processing_time_ms: number
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

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
        const requestData: MatchRequest = await req.json()

        // Validate request
        if (!requestData.desired_skills || !Array.isArray(requestData.desired_skills) || requestData.desired_skills.length === 0) {
            return new Response(
                JSON.stringify({ error: 'desired_skills array is required and cannot be empty' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        const limit = requestData.limit || 5
        const startTime = Date.now()

        // Get user_id from auth if not provided
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()
        const userId = requestData.user_id || user?.id

        // Prepare text for embedding (combine desired skills into query)
        const queryText = requestData.desired_skills.join(', ')

        // Create embedding for desired skills (query)
        const queryEmbedding = await createEmbedding(queryText, OPENAI_API_KEY)

        // Use pgvector function to find similar skills directly in the database
        // This is much more efficient than fetching all skills
        const { data: matches, error: matchesError } = await supabaseClient.rpc(
            'find_similar_skills',
            {
                p_query_embedding_json: queryEmbedding, // Pass array directly, Supabase converts to JSONB
                p_limit: limit,
                p_user_id: userId || null,
                p_level: requestData.filters?.level || null,
                p_category_id: requestData.filters?.category_id || null,
                p_max_credits: requestData.filters?.max_credits || null,
            }
        )

        if (matchesError) {
            console.error('Error finding similar skills:', matchesError)
            return new Response(
                JSON.stringify({ error: 'Failed to find similar skills', details: matchesError.message }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Get total count of available skills (for metadata)
        // This is optional - can be removed if not needed for performance
        let totalAvailable = 0
        try {
            let countQuery = supabaseClient
                .from('skills')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'active')
                .not('embedding', 'is', null)

            if (userId) {
                countQuery = countQuery.neq('user_id', userId)
            }
            if (requestData.filters?.level) {
                countQuery = countQuery.eq('level', requestData.filters.level)
            }
            if (requestData.filters?.category_id) {
                countQuery = countQuery.eq('category_id', requestData.filters.category_id)
            }
            if (requestData.filters?.max_credits) {
                countQuery = countQuery.lte('credits_required', requestData.filters.max_credits)
            }

            const { count } = await countQuery
            totalAvailable = count || 0
        } catch (error) {
            // If count fails, continue without it
            console.warn('Failed to get total count:', error)
        }

        // Format response
        const formattedMatches: SkillMatch[] = (matches || []).map((match: any) => ({
            skill_id: match.skill_id,
            skill_name: match.skill_name,
            skill_description: match.skill_description,
            teacher_name: match.teacher_name,
            teacher_id: match.teacher_id,
            similarity_score: match.similarity_score,
            credits_required: match.credits_required,
            level: match.level,
            category_name: match.category_name,
        }))

        const response: MatchResponse = {
            matches: formattedMatches,
            total_available: totalAvailable,
            processing_time_ms: Date.now() - startTime,
        }

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error in match-skills function:', error)
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
 * Create embedding for a single text using OpenAI API
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
