import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Target,
    Coins,
    Clock,
    User,
    Sparkles,
    CheckCircle,
    XCircle,
    AlertCircle,
    BookOpen,
} from 'lucide-react'
import { bountyService } from '@/lib/services/bountyService'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { BountyRoadmapDialog } from './BountyRoadmapDialog'
import { useState } from 'react'
import type { BountyDifficulty } from '@/types/bounty.types'

interface BountyBoardProps {
    limit?: number
    categoryId?: string | null
    difficultyLevel?: BountyDifficulty | null
}

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: 'bg-green-500',
    intermediate: 'bg-blue-500',
    advanced: 'bg-purple-500',
    expert: 'bg-red-500',
}

/**
 * Bounty Board Component
 * Displays available bounties that Level 3+ users can claim
 */
export function BountyBoard({ limit = 20, categoryId, difficultyLevel }: BountyBoardProps) {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()
    const [selectedBountyForRoadmap, setSelectedBountyForRoadmap] = useState<{
        title: string
        level: string | null
    } | null>(null)

    const {
        data: bounties,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['bounties', 'available', limit, categoryId, difficultyLevel],
        queryFn: async () => {
            const result = await bountyService.getAvailableBounties(limit, 0, categoryId, difficultyLevel)
            if (result.error) throw result.error
            return result.data
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    })

    const claimMutation = useMutation({
        mutationFn: (bountyId: string) => bountyService.claimBounty(bountyId),
        onSuccess: (sessionId, bountyId) => {
            toast.success('Bounty claimed! A skill session has been created.')
            // Invalidate queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ['bounties'] })
            queryClient.invalidateQueries({ queryKey: ['skill-sessions'] })
            queryClient.invalidateQueries({ queryKey: ['credit-balance'] })
        },
        onError: (error: Error) => {
            toast.error(`Failed to claim bounty: ${error.message}`)
        },
    })

    const canClaim = profile && ['skilled', 'advanced', 'expert'].includes(profile.level)

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Bounty Board</CardTitle>
                    <CardDescription>Loading bounties...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-32 w-full" />
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
                    <CardTitle>Bounty Board</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-destructive">Failed to load bounties</p>
                </CardContent>
            </Card>
        )
    }

    if (!bounties || bounties.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Bounty Board
                    </CardTitle>
                    <CardDescription>Learning requests from the community</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                        <Target className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No bounties available</h3>
                        <p className="text-sm text-muted-foreground">
                            Check back later for new learning requests!
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-primary" />
                            Bounty Board
                        </CardTitle>
                        <CardDescription>
                            Learning requests from the community. Level 3+ users can claim to earn credits.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                        {bounties.length} available
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {bounties.map((bounty) => {
                        const initials = bounty.poster_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2) || 'A'

                        const timeAgo = formatDistanceToNow(new Date(bounty.created_at), { addSuffix: true })

                        return (
                            <div
                                key={bounty.id}
                                className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors bg-card w-full"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                    {/* Poster Avatar */}
                                    <Avatar className="h-10 w-10 flex-shrink-0">
                                        <AvatarImage src={bounty.poster_avatar_url || undefined} alt={bounty.poster_name} />
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>

                                    {/* Bounty Content */}
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-base mb-1 break-words">{bounty.title}</h3>
                                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                                                    <div className="flex items-center gap-1">
                                                        <User className="w-3 h-3 flex-shrink-0" />
                                                        <span className="break-words">{bounty.poster_name}</span>
                                                    </div>
                                                    <span className="hidden sm:inline">•</span>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                        <span>{timeAgo}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Credits Badge */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Badge variant="default" className="text-sm font-semibold px-3 py-1 whitespace-nowrap">
                                                    <Coins className="w-3 h-3 mr-1" />
                                                    {bounty.credits_offered}
                                                </Badge>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {bounty.description}
                                        </p>

                                        {/* Tags and Metadata */}
                                        <div className="flex items-center gap-2 flex-wrap mb-3">
                                            {bounty.category_name && (
                                                <Badge variant="outline" className="text-xs">
                                                    {bounty.category_name}
                                                </Badge>
                                            )}
                                            {bounty.difficulty_level && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-xs',
                                                        DIFFICULTY_COLORS[bounty.difficulty_level] && 'text-white',
                                                        DIFFICULTY_COLORS[bounty.difficulty_level]
                                                    )}
                                                >
                                                    {bounty.difficulty_level}
                                                </Badge>
                                            )}
                                            {bounty.skill_tags && bounty.skill_tags.length > 0 && (
                                                <>
                                                    {bounty.skill_tags.slice(0, 3).map((tag, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                            <Sparkles className="w-3 h-3 mr-1" />
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                    {bounty.skill_tags.length > 3 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            +{bounty.skill_tags.length - 3} more
                                                        </Badge>
                                                    )}
                                                </>
                                            )}
                                            {bounty.expires_at && (
                                                <Badge variant="outline" className="text-xs text-orange-600">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    Expires {formatDistanceToNow(new Date(bounty.expires_at), { addSuffix: true })}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedBountyForRoadmap({
                                                    title: bounty.title,
                                                    level: bounty.difficulty_level || null,
                                                })}
                                                className="w-full sm:flex-1 sm:w-auto"
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Generate Roadmap
                                            </Button>
                                            {canClaim && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => claimMutation.mutate(bounty.id)}
                                                    disabled={claimMutation.isPending}
                                                    className="w-full sm:flex-1 sm:w-auto"
                                                >
                                                    {claimMutation.isPending ? (
                                                        <>
                                                            <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                                                            Claiming...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="w-4 h-4 mr-2" />
                                                            Claim Bounty
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                        {!canClaim && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                                <XCircle className="w-4 h-4 flex-shrink-0" />
                                                <span>Level 3+ required to claim bounties</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>

            {/* Roadmap Dialog */}
            {selectedBountyForRoadmap && (
                <BountyRoadmapDialog
                    open={!!selectedBountyForRoadmap}
                    onOpenChange={(open) => !open && setSelectedBountyForRoadmap(null)}
                    skillName={selectedBountyForRoadmap.title}
                    currentLevel={selectedBountyForRoadmap.level || undefined}
                />
            )}
        </Card>
    )
}
