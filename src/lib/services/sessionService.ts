import { supabase } from '../supabase'
import type {
  SkillSession,
  SkillSessionWithDetails,
  SessionStatus,
  CreateSessionRequestData,
  ScheduleSessionData,
  CancelSessionData,
  SessionFilters,
  SessionResponse,
} from '@/types/session.types'

/**
 * Session Service - Full Lifecycle Management
 * 
 * Manages skill sessions from request to completion/cancellation.
 * Integrates with credit system for locking/unlocking credits.
 */
export class SessionService {
  private readonly sessionsTable = 'skill_sessions'

  /**
   * Create a session request
   * Creates session and locks credits for the learner
   * 
   * @param data - Session request data
   * @returns Promise with session ID
   */
  async createRequest(
    data: CreateSessionRequestData
  ): Promise<SessionResponse<string>> {
    try {
      // Validate inputs
      if (!data.learner_id || !data.teacher_id || !data.skill_id) {
        return {
          data: null,
          error: new Error('learner_id, teacher_id, and skill_id are required'),
        }
      }

      if (data.learner_id === data.teacher_id) {
        return {
          data: null,
          error: new Error('Learner and teacher cannot be the same user'),
        }
      }

      // Call RPC function to create session and lock credits
      const { data: sessionId, error } = await supabase.rpc(
        'create_session_request',
        {
          p_learner_id: data.learner_id,
          p_teacher_id: data.teacher_id,
          p_skill_id: data.skill_id,
        } as any
      )

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to create session request: ${error.message}`),
        }
      }

      return {
        data: sessionId as string,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Accept a session request
   * Teacher accepts the learner's request
   * 
   * @param sessionId - Session ID
   * @param teacherId - Teacher's user ID
   * @returns Promise with success status
   */
  async acceptRequest(
    sessionId: string,
    teacherId: string
  ): Promise<SessionResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('accept_session_request', {
        p_session_id: sessionId,
        p_teacher_id: teacherId,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to accept session: ${error.message}`),
        }
      }

      return {
        data: data as boolean,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Schedule a session
   * Set the time for the session
   * 
   * @param data - Schedule session data
   * @returns Promise with success status
   */
  async schedule(data: ScheduleSessionData): Promise<SessionResponse<boolean>> {
    try {
      // Validate scheduled time is in the future
      const scheduledAt = new Date(data.scheduled_at)
      if (scheduledAt <= new Date()) {
        return {
          data: null,
          error: new Error('Scheduled time must be in the future'),
        }
      }

      const { data: result, error } = await supabase.rpc('schedule_session', {
        p_session_id: data.session_id,
        p_scheduled_at: data.scheduled_at,
        p_user_id: data.user_id,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to schedule session: ${error.message}`),
        }
      }

      return {
        data: result as boolean,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Start a session
   * Mark session as in progress
   * 
   * @param sessionId - Session ID
   * @param userId - User ID (learner or teacher)
   * @returns Promise with success status
   */
  async start(sessionId: string, userId: string): Promise<SessionResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('start_session', {
        p_session_id: sessionId,
        p_user_id: userId,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to start session: ${error.message}`),
        }
      }

      return {
        data: data as boolean,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Complete a session
   * Transfers credits from learner to teacher and unlocks any locked credits
   * 
   * @param sessionId - Session ID
   * @param userId - User ID (learner or teacher)
   * @returns Promise with completion result including credit balances
   */
  async complete(
    sessionId: string,
    userId: string
  ): Promise<
    SessionResponse<{
      learner_balance: number
      teacher_balance: number
      spend_transaction_id: string
      earn_transaction_id: string
    }>
  > {
    try {
      const { data, error } = await supabase.rpc('complete_session', {
        p_session_id: sessionId,
        p_user_id: userId,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to complete session: ${error.message}`),
        }
      }

      return {
        data: data as {
          learner_balance: number
          teacher_balance: number
          spend_transaction_id: string
          earn_transaction_id: string
        },
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Cancel a session
   * Unlocks credits and marks session as cancelled
   * 
   * @param data - Cancel session data
   * @returns Promise with cancellation result
   */
  async cancel(
    data: CancelSessionData
  ): Promise<SessionResponse<{ session_id: string; status: string }>> {
    try {
      const { data: result, error } = await supabase.rpc('cancel_session', {
        p_session_id: data.session_id,
        p_user_id: data.user_id,
        p_reason: data.reason || null,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to cancel session: ${error.message}`),
        }
      }

      return {
        data: result as { session_id: string; status: string },
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Get a single session by ID
   * 
   * @param sessionId - Session ID
   * @returns Promise with session data
   */
  async getById(sessionId: string): Promise<SessionResponse<SkillSession>> {
    try {
      const { data, error } = await supabase
        .from(this.sessionsTable)
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch session: ${error.message}`),
        }
      }

      return {
        data: data as SkillSession,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Get session with related data (skill, learner, teacher)
   * 
   * @param sessionId - Session ID
   * @returns Promise with session and related data
   */
  async getByIdWithDetails(
    sessionId: string
  ): Promise<SessionResponse<SkillSessionWithDetails>> {
    try {
      const { data, error } = await supabase
        .from(this.sessionsTable)
        .select(
          `
          *,
          skill:skills(id, name, description, level),
          learner:profiles!skill_sessions_learner_id_fkey(user_id, username, full_name, avatar_url),
          teacher:profiles!skill_sessions_teacher_id_fkey(user_id, username, full_name, avatar_url)
        `
        )
        .eq('id', sessionId)
        .single()

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch session: ${error.message}`),
        }
      }

      return {
        data: data as SkillSessionWithDetails,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Get sessions with filters
   * 
   * @param filters - Session filters
   * @returns Promise with array of sessions
   */
  async getSessions(
    filters?: SessionFilters
  ): Promise<SessionResponse<SkillSession[]>> {
    try {
      let query = supabase
        .from(this.sessionsTable)
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.learner_id) {
        query = query.eq('learner_id', filters.learner_id)
      }

      if (filters?.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id)
      }

      if (filters?.skill_id) {
        query = query.eq('skill_id', filters.skill_id)
      }

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      // Get sessions where user is either learner or teacher
      if (filters?.user_id && !filters.learner_id && !filters.teacher_id) {
        query = query.or(`learner_id.eq.${filters.user_id},teacher_id.eq.${filters.user_id}`)
      }

      const { data, error } = await query

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch sessions: ${error.message}`),
        }
      }

      return {
        data: (data || []) as SkillSession[],
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Get sessions with details (joined with related tables)
   * 
   * @param filters - Session filters
   * @returns Promise with array of sessions with details
   */
  async getSessionsWithDetails(
    filters?: SessionFilters
  ): Promise<SessionResponse<SkillSessionWithDetails[]>> {
    try {
      let query = supabase
        .from(this.sessionsTable)
        .select(
          `
          *,
          skill:skills(id, name, description, level),
          learner:profiles!skill_sessions_learner_id_fkey(user_id, username, full_name, avatar_url),
          teacher:profiles!skill_sessions_teacher_id_fkey(user_id, username, full_name, avatar_url)
        `
        )
        .order('created_at', { ascending: false })

      // Apply filters (same as getSessions)
      if (filters?.learner_id) {
        query = query.eq('learner_id', filters.learner_id)
      }

      if (filters?.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id)
      }

      if (filters?.skill_id) {
        query = query.eq('skill_id', filters.skill_id)
      }

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      if (filters?.user_id && !filters.learner_id && !filters.teacher_id) {
        query = query.or(`learner_id.eq.${filters.user_id},teacher_id.eq.${filters.user_id}`)
      }

      const { data, error } = await query

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch sessions: ${error.message}`),
        }
      }

      return {
        data: (data || []) as SkillSessionWithDetails[],
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Update session status (manual update - use with caution)
   * Prefer using the specific lifecycle methods (accept, start, complete, etc.)
   * 
   * @param sessionId - Session ID
   * @param status - New status
   * @param userId - User ID (must be learner or teacher)
   * @returns Promise with updated session
   */
  async updateStatus(
    sessionId: string,
    status: SessionStatus,
    userId: string
  ): Promise<SessionResponse<SkillSession>> {
    try {
      // Verify user is participant
      const sessionResponse = await this.getById(sessionId)
      if (sessionResponse.error || !sessionResponse.data) {
        return {
          data: null,
          error: new Error('Session not found'),
        }
      }

      const session = sessionResponse.data
      if (session.learner_id !== userId && session.teacher_id !== userId) {
        return {
          data: null,
          error: new Error('Only participants can update session status'),
        }
      }

      const { data, error } = await supabase
        .from(this.sessionsTable)
        .update({ status })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to update session: ${error.message}`),
        }
      }

      return {
        data: data as SkillSession,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService()

// Export convenience functions
export const createRequest = (data: CreateSessionRequestData) =>
  sessionService.createRequest(data)
export const acceptRequest = (sessionId: string, teacherId: string) =>
  sessionService.acceptRequest(sessionId, teacherId)
export const schedule = (data: ScheduleSessionData) => sessionService.schedule(data)
export const start = (sessionId: string, userId: string) =>
  sessionService.start(sessionId, userId)
export const complete = (sessionId: string, userId: string) =>
  sessionService.complete(sessionId, userId)
export const cancel = (data: CancelSessionData) => sessionService.cancel(data)
export const getSessionById = (sessionId: string) => sessionService.getById(sessionId)
export const getSessionByIdWithDetails = (sessionId: string) =>
  sessionService.getByIdWithDetails(sessionId)
export const getSessions = (filters?: SessionFilters) =>
  sessionService.getSessions(filters)
export const getSessionsWithDetails = (filters?: SessionFilters) =>
  sessionService.getSessionsWithDetails(filters)
