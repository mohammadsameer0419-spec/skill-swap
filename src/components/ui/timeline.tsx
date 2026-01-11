import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle } from "lucide-react"

interface TimelineItem {
  title: string
  description?: string
  content?: React.ReactNode
  completed?: boolean
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
}

/**
 * Timeline Component
 * Displays a vertical timeline with items
 */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-8">
        {items.map((item, index) => (
          <div key={index} className="relative flex gap-4">
            {/* Icon */}
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-border">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-primary fill-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
              <h3 className={cn(
                "text-lg font-semibold mb-1",
                item.completed ? "text-foreground" : "text-foreground"
              )}>
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {item.description}
                </p>
              )}
              {item.content && (
                <div className="mt-2">
                  {item.content}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
