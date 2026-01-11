# Get Stream Token Edge Function

## Overview

This Edge Function generates Stream Video tokens for authenticated users. It verifies user authentication, optionally checks class attendance, and generates a secure JWT token for Stream Video SDK.

## Purpose

- **Security**: Keeps Stream API secret on the server (never exposed to client)
- **Authentication**: Verifies user is authenticated via Supabase JWT
- **Authorization**: Optionally verifies user has access to a specific live class
- **Token Generation**: Creates secure JWT tokens for Stream Video SDK

## Setup

1. **Set Environment Variables** in Supabase Dashboard:
   - `STREAM_API_KEY` - Your Stream Video API key
   - `STREAM_API_SECRET` - Your Stream Video API secret

2. **Deploy the function**:
   ```bash
   supabase functions deploy get-stream-token
   ```

## Usage

### Request

```typescript
// With classId (recommended - verifies attendance)
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/get-stream-token',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseSession.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      classId: 'uuid-of-live-class', // Optional
    }),
  }
)

const { token, user_id, profile_id, expires_at } = await response.json()
```

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "auth-users-uuid",
  "profile_id": "profiles-uuid",
  "expires_at": "2024-01-02T12:00:00.000Z"
}
```

### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized. Please authenticate."
}
```

**403 Forbidden** (no class access):
```json
{
  "error": "You do not have access to this class. Please reserve your spot first."
}
```

**404 Not Found** (profile not found):
```json
{
  "error": "User profile not found"
}
```

## Authentication Flow

1. **JWT Verification**: Function verifies the Supabase JWT token from the Authorization header
2. **Profile Lookup**: Fetches user's profile to get `profile_id` (used as Stream user_id)
3. **Optional Attendance Check**: If `classId` is provided:
   - Checks `live_class_attendance` table for 'reserved' or 'paid' status
   - Verifies user is either the host or has valid attendance
   - Ensures class is in a joinable state ('scheduled' or 'live')
4. **Token Generation**: Creates JWT token signed with Stream API secret

## Token Details

- **Expiration**: 24 hours
- **User ID**: Uses `profile.id` as Stream user_id (not `user.id`)
- **Algorithm**: HS256 (HMAC SHA-256)
- **Payload**: Contains `user_id`, `exp`, `iat`

## Security Notes

- ✅ Stream API secret is never exposed to the client
- ✅ JWT tokens are verified server-side
- ✅ Class access is verified before token generation
- ✅ Tokens expire after 24 hours
- ⚠️ Always use HTTPS in production
- ⚠️ Store Stream credentials as environment variables (never commit to git)

## Integration with LiveClassRoom Component

```typescript
// In your LiveClassRoom component
useEffect(() => {
  const fetchStreamToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stream-token`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: classId, // Verify attendance
        }),
      }
    )

    if (response.ok) {
      const { token } = await response.json()
      // Use token to initialize Stream client
      const client = new StreamVideoClient({
        apiKey: import.meta.env.VITE_STREAM_API_KEY,
        user: { id: profile.id, name: profile.full_name },
        token: token,
      })
    }
  }

  fetchStreamToken()
}, [classId, profile])
```

## Testing

### Test with curl:

```bash
# Get your Supabase session token first, then:
curl -X POST \
  https://your-project.supabase.co/functions/v1/get-stream-token \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"classId": "optional-class-uuid"}'
```

## Environment Variables

Required in Supabase Dashboard:
- `STREAM_API_KEY` - Stream Video API key
- `STREAM_API_SECRET` - Stream Video API secret

Automatically provided by Supabase:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
