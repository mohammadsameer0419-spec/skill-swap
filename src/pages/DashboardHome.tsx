import { useQuery } from '@tanstack/react-query'
import { StatsCards } from '@/components/stats-cards'
import { TopExperts } from '@/components/TopExperts'
import { TrendingSkillsMarquee } from '@/components/TrendingSkillsMarquee'
import { BountyBoard } from '@/components/BountyBoard'
import { CreateBountyDialog } from '@/components/CreateBountyDialog'
import { useAuth } from '@/hooks/useAuth'
import { useCreditBalance } from '@/hooks/useCreditBalance'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Award, Target, Plus } from 'lucide-react'
import { useState } from 'react'

/**
 * Dashboard Home Page
 * Shows stats, top experts, and trending skills
 */
export function DashboardHome() {
  const { user, profile } = useAuth()
  const { data: creditBalance } = useCreditBalance(user?.id)
  const { data: userProfile } = useProfile(user?.id)
  const [createBountyOpen, setCreateBountyOpen] = useState(false)

  // Get user's primary field/category
  const {
    data: primaryField,
    isLoading: isLoadingField,
  } = useQuery({
    queryKey: ['user-primary-field', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase.rpc('get_user_primary_field', {
        p_user_id: user.id,
      } as any)

      if (error) {
        console.error('Error fetching primary field:', error)
        return null
      }

      return (data && data.length > 0) ? data[0] : null
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  // Calculate stats from real data
  const stats = [
    {
      label: 'Available Credits',
      value: creditBalance?.available?.toString() || '0',
      change: `${creditBalance?.reserved || 0} reserved`,
      icon: 'Coins' as const,
      trend: 'neutral' as const,
    },
    {
      label: 'Completed Sessions',
      value: userProfile?.completed_sessions?.toString() || '0',
      change: `${userProfile?.total_reviews || 0} reviews`,
      icon: 'Users' as const,
      trend: 'up' as const,
    },
    {
      label: 'Reputation Score',
      value: userProfile?.reputation_score?.toFixed(1) || '0.0',
      change: `Level ${userProfile?.level || 'beginner'}`,
      icon: 'TrendingUp' as const,
      trend: 'up' as const,
    },
    {
      label: 'Current Level',
      value: (userProfile?.level || 'beginner').charAt(0).toUpperCase() + (userProfile?.level || 'beginner').slice(1),
      change: `${userProfile?.completed_sessions || 0} sessions completed`,
      icon: 'Award' as const,
      trend: 'up' as const,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Trending Skills Marquee */}
      <TrendingSkillsMarquee limit={20} days={7} />

      {/* Stats Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <StatsCards stats={stats} />
      </div>

      {/* Top Experts and Bounty Board Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoadingField ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : (
          <TopExperts
            categoryId={primaryField?.category_id || null}
            fieldName={primaryField?.category_name || undefined}
            limit={10}
          />
        )}

        {/* Bounty Board */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Bounty Board</h2>
            <Button
              onClick={() => setCreateBountyOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Post Bounty
            </Button>
          </div>
          <BountyBoard limit={5} />
        </div>
      </div>

      {/* Create Bounty Dialog */}
      <CreateBountyDialog
        open={createBountyOpen}
        onOpenChange={setCreateBountyOpen}
      />
    </div>
  )
}
