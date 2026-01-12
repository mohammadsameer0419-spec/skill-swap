# Environment Variables Setup for Vercel

## Client-Side Variables (Set in Vercel)

These variables are used in your React app (client-side) and **must be prefixed with `VITE_`** for Vite to expose them.

### Required Variables:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional (if using Stream Video):

```bash
VITE_STREAM_API_KEY=your_stream_api_key
VITE_STREAM_TOKEN=your_stream_token
```

## How to Set in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Click **Add New**
4. For each variable:
   - **Key**: Enter the variable name (e.g., `VITE_SUPABASE_URL`)
   - **Value**: Paste your value
   - **Environment**: Select all environments (Production, Preview, Development) or as needed
   - Click **Save**

## Important Notes:

- **VITE_ prefix is required** - Vite only exposes environment variables prefixed with `VITE_` to the client code
- **Never commit `.env` files** - They're gitignored for security
- **Supabase Edge Functions** use different variables (set in Supabase Dashboard, not Vercel):
  - `OPENAI_API_KEY` (for embeddings & roadmap generation)
  - `STREAM_API_KEY` (for Stream Video tokens)
  - `STREAM_API_SECRET` (for Stream Video tokens)

## Quick Setup Steps:

1. Open your local `.env.local` file in your text editor
2. Copy all variables that start with `VITE_`
3. Go to Vercel Project > Settings > Environment Variables
4. Paste each `VITE_*` variable as a separate entry
5. Make sure to select the correct environments (Production, Preview, Development)

## Finding Your Supabase Keys:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`
