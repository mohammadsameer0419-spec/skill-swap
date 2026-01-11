import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreditExchange } from '@/types/skill.types'
import type { Profile } from '@/types/profile.types'
import { sendRequestSchema } from '@/lib/validations/skill.schema'
import { ExchangeStatus } from '@/types/skill.types'

/**
 * Query keys for requests/exchanges
 */
export const requestKeys = {
    all: ['requests'] as const,
    lists: () => [...requestKeys.all, 'list'] as const,
    list: (userId?: string, role?: 'learner' | 'teacher') =>
        [...requestKeys.lists(), userId, role] as const,
    details: () => [...requestKeys.all, 'detail'] as const,
    detail: (id: string) => [...requestKeys.details(), id] as const,
}

/**
 * Hook to send a skill exchange request
 * Includes optimistic updates for instant UI feedback
 */
export function useSendRequest() {
    const queryClient = useQueryClient()

    return useMutation<
        CreditExchange,
        Error,
        {
            learnerId: string
            teacherId: string
            skillId: string
            creditsAmount: number
        }
    >({
        mutationFn: async ({ learnerId, teacherId, skillId, creditsAmount }) => {
            // Validate with Zod
            const validatedData = sendRequestSchema.parse({
                skill_id: skillId,
                credits_amount: creditsAmount,
            })

            // Verify skill exists and is active
            const { data: skill, error: skillError } = await supabase
                .from('skills')
                .select('*')
                .eq('id', skillId)
                .single()

            if (skillError || !skill) {
                throw new Error('Skill not found')
            }

            if (skill.status !== 'active') {
                throw new Error('Cannot request an inactive skill')
            }

            if (skill.user_id !== teacherId) {
                throw new Error('Skill does not belong to the specified teacher')
            }

            if (skill.credits_required !== validatedData.credits_amount) {
                throw new Error(
                    `Credits amount must match skill requirement (${skill.credits_required} credits)`
                )
            }

            // Create the exchange request
            const { data: newRequest, error } = await supabase
                .from('credit_exchanges')
                .insert({
                    learner_id: learnerId,
                    teacher_id: teacherId,
                    skill_id: skillId,
                    credits_amount: validatedData.credits_amount,
                    status: ExchangeStatus.PENDING,
                })
                .select()
                .single()

            if (error) {
                throw new Error(`Failed to send request: ${error.message}`)
            }

            // Update skill requests count
            await supabase
                .from('skills')
                .update({ requests_count: skill.requests_count + 1 })
                .eq('id', skillId)

            return newRequest as CreditExchange
        },
        onMutate: async ({ learnerId, skillId }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: requestKeys.list(learnerId) })
            await queryClient.cancelQueries({ queryKey: ['profiles', learnerId] })

            // Snapshot the previous values for rollback
            const previousRequests = queryClient.getQueryData<CreditExchange[]>(
                requestKeys.list(learnerId)
            )
            const previousProfile = queryClient.getQueryData<Profile>([
                'profiles',
                learnerId,
            ])

            // Optimistically update requests list
            const optimisticRequest: CreditExchange = {
                id: `temp-${Date.now()}`,
                learner_id: learnerId,
                teacher_id: '',
                skill_id: skillId,
                credits_amount: 0,
                status: ExchangeStatus.PENDING,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }

            queryClient.setQueryData<CreditExchange[]>(
                requestKeys.list(learnerId),
                (old) => [...(old || []), optimisticRequest]
            )

            return { previousRequests, previousProfile }
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousRequests) {
                queryClient.setQueryData(
                    requestKeys.list(variables.learnerId),
                    context.previousRequests
                )
            }
            if (context?.previousProfile) {
                queryClient.setQueryData(
                    ['profiles', variables.learnerId],
                    context.previousProfile
                )
            }
        },
        onSuccess: (newRequest, variables) => {
            // Invalidate queries to refetch with real data
            queryClient.invalidateQueries({
                queryKey: requestKeys.list(variables.learnerId, 'learner'),
            })
            queryClient.invalidateQueries({
                queryKey: requestKeys.list(variables.teacherId, 'teacher'),
            })
            queryClient.invalidateQueries({ queryKey: ['skills'] })
        },
    })
}

/**
 * Hook to fetch user's exchange requests
 */
export function useUserRequests(
    userId: string | null,
    role?: 'learner' | 'teacher'
) {
    return useQuery<CreditExchange[], Error>({
        queryKey: requestKeys.list(userId || '', role),
        queryFn: async () => {
            if (!userId) {
                throw new Error('User ID is required')
            }

            let query = supabase
                .from('credit_exchanges')
                .select('*')
                .order('created_at', { ascending: false })

            if (role === 'learner') {
                query = query.eq('learner_id', userId)
            } else if (role === 'teacher') {
                query = query.eq('teacher_id', userId)
            } else {
                // Get all exchanges where user is either learner or teacher
                query = query.or(`learner_id.eq.${userId},teacher_id.eq.${userId}`)
            }

            const { data, error } = await query

            if (error) {
                throw new Error(`Failed to fetch requests: ${error.message}`)
            }

            return (data || []) as CreditExchange[]
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 2, // 2 minutes
    })
}

/**
 * Hook to update credits with optimistic updates
 */
export function useUpdateCredits() {
    const queryClient = useQueryClient()

    return useMutation<
        Profile,
        Error,
        { userId: string; credits: number; operation: 'add' | 'subtract' }
    >({
        mutationFn: async ({ userId, credits, operation }) => {
            // Get current profile
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (fetchError) {
                throw new Error('Profile not found')
            }

            const currentCredits = profile.credits || 0
            const newCredits =
                operation === 'add'
                    ? currentCredits + credits
                    : currentCredits - credits

            if (newCredits < 0) {
                throw new Error('Insufficient credits')
            }

            // Update credits
            const { data: updatedProfile, error } = await supabase
                .from('profiles')
                .update({ credits: newCredits })
                .eq('user_id', userId)
                .select()
                .single()

            if (error) {
                throw new Error(`Failed to update credits: ${error.message}`)
            }

            return updatedProfile as Profile
        },
        onMutate: async ({ userId, credits, operation }) => {
            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: ['profiles', userId] })

            // Snapshot previous value
            const previousProfile = queryClient.getQueryData<Profile>([
                'profiles',
                userId,
            ])

            // Optimistically update
            if (previousProfile) {
                const newCredits =
                    operation === 'add'
                        ? (previousProfile.credits || 0) + credits
                        : (previousProfile.credits || 0) - credits

                queryClient.setQueryData<Profile>(['profiles', userId], {
                    ...previousProfile,
                    credits: Math.max(0, newCredits),
                })
            }

            return { previousProfile }
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousProfile) {
                queryClient.setQueryData(
                    ['profiles', variables.userId],
                    context.previousProfile
                )
            }
        },
        onSuccess: (updatedProfile, variables) => {
            // Update cache with real data
            queryClient.setQueryData(['profiles', variables.userId], updatedProfile)
            queryClient.invalidateQueries({ queryKey: ['profiles', variables.userId] })
        },
    })
}
