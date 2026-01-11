import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import { Check, CheckCheck, Bell, TrendingUp, CreditCard, Users, Award, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/notification.types'

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Get icon and color for notification type
 */
function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'level_up':
      return { icon: Award, color: 'text-yellow-500' }
    case 'credit_transaction':
      return { icon: CreditCard, color: 'text-green-500' }
    case 'class_starting_soon':
      return { icon: Bell, color: 'text-orange-500' }
    case 'new_skill_match':
      return { icon: Zap, color: 'text-blue-500' }
    case 'session_request':
    case 'session_accepted':
    case 'session_completed':
      return { icon: Users, color: 'text-purple-500' }
    case 'review_received':
      return { icon: TrendingUp, color: 'text-pink-500' }
    default:
      return { icon: Bell, color: 'text-gray-500' }
  }
}

/**
 * Notification Center Component
 * Displays all notifications with real-time updates
 */
export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const { user } = useAuth()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications(user?.id)

  const handleMarkAllAsRead = () => {
    if (user?.id) {
      markAllAsRead()
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    // TODO: Navigate to related content if needed
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                  : 'All caught up!'}
              </DialogDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Bell className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-lg">✓</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                You're all set! When you have new notifications, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const { icon: Icon, color } = getNotificationIcon(notification.type)

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      notification.is_read
                        ? 'bg-background hover:bg-muted/50'
                        : 'bg-muted/50 hover:bg-muted border-primary/20'
                    )}
                  >
                    <div className={cn('flex-shrink-0 mt-0.5', color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            !notification.is_read && 'font-semibold'
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {notification.is_read && (
                      <Check className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
