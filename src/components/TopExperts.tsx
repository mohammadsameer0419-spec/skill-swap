import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Award, Star, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface TopExpert {
  user_id: string
  profile_id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  reputation_score: number
  completed_sessions: number
  total_reviews: number
  level: string
  primary_skill_category: string | null
}

interface TopExpertsProps {
  categoryId?: string | null
  fieldName?: string
  limit?: number
}

/**
 * Top Experts Component
 * Displays Level 5 users with highest reputation in a specific field
 */
export function TopExperts({ categoryId, fieldName, limit = 10 }: TopExpertsProps) {
  const { user } = useAuth()

  const {
    data: experts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['top-experts', categoryId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_experts', {
        p_limit: limit,
        p_category_id: categoryId || null,
      } as any)

      if (error) throw error
      return (data || []) as TopExpert[]
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Experts{fieldName ? ` in ${fieldName}` : ''}</CardTitle>
          <CardDescription>Loading experts...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Experts{fieldName ? ` in ${fieldName}` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load experts</p>
        </CardContent>
      </Card>
    )
  }

  if (!experts || experts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Experts{fieldName ? ` in ${fieldName}` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No experts found yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <CardTitle>Top Experts{fieldName ? ` in ${fieldName}` : ''}</CardTitle>
        </div>
        <CardDescription>
          Level 5 experts with the highest reputation scores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {experts.map((expert, index) => {
            const displayName = expert.full_name || expert.username || 'Unknown'
            const initials = displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'U'

            return (
              <div
                key={expert.user_id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  {index < 3 ? (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                          ? 'bg-gray-400 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {index + 1}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="h-12 w-12">
                  <AvatarImage src={expert.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{displayName}</p>
                    <Badge variant="secondary" className="text-xs">
                      Expert
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{expert.reputation_score.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{expert.completed_sessions} sessions</span>
                    </div>
                    {expert.primary_skill_category && (
                      <Badge variant="outline" className="text-xs">
                        {expert.primary_skill_category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
