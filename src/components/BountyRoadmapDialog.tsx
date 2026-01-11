import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AIRoadmapGenerator } from './AIRoadmapGenerator'
import type { AIRoadmap } from '@/types/roadmap.types'

interface BountyRoadmapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillName: string
  currentLevel?: string
}

/**
 * Dialog wrapper for AI Roadmap Generator
 * Triggered from Bounty Board
 */
export function BountyRoadmapDialog({
  open,
  onOpenChange,
  skillName,
  currentLevel,
}: BountyRoadmapDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Learning Roadmap</DialogTitle>
          <DialogDescription>
            Create a personalized 4-week learning path for "{skillName}"
          </DialogDescription>
        </DialogHeader>
        <AIRoadmapGenerator
          skillName={skillName}
          onRoadmapGenerated={(roadmap) => {
            // Optional: Handle roadmap generation
            console.log('Roadmap generated:', roadmap)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
