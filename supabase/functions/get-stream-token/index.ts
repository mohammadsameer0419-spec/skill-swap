// Supabase Edge Function: Get Stream Token
// Generates a Stream Video token for authenticated users
// Verifies user authentication and optionally checks class attendance

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts'

const STREAM_API_KEY = Deno.env.get('STREAM_API_KEY')
const STREAM_API_SECRET = Deno.env.get('STREAM_API_SECRET')

interface GetStreamTokenRequest {
  classId?: string // Optional: class ID to verify attendance
}

interface GetStreamTokenResponse {
  token: string
  user_id: string
  profile_id: string
  expires_at: string
}

/**
 * Generate Stream Video token
 * Stream tokens are JWT tokens signed with the Stream API secret
 */
async function generateStreamToken(
  userId: string,
  profileId: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  // Stream token payload structure
  // Use profile_id as Stream user_id (not auth.users user_id)
  const payload = {
    user_id: profileId,
  }

  // Create JWT token using jose library
  const secret = new TextEncoder().encode(apiSecret)
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  return token
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate Stream API credentials
    if (!STREAM_API_KEY || !STREAM_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Stream API credentials not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    })

    // Step 1: Verify JWT - Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please authenticate.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Step 2: Get user's profile to get profile_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Step 3: Optional - Check class attendance if classId is provided
    const requestData: GetStreamTokenRequest = await req.json().catch(() => ({}))
    
    if (requestData.classId) {
      // Check if user has reserved or paid attendance for this class
      const { data: attendance, error: attendanceError } = await supabaseClient
        .from('live_class_attendance')
        .select('paid_status, class_id')
        .eq('class_id', requestData.classId)
        .eq('user_id', profile.id) // Use profile.id (not user.id)
        .in('paid_status', ['reserved', 'paid'])
        .single()

      if (attendanceError || !attendance) {
        return new Response(
          JSON.stringify({
            error: 'You do not have access to this class. Please reserve your spot first.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Additional check: Verify user is either the host or has valid attendance
      const { data: liveClass, error: classError } = await supabaseClient
        .from('live_classes')
        .select('host_id, status')
        .eq('id', requestData.classId)
        .single()

      if (!classError && liveClass) {
        const isHost = liveClass.host_id === profile.id
        const isAttendee = !!attendance

        if (!isHost && !isAttendee) {
          return new Response(
            JSON.stringify({
              error: 'You do not have permission to join this class.',
            }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        // Check if class is in a joinable state
        if (!isHost && !['scheduled', 'live'].includes(liveClass.status)) {
          return new Response(
            JSON.stringify({
              error: 'This class is not available for joining.',
            }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      }
    }

    // Step 4: Generate Stream token
    const token = await generateStreamToken(
      user.id, // auth.users user_id
      profile.id, // profiles.id (used as Stream user_id)
      STREAM_API_KEY,
      STREAM_API_SECRET
    )

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const response: GetStreamTokenResponse = {
      token,
      user_id: user.id,
      profile_id: profile.id,
      expires_at: expiresAt,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error generating Stream token:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
