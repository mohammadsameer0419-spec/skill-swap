import { supabase } from '../supabase'
import type {
  LiveClass,
  LiveClassWithHost,
  Participant,
  CompleteLiveClassResponse,
} from '@/types/live-class.types'

/**
 * Live Class Service
 * Manages live class operations including joining, leaving, and completing classes
 */
export class LiveClassService {
  private readonly classesTable = 'live_classes'
  private readonly attendanceTable = 'live_class_attendance'

  /**
   * Get a live class by ID with host profile
   */
  async getClassById(classId: string): Promise<LiveClassWithHost | null> {
    const { data, error } = await supabase
      .from(this.classesTable)
      .select(
        `
        *,
        host_profile:profiles!live_classes_host_id_fkey(
          id,
          username,
          full_name,
          avatar_url,
          level
        )
      `
      )
      .eq('id', classId)
      .single()

    if (error) {
      console.error('Error fetching live class:', error)
      return null
    }

    return data as LiveClassWithHost
  }

  /**
   * Get participants for a live class with their profiles
   */
  async getParticipants(classId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from(this.attendanceTable)
      .select(
        `
        user_id,
        paid_status,
        joined_at,
        profile:profiles!live_class_attendance_user_id_fkey(
          id,
          user_id,
          username,
          full_name,
          avatar_url,
          level
        )
      `
      )
      .eq('class_id', classId)
      .in('paid_status', ['reserved', 'paid'])

    if (error) {
      console.error('Error fetching participants:', error)
      return []
    }

    return (data || []).map((item: any) => ({
      user_id: item.profile.user_id,
      profile_id: item.profile.id,
      username: item.profile.username,
      full_name: item.profile.full_name,
      avatar_url: item.profile.avatar_url,
      level: item.profile.level,
      joined_at: item.joined_at,
      paid_status: item.paid_status,
    }))
  }

  /**
   * Check if user is the host
   */
  async isHost(classId: string, profileId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.classesTable)
      .select('host_id')
      .eq('id', classId)
      .eq('host_id', profileId)
      .single()

    if (error) {
      return false
    }

    return !!data
  }

  /**
   * Check if user has reserved attendance
   */
  async hasReservedAttendance(
    classId: string,
    profileId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.attendanceTable)
      .select('paid_status')
      .eq('class_id', classId)
      .eq('user_id', profileId)
      .eq('paid_status', 'reserved')
      .single()

    if (error) {
      return false
    }

    return !!data
  }

  /**
   * Complete a live class (transfer credits)
   */
  async completeClass(
    classId: string
  ): Promise<CompleteLiveClassResponse | null> {
    const { data, error } = await supabase.rpc('complete_live_class', {
      p_class_id: classId,
    } as any)

    if (error) {
      console.error('Error completing live class:', error)
      return null
    }

    return data as CompleteLiveClassResponse
  }

  /**
   * Update class status
   */
  async updateClassStatus(
    classId: string,
    status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    const { error } = await supabase
      .from(this.classesTable)
      .update({ status })
      .eq('id', classId)

    if (error) {
      console.error('Error updating class status:', error)
      return false
    }

    return true
  }
}

export const liveClassService = new LiveClassService()
