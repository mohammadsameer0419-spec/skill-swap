import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface TrendingSkill {
  skill_id: string
  skill_name: string
  category_name: string | null
  requests_count: number
  teacher_name: string | null
  teacher_id: string
  credits_required: number
  level: string
}

interface TrendingSkillsMarqueeProps {
  limit?: number
  days?: number
}

/**
 * Trending Skills Marquee Component
 * Displays a scrolling marquee of trending skills
 */
export function TrendingSkillsMarquee({ limit = 20, days = 7 }: TrendingSkillsMarqueeProps) {
  const {
    data: trendingSkills,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trending-skills', days, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trending_skills', {
        p_limit: limit,
        p_days: days,
      } as any)

      if (error) throw error
      return (data || []) as TrendingSkill[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 10, // Refetch every 10 minutes
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 flex-shrink-0" />
        ))}
      </div>
    )
  }

  if (error || !trendingSkills || trendingSkills.length === 0) {
    return null // Hide if no data
  }

  // Duplicate skills for seamless loop
  const duplicatedSkills = [...trendingSkills, ...trendingSkills]

  return (
    <div className="relative overflow-hidden border-y border-border bg-muted/30 py-4">
      <div className="flex items-center gap-2 mb-2 px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span>Trending Skills</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          Last {days} days
        </Badge>
      </div>
      
      <div className="relative flex overflow-hidden">
        {/* First set - scrolling left */}
        <div className="flex animate-marquee gap-4 whitespace-nowrap will-change-transform">
          {duplicatedSkills.map((skill, index) => (
            <div
              key={`${skill.skill_id}-${index}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border shadow-sm hover:shadow-md transition-shadow flex-shrink-0"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-sm font-medium">{skill.skill_name}</span>
              {skill.category_name && (
                <Badge variant="outline" className="text-xs">
                  {skill.category_name}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {skill.requests_count} requests
              </Badge>
            </div>
          ))}
        </div>
        
        {/* Second set - for seamless loop */}
        <div className="flex animate-marquee gap-4 whitespace-nowrap absolute left-full will-change-transform">
          {duplicatedSkills.map((skill, index) => (
            <div
              key={`${skill.skill_id}-duplicate-${index}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border shadow-sm hover:shadow-md transition-shadow flex-shrink-0"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-sm font-medium">{skill.skill_name}</span>
              {skill.category_name && (
                <Badge variant="outline" className="text-xs">
                  {skill.category_name}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {skill.requests_count} requests
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
