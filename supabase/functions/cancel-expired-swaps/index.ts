// Supabase Edge Function: Cancel Expired Swaps
// Alternative to pg_cron for environments where cron is not available
// This function should be called periodically (e.g., via external cron service, Vercel Cron, etc.)

import { corsHeaders } from '../_shared/cors.ts'

/**
 * Cancel expired pending/reserved swaps
 * 
 * This Edge Function calls the cancel_expired_pending_swaps() RPC function
 * which finds and cancels all transactions that have expired (>24 hours)
 * where the session hasn't been accepted yet.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Import Supabase client for Deno
    const { createClient } = await import(
      `https://esm.sh/@supabase/supabase-js@2.39.0`
    )

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Call the RPC function to cancel expired swaps
    const { data, error } = await supabase.rpc('cancel_expired_pending_swaps')

    if (error) {
      console.error('Error cancelling expired swaps:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to cancel expired swaps',
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result = Array.isArray(data) && data.length > 0 ? data[0] : data

    return new Response(
      JSON.stringify({
        success: true,
        cancelled_count: result?.cancelled_count || 0,
        cancelled_transaction_ids: result?.cancelled_transaction_ids || [],
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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
