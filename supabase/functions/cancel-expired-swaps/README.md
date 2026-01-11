# Cancel Expired Swaps Edge Function

## Overview

This Edge Function cancels expired pending/reserved credit transactions that are older than 24 hours and where the session hasn't been accepted yet.

## Purpose

This function serves as an alternative to the pg_cron job in environments where PostgreSQL cron is not available. It calls the `cancel_expired_pending_swaps()` RPC function to:

- Find all pending/reserved transactions with `expires_at < NOW()`
- Only cancel transactions where the session status is still 'requested' (not accepted)
- Update the transaction status to 'cancelled'
- Unlock the reserved credits

## Setup

1. Deploy the function:
   ```bash
   supabase functions deploy cancel-expired-swaps
   ```

2. Set up a scheduled invocation. Options:
   - **Vercel Cron**: Add to `vercel.json`:
     ```json
     {
       "crons": [{
         "path": "/api/cancel-expired-swaps",
         "schedule": "0 * * * *"
       }]
     }
     ```
   
   - **GitHub Actions**: Create a workflow that calls the function hourly
   
   - **External Cron Service**: Use services like cron-job.org to call the function URL hourly
   
   - **Supabase Cron** (if available): Use Supabase's built-in cron functionality

## Usage

### Manual Invocation

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/cancel-expired-swaps \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Response

```json
{
  "success": true,
  "cancelled_count": 3,
  "cancelled_transaction_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Environment Variables

The function uses the following environment variables (automatically provided by Supabase):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

## Scheduling

**Recommended**: Schedule this function to run every hour (cron: `0 * * * *`)

This ensures that expired transactions are cancelled promptly, releasing reserved credits back to users.

## Error Handling

The function will:
- Return a 500 error if the RPC call fails
- Log errors to the console for debugging
- Continue processing even if individual cancellations fail (handled by RPC function)

## Notes

- The function uses the `service_role` key to bypass RLS policies
- Only transactions with expired `expires_at` timestamps are cancelled
- Only sessions with status 'requested' are affected (accepted sessions are not cancelled)
- The RPC function handles locking and atomicity internally
