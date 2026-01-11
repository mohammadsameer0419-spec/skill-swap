import { Card, CardContent } from "@/components/ui/card"
import { Coins, BookOpen, Users, TrendingUp, Award } from "lucide-react"

const iconMap = {
  Coins,
  BookOpen,
  Users,
  TrendingUp,
  Award,
}

interface Stat {
  label: string
  value: string
  change: string
  icon: keyof typeof iconMap
  trend: "up" | "down" | "neutral"
}

interface StatsCardsProps {
  stats?: Stat[]
}

const defaultStats: Stat[] = [
  {
    label: "Available Credits",
    value: "24",
    change: "+4 this week",
    icon: "Coins",
    trend: "up",
  },
  {
    label: "Skills Offered",
    value: "5",
    change: "3 active requests",
    icon: "BookOpen",
    trend: "neutral",
  },
  {
    label: "Completed Exchanges",
    value: "12",
    change: "+2 this month",
    icon: "Users",
    trend: "up",
  },
  {
    label: "Avg. Rating",
    value: "4.8",
    change: "Based on 12 reviews",
    icon: "TrendingUp",
    trend: "up",
  },
]

export function StatsCards({ stats = defaultStats }: StatsCardsProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const IconComponent = iconMap[stat.icon] || Coins
        return (
          <Card key={index} className="bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary">
                  <IconComponent className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}
