/**
 * Notification types matching database schema
 */
export type NotificationType =
  | 'class_starting_soon'
  | 'new_skill_match'
  | 'level_up'
  | 'credit_transaction'
  | 'session_request'
  | 'session_accepted'
  | 'session_completed'
  | 'review_received'

/**
 * Notification interface matching database schema
 */
export interface Notification {
  id: string
  user_id: string // profiles.user_id (auth.users.id)
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  related_type: string | null
  is_read: boolean
  read_at: string | null
  metadata: Record<string, any>
  created_at: string
}

/**
 * Notification with formatted data for UI
 */
export interface NotificationWithFormatted extends Notification {
  formattedDate: string
  icon: string
  color: string
}

/**
 * Create notification data
 */
export interface CreateNotificationData {
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_id?: string | null
  related_type?: string | null
  metadata?: Record<string, any>
}
