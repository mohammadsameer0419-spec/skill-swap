import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, TrendingUp, Award, Star } from "lucide-react"
import { useLevelProgress } from "@/hooks/useGrowth"
import { useAuth } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserLevel } from "@/types/growth.types"

/**
 * Level name mapping with display colors
 */
const LEVEL_INFO: Record<UserLevel, { name: string; color: string; icon: any }> = {
  beginner: { name: 'Beginner', color: 'bg-gray-500', icon: Star },
  learner: { name: 'Learner', color: 'bg-blue-500', icon: TrendingUp },
  skilled: { name: 'Skilled', color: 'bg-green-500', icon: Award },
  advanced: { name: 'Advanced', color: 'bg-purple-500', icon: Trophy },
  expert: { name: 'Expert', color: 'bg-yellow-500', icon: Trophy },
}

/**
 * Level Display Component
 * Shows user's current level and progress toward next level
 */
export function LevelDisplay() {
  const { user } = useAuth()
  const { data: progress, isLoading, error } = useLevelProgress(user?.id)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Level Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load level progress</p>
        </CardContent>
      </Card>
    )
  }

  const levelInfo = LEVEL_INFO[progress.current_level]
  const LevelIcon = levelInfo.icon
  const nextLevelInfo = progress.next_level ? LEVEL_INFO[progress.next_level] : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LevelIcon className="w-5 h-5" />
          <CardTitle>Level: {levelInfo.name}</CardTitle>
          <Badge className={levelInfo.color}>{progress.current_level.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {progress.is_max_level ? (
          <div className="text-center py-4">
            <Trophy className="w-12 h-12 mx-auto text-yellow-500 mb-2" />
            <p className="font-semibold text-lg">Maximum Level Reached!</p>
            <p className="text-sm text-muted-foreground mt-1">
              You've achieved Expert status
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress to {nextLevelInfo?.name}</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress.progress_percentage)}%
                </span>
              </div>
              <Progress value={progress.progress_percentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sessions</span>
                  <span className="text-xs font-medium">
                    {progress.completed_sessions} / {progress.completed_sessions + progress.sessions_needed}
                  </span>
                </div>
                <Progress 
                  value={progress.sessions_progress} 
                  className="h-1.5" 
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Rating</span>
                  <span className="text-xs font-medium">
                    {progress.reputation_score.toFixed(1)} / {(progress.reputation_score + progress.rating_needed).toFixed(1)}
                  </span>
                </div>
                <Progress 
                  value={progress.rating_progress} 
                  className="h-1.5" 
                />
              </div>
            </div>

            {progress.sessions_needed > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                {progress.sessions_needed} more session{progress.sessions_needed !== 1 ? 's' : ''} and{' '}
                {progress.rating_needed.toFixed(1)} higher rating to reach {nextLevelInfo?.name}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
