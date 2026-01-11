import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@/lib/services/notificationService'
import { toast } from 'sonner'
import type { Notification } from '@/types/notification.types'

/**
 * Hook to fetch and manage notifications
 */
export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient()

  // Fetch notifications
  const {
    data: notifications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return null
      const result = await notificationService.getNotifications(userId)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Fetch unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: async () => {
      if (!userId) return 0
      const result = await notificationService.getUnreadCount(userId)
      if (result.error) return 0
      return result.data || 0
    },
    enabled: !!userId,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread', userId] })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('User ID required')
      return notificationService.markAllAsRead(userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread', userId] })
    },
  })

  // Real-time subscription
  useEffect(() => {
    if (!userId) return

    const unsubscribe = notificationService.subscribeToNotifications(userId, (notification) => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread', userId] })

      // Show toast for certain notification types
      if (notification.type === 'credit_transaction') {
        const metadata = notification.metadata || {}
        if (metadata.type === 'earned') {
          toast.success(notification.title, {
            description: notification.message,
          })
        } else if (metadata.type === 'spent') {
          toast.info(notification.title, {
            description: notification.message,
          })
        }
      } else if (notification.type === 'level_up') {
        toast.success(notification.title, {
          description: notification.message,
          duration: 5000,
        })
      } else if (notification.type === 'class_starting_soon') {
        toast.warning(notification.title, {
          description: notification.message,
          duration: 10000,
        })
      } else if (notification.type === 'new_skill_match') {
        toast.info(notification.title, {
          description: notification.message,
        })
      }
    })

    return unsubscribe
  }, [userId, queryClient])

  return {
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
    isLoading,
    error,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  }
}
