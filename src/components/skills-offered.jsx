import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

const skills = [
  {
    name: "Python Programming",
    level: "Advanced",
    requests: 3,
    status: "active",
  },
  {
    name: "Spanish Conversation",
    level: "Intermediate",
    requests: 5,
    status: "active",
  },
  {
    name: "Calculus Tutoring",
    level: "Advanced",
    requests: 2,
    status: "active",
  },
  {
    name: "Guitar Basics",
    level: "Beginner",
    requests: 0,
    status: "paused",
  },
  {
    name: "Essay Writing",
    level: "Intermediate",
    requests: 1,
    status: "active",
  },
]

export function SkillsOffered() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-medium">Skills You Offer</CardTitle>
        <Button variant="ghost" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {skills.map((skill, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{skill.name}</p>
                {skill.status === "paused" && (
                  <Badge variant="secondary" className="text-xs">
                    Paused
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {skill.level} • {skill.requests} request{skill.requests !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
