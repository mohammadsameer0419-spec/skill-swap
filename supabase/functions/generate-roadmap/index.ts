// Supabase Edge Function: Generate AI Roadmap
// Uses OpenAI to generate a 4-week learning path and maps it to database resources

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface GenerateRoadmapRequest {
  skill_name: string
  current_level: string
  user_id?: string
}

interface RoadmapStep {
  week: number
  title: string
  description: string
  learning_objectives: string[]
  estimated_hours: number
  keywords: string[] // Keywords for resource matching
}

interface AIRoadmap {
  skill_name: string
  current_level: string
  target_level: string
  duration_weeks: number
  total_hours: number
  steps: RoadmapStep[]
}

/**
 * Generate AI roadmap using OpenAI
 */
async function generateRoadmapWithAI(
  skillName: string,
  currentLevel: string
): Promise<AIRoadmap> {
  const prompt = `You are an expert learning path designer. Generate a comprehensive 4-week learning roadmap for learning "${skillName}" starting from "${currentLevel}" level.

Requirements:
- 4 weeks total
- Each week should have: title, description, learning objectives (3-5 bullet points), estimated hours (5-15 hours per week)
- Include 5-7 keywords per week for matching learning resources
- Progress from ${currentLevel} level to the next level up
- Make it practical and actionable

Return ONLY valid JSON in this exact format:
{
  "skill_name": "${skillName}",
  "current_level": "${currentLevel}",
  "target_level": "next_level_here",
  "duration_weeks": 4,
  "total_hours": 40,
  "steps": [
    {
      "week": 1,
      "title": "Week 1 Title",
      "description": "Week 1 description",
      "learning_objectives": ["objective 1", "objective 2", "objective 3"],
      "estimated_hours": 10,
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
    }
  ]
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a learning path expert. Always return valid JSON only, no markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content returned from OpenAI')
  }

  // Parse JSON response (remove markdown code blocks if present)
  const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const roadmap = JSON.parse(jsonContent) as AIRoadmap

  return roadmap
}

/**
 * Map roadmap steps to database resources
 */
async function mapResourcesToSteps(
  roadmap: AIRoadmap,
  supabaseClient: any
): Promise<any> {
  const mappedSteps = await Promise.all(
    roadmap.steps.map(async (step) => {
      // Search for resources matching keywords
      const { data: resources, error } = await supabaseClient
        .from('learning_resources')
        .select('id, title, url, resource_type, duration_minutes, thumbnail_url')
        .eq('is_featured', true) // Only featured resources for now
        .limit(5)

      if (error) {
        console.error('Error fetching resources:', error)
      }

      // Simple keyword matching (in production, use pgvector for semantic matching)
      const matchedResources = (resources || []).filter((resource: any) => {
        const searchText = `${resource.title} ${step.keywords.join(' ')}`.toLowerCase()
        return step.keywords.some((keyword) => searchText.includes(keyword.toLowerCase()))
      }).slice(0, 3) // Limit to 3 resources per step

      return {
        ...step,
        mapped_resources: matchedResources.map((r: any) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          resource_type: r.resource_type,
          duration_minutes: r.duration_minutes,
          thumbnail_url: r.thumbnail_url,
        })),
      }
    })
  )

  return {
    ...roadmap,
    steps: mappedSteps,
  }
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

    // Validate Supabase config
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request
    const requestData: GenerateRoadmapRequest = await req.json()

    if (!requestData.skill_name || !requestData.current_level) {
      return new Response(
        JSON.stringify({ error: 'skill_name and current_level are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate roadmap with AI
    const roadmap = await generateRoadmapWithAI(
      requestData.skill_name,
      requestData.current_level
    )

    // Map resources to steps
    const roadmapWithResources = await mapResourcesToSteps(roadmap, supabaseClient)

    return new Response(
      JSON.stringify({
        roadmap: roadmapWithResources,
        success: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating roadmap:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate roadmap',
        message: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
