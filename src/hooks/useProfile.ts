import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/profile.types'

/**
 * Hook to fetch user profile with React Query
 */
export function useProfile(userId: string | null | undefined) {
    return useQuery<Profile, Error>({
        queryKey: ['profiles', userId],
        queryFn: async () => {
            if (!userId) {
                throw new Error('User ID is required')
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                // If profile doesn't exist, create one
                if (error.code === 'PGRST116') {
                    const { data: newProfile, error: createError } = await supabase
                        .from('profiles')
                        .insert({
                            user_id: userId,
                            username: null,
                            credits: 10, // Initial credits
                        })
                        .select()
                        .single()

                    if (createError) {
                        throw new Error(`Failed to create profile: ${createError.message}`)
                    }

                    return newProfile as Profile
                }

                throw new Error(`Failed to fetch profile: ${error.message}`)
            }

            return data as Profile
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
