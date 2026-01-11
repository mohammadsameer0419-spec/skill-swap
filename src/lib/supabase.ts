import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env.local file contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
    )
}

/**
 * Database schema types (extend this based on your actual database schema)
 */
interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    user_id: string
                    username: string | null
                    full_name: string | null
                    avatar_url: string | null
                    bio: string | null
                    credits: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    username?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    bio?: string | null
                    credits?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    username?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    bio?: string | null
                    credits?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            skills: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    category: string | null
                    level: string
                    status: string
                    credits_required: number
                    requests_count: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    category?: string | null
                    level: string
                    status?: string
                    credits_required: number
                    requests_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    category?: string | null
                    level?: string
                    status?: string
                    credits_required?: number
                    requests_count?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            credit_exchanges: {
                Row: {
                    id: string
                    learner_id: string
                    teacher_id: string
                    skill_id: string
                    credits_amount: number
                    status: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    learner_id: string
                    teacher_id: string
                    skill_id: string
                    credits_amount: number
                    status?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    learner_id?: string
                    teacher_id?: string
                    skill_id?: string
                    credits_amount?: number
                    status?: string
                    created_at?: string
                    updated_at?: string
                }
            }
        }
    }
}

// Create and export the Supabase client with proper typing
export const supabase: SupabaseClient<Database> = createClient<Database>(
    supabaseUrl,
    supabaseAnonKey
)
