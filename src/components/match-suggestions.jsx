import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftRight } from "lucide-react"
import { useSkills } from "@/hooks/useSkills"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

export function MatchSuggestions() {
  const { skills, isLoading, exchangeMutation } = useSkills()
  const { user } = useAuth()

  const handleSwap = (teacherId, skillName) => {
    if (!user?.id) {
      toast.error("Please sign in to exchange skills")
      return
    }

    exchangeMutation.mutate(
      {
        learnerId: user.id,
        teacherId: teacherId,
      },
      {
        onSuccess: (data) => {
          toast.success(`Successfully exchanged credits for ${skillName}!`)
        },
        onError: (error) => {
          toast.error(error.message || "Failed to exchange credits")
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-medium">Match Suggestions</CardTitle>
        <Button variant="ghost" size="sm">
          Browse All
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading skills...
          </div>
        ) : skills && skills.length > 0 ? (
          skills.map((skill) => {
            const teacher = skill.teacher_profile
            const teacherName = teacher?.full_name || teacher?.username || "Unknown Teacher"
            const teacherInitials = teacherName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "UT"

            return (
              <div
                key={skill.id}
                className="p-4 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={teacher?.avatar_url || undefined}
                      alt={teacherName} />
                    <AvatarFallback>{teacherInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{teacherName}</p>
                      <Badge variant="secondary" className="text-xs">
                        {skill.credits_required} credits
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-muted-foreground">Teaches:</span>
                      <span className="text-foreground">{skill.name}</span>
                    </div>
                    {skill.description && (
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span className="text-muted-foreground text-xs">
                          {skill.description}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSwap(skill.user_id, skill.name)}
                        disabled={
                          exchangeMutation.isPending ||
                          skill.user_id === user?.id
                        }>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        {exchangeMutation.isPending ? "Swapping..." : "Swap"}
                      </Button>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
            <div className="mb-4">
              <ArrowLeftRight className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No matches found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adding more skills to your profile to find better matches!
            </p>
            <Button variant="outline" className="mt-2" size="sm">
              Browse All Skills
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
