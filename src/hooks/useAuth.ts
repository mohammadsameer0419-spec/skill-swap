import { useEffect, useState } from 'react'
import { useSessionContext, useUser } from '@supabase/auth-helpers-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/profile.types'

/**
 * Custom hook for authentication and user profile management
 * Uses @supabase/auth-helpers-react for session management
 */
export function useAuth() {
    const { session, isLoading: isSessionLoading } = useSessionContext()
    const user = useUser()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Fetch user profile when user changes
    useEffect(() => {
        if (!user?.id) {
            setProfile(null)
            return
        }

        const fetchProfile = async () => {
            setIsLoadingProfile(true)
            setError(null)

            try {
                const { data, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (fetchError) {
                    // If profile doesn't exist, create one
                    if (fetchError.code === 'PGRST116') {
                        const { data: newProfile, error: createError } = await supabase
                            .from('profiles')
                            .insert({
                                user_id: user.id,
                                username: user.email?.split('@')[0] || null,
                                credits: 10, // Initial credits for new users
                            })
                            .select()
                            .single()

                        if (createError) {
                            throw createError
                        }

                        setProfile(newProfile as Profile)
                    } else {
                        throw fetchError
                    }
                } else {
                    setProfile(data as Profile)
                }
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err
                        : new Error('Failed to fetch user profile')
                )
            } finally {
                setIsLoadingProfile(false)
            }
        }

        fetchProfile()
    }, [user?.id])

    const signOut = async () => {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) {
            setError(signOutError)
        }
        setProfile(null)
    }

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user?.id || !profile) {
            throw new Error('User not authenticated')
        }

        setIsLoadingProfile(true)
        setError(null)

        try {
            const { data, error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('user_id', user.id)
                .select()
                .single()

            if (updateError) {
                throw updateError
            }

            setProfile(data as Profile)
            return data as Profile
        } catch (err) {
            const error =
                err instanceof Error ? err : new Error('Failed to update profile')
            setError(error)
            throw error
        } finally {
            setIsLoadingProfile(false)
        }
    }

    return {
        user,
        profile,
        session,
        isLoading: isSessionLoading || isLoadingProfile,
        isAuthenticated: !!user && !!session,
        error,
        signOut,
        updateProfile,
        refreshProfile: async () => {
            if (user?.id) {
                setIsLoadingProfile(true)
                try {
                    const { data, error: fetchError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', user.id)
                        .single()

                    if (fetchError) {
                        throw fetchError
                    }

                    setProfile(data as Profile)
                } catch (err) {
                    setError(
                        err instanceof Error
                            ? err
                            : new Error('Failed to refresh profile')
                    )
                } finally {
                    setIsLoadingProfile(false)
                }
            }
        },
    }
}
