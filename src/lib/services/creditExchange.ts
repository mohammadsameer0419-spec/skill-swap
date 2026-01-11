import { supabase } from '../supabase'

/**
 * Response type from handle_skill_exchange RPC function
 */
export interface SkillExchangeResponse {
  success: boolean
  learner_id: string
  teacher_id: string
  learner_new_credits?: number
  teacher_new_credits?: number
  message?: string
  error?: string
}

/**
 * Service function to call the handle_skill_exchange RPC
 * 
 * @param learnerId - UUID of the learner (will lose 1 credit)
 * @param teacherId - UUID of the teacher (will gain 1 credit)
 * @returns Promise with exchange response
 */
export async function handleSkillExchange(
  learnerId: string,
  teacherId: string
): Promise<SkillExchangeResponse> {
  try {
    const { data, error } = await supabase.rpc('handle_skill_exchange', {
      learner_id: learnerId,
      teacher_id: teacherId,
    })

    if (error) {
      throw new Error(error.message)
    }

    return data as SkillExchangeResponse
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Failed to execute skill exchange')
  }
}
