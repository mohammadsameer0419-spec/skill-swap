import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftRight, Search, User } from "lucide-react"
import { useSkillMatches } from "@/hooks/useSkillMatches"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

interface MatchSuggestionsAIProps {
    desiredSkills: string[]
    limit?: number
    filters?: {
        level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
        category_id?: string
        max_credits?: number
    }
    onBroadenSearch?: () => void
}

/**
 * Skeleton loader for match cards
 */
function MatchCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                </div>
            </CardContent>
            <CardFooter className="gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-24" />
            </CardFooter>
        </Card>
    )
}

/**
 * Individual match card component
 */
function MatchCard({ match, user, onRequestSession }: {
    match: {
        skill_id: string
        skill_name: string
        skill_description: string | null
        teacher_name: string | null
        teacher_id: string
        similarity_score: number
        credits_required: number
        level: string
        category_name: string | null
    }
    user?: { id: string } | null
    onRequestSession?: (skillId: string, teacherId: string) => void
}) {
    const teacherInitials = match.teacher_name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "UT"

    return (
        <Card className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback>{teacherInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold line-clamp-1">
                            {match.teacher_name || 'Unknown Teacher'}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            {match.category_name || 'General'}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                            {match.skill_name}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                            {match.level}
                        </Badge>
                    </div>
                    {match.skill_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {match.skill_description}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                        {match.credits_required} credits
                    </Badge>
                    {match.similarity_score && (
                        <Badge variant="outline" className="text-xs">
                            {Math.round(match.similarity_score * 100)}% match
                        </Badge>
                    )}
                </div>
            </CardContent>

            <CardFooter className="gap-2 pt-0">
                <Button
                    size="sm"
                    className="flex-1"
                    disabled={match.teacher_id === user?.id}
                    onClick={() => onRequestSession?.(match.skill_id, match.teacher_id)}
                >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Request
                </Button>
                <Button variant="outline" size="sm">
                    <User className="w-4 h-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}

export function MatchSuggestionsAI({
    desiredSkills,
    limit = 5,
    filters,
    onBroadenSearch
}: MatchSuggestionsAIProps) {
    const { user } = useAuth()

    // Only call the hook if we have desired skills
    const { data, isLoading, error } = useSkillMatches({
        desired_skills: desiredSkills.length > 0 ? desiredSkills : [],
        limit,
        filters,
    })

    // Loading state with skeleton loaders
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium">AI Match Suggestions</h2>
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: limit || 5 }).map((_, index) => (
                        <MatchCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium">AI Match Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <p className="text-destructive mb-2">Failed to load matches</p>
                        <p className="text-sm text-muted-foreground">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Empty state - no matches found
    if (!isLoading && data?.matches.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium">AI Match Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
                        <div className="mb-4">
                            <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No matches found</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Try adding more skills to your profile to find better matches!
                        </p>
                        {onBroadenSearch && (
                            <Button
                                variant="outline"
                                className="mt-2"
                                onClick={onBroadenSearch}
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Broaden your search
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // No desired skills provided
    if (!desiredSkills || desiredSkills.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium">AI Match Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
                        <div className="mb-4">
                            <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Get started with matches</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enter skills you want to learn to see AI-powered matches
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Try adding more skills to your profile to find better matches!
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Render matches in grid layout
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">AI Match Suggestions</h2>
                <Badge variant="secondary" className="text-xs">
                    {data?.matches.length || 0} matches
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data?.matches.map((match) => (
                    <MatchCard
                        key={match.skill_id}
                        match={match}
                        user={user}
                        onRequestSession={(skillId, teacherId) => {
                            // Handle session request
                            toast.success(`Requesting session with ${match.teacher_name}`)
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
