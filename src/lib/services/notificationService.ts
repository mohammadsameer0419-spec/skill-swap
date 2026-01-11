import { supabase } from '../supabase'
import type { Notification, CreateNotificationData } from '@/types/notification.types'

/**
 * Notification Service
 * Handles notification operations and real-time subscriptions
 */
export class NotificationService {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(
    userId: string,
    limit: number = 50
  ): Promise<{ data: Notification[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch notifications: ${error.message}`),
        }
      }

      return {
        data: data as Notification[],
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
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<{ data: number | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to get unread count: ${error.message}`),
        }
      }

      return {
        data: data as number,
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
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<{ data: boolean | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to mark as read: ${error.message}`),
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
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ data: number | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: userId,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to mark all as read: ${error.message}`),
        }
      }

      return {
        data: data as number,
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
   * Create a notification (admin/system use)
   */
  async createNotification(
    notificationData: CreateNotificationData
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: notificationData.user_id,
        p_type: notificationData.type,
        p_title: notificationData.title,
        p_message: notificationData.message,
        p_related_id: notificationData.related_id || null,
        p_related_type: notificationData.related_type || null,
        p_metadata: notificationData.metadata || {},
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to create notification: ${error.message}`),
        }
      }

      return {
        data: data as string,
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
   * Subscribe to real-time notifications for a user
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}

export const notificationService = new NotificationService()
