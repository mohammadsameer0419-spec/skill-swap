/**
 * React Hook for AI-Powered Skill Matching
 * Uses TanStack Query for caching and state management
 * Calls Supabase RPC function with pgvector for semantic similarity
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useMemo } from 'react'
import type { MatchParams, SkillMatch } from '@/types/matching.types'

/**
 * Generate embedding for query text using Edge Function
 * This keeps the OpenAI API key secure on the server
 */
async function generateEmbedding(queryText: string | string[]): Promise<number[]> {
  // Handle both string and string[] for flexibility
  const text = Array.isArray(queryText) ? queryText.join(', ') : queryText
  
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { text },
  })

  if (error) {
    throw new Error(`Failed to generate embedding: ${error.message}`)
  }

  if (!data || !data.embedding) {
    throw new Error('No embedding returned from server')
  }

  return data.embedding
}

/**
 * React Query hook for finding matching skills
 * Calls Supabase RPC function with pgvector for semantic similarity
 * 
 * @param params - Matching parameters with desired skills and filters
 * @returns Query result with matches
 */
export const useSkillMatches = (params: MatchParams) => {
  // Memoize the parameters to prevent unnecessary re-renders/fetches
  // Using JSON.stringify for deep comparison of nested objects
  const memoizedParams = useMemo(() => params, [
    JSON.stringify(params.desired_skills),
    JSON.stringify(params.filters),
    params.limit,
  ])

  // Check if we have desired skills to search for
  const hasDesiredSkills = memoizedParams.desired_skills.length > 0

  return useQuery({
    // The queryKey must include all variables that change the result
    queryKey: ['skill-matches', memoizedParams],
    queryFn: async () => {
      const startTime = Date.now()

      // Generate embedding for desired skills
      const searchEmbeddings = await generateEmbedding(memoizedParams.desired_skills)

      // Call RPC function to find similar skills using pgvector
      // Note: Using find_similar_skills which is our existing RPC function
      // If you have match_skills_v2, replace the function name and parameters accordingly
      const { data, error } = await supabase.rpc('find_similar_skills', {
        p_query_embedding_json: searchEmbeddings, // Vectorized search
        p_limit: memoizedParams.limit || 5,
        p_user_id: null, // Can be added to params if needed
        p_level: memoizedParams.filters?.level || null,
        p_category_id: memoizedParams.filters?.category_id || null,
        p_max_credits: memoizedParams.filters?.max_credits || null,
      } as any)

      if (error) throw error

      const processingTimeMs = Date.now() - startTime

      // Transform the response to match the expected format
      const matches = (data || []) as SkillMatch[]

      return {
        matches,
        total_available: matches.length,
        processing_time_ms: processingTimeMs,
      }
    },
    enabled: hasDesiredSkills, // Only run query if we have desired skills
    staleTime: 1000 * 60 * 5, // Keep data fresh for 5 minutes (Professional Cache)
  })
}

/**
 * React Query hook for finding matches for a single skill
 * Convenience wrapper around useSkillMatches
 * 
 * @param desiredSkill - Skill name or description
 * @param filters - Optional filters
 * @param limit - Number of matches to return (default: 5)
 * @returns Query result with matches
 */
export function useSkillMatchesForSkill(
  desiredSkill: string | null,
  filters?: MatchParams['filters'],
  limit: number = 5
) {
  const params = useMemo<MatchParams | null>(
    () =>
      desiredSkill
        ? {
            desired_skills: [desiredSkill],
            filters,
            limit,
          }
        : null,
    [desiredSkill, JSON.stringify(filters), limit]
  )

  // If no skill provided, return a disabled query
  if (!params) {
    return useQuery({
      queryKey: ['skill-matches', null],
      queryFn: async () => {
        throw new Error('No skill provided')
      },
      enabled: false,
    })
  }

  return useSkillMatches(params)
}
