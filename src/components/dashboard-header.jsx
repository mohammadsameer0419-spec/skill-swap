import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, Plus } from "lucide-react"
import { NotificationCenter } from "@/components/NotificationCenter"
import { useNotifications } from "@/hooks/useNotifications"
import { useAuth } from "@/hooks/useAuth"

export function DashboardHeader() {
  const { user } = useAuth()
  const { unreadCount } = useNotifications(user?.id)
  const [notificationOpen, setNotificationOpen] = useState(false)

  return (
    <>
      <header
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground">Skill Swap</span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            <a href="/dashboard" className="text-sm font-medium text-foreground">
              Dashboard
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse Skills
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Messages
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Schedule
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="hidden sm:flex bg-transparent">
              <Plus className="w-4 h-4 mr-2" />
              Add Skill
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotificationOpen(true)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-semibold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarImage src="/student-avatar.png" alt="User" />
              <AvatarFallback>AJ</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <NotificationCenter
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
      />
    </>
  );
}
