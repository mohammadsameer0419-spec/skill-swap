/**
 * Types for Live Classes Feature
 */

/**
 * Live class status enum
 */
export type LiveClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

/**
 * Paid status for attendance
 */
export type PaidStatus = 'reserved' | 'paid' | 'refunded' | 'cancelled'

/**
 * Live class interface
 */
export interface LiveClass {
  id: string
  host_id: string
  title: string
  description: string | null
  subject_id: string | null
  scheduled_at: string
  duration_minutes: number
  credit_cost: number
  max_attendees: number
  meeting_id: string | null
  status: LiveClassStatus
  created_at: string
  updated_at: string
}

/**
 * Live class attendance interface
 */
export interface LiveClassAttendance {
  class_id: string
  user_id: string
  paid_status: PaidStatus
  joined_at: string | null
  left_at: string | null
  attendance_duration_minutes: number
  credit_transaction_id: string | null
  created_at: string
}

/**
 * Live class with host profile
 */
export interface LiveClassWithHost extends LiveClass {
  host_profile: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    level: string
  }
}

/**
 * Participant with profile info
 */
export interface Participant {
  user_id: string
  profile_id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  level: string
  joined_at: string | null
  paid_status: PaidStatus
}

/**
 * Complete live class response
 */
export interface CompleteLiveClassResponse {
  class_id: string
  completed_attendees: number
  total_credits_transferred: number
}
