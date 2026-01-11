import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Timeline } from '@/components/ui/timeline'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { roadmapService } from '@/lib/services/roadmapService'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Sparkles, BookOpen, Clock, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import type { GenerateRoadmapRequest, AIRoadmap, RoadmapStep } from '@/types/roadmap.types'
import { cn } from '@/lib/utils'

interface AIRoadmapGeneratorProps {
  skillName?: string // Optional: pre-fill from Bounty Board
  onRoadmapGenerated?: (roadmap: AIRoadmap) => void
}

/**
 * AI Roadmap Generator Component
 * Generates a 4-week learning path using OpenAI and maps to database resources
 */
export function AIRoadmapGenerator({
  skillName: initialSkillName,
  onRoadmapGenerated,
}: AIRoadmapGeneratorProps) {
  const { profile } = useAuth()
  const [skillName, setSkillName] = useState(initialSkillName || '')
  const [currentLevel, setCurrentLevel] = useState(profile?.level || 'beginner')
  const [generatedRoadmap, setGeneratedRoadmap] = useState<AIRoadmap | null>(null)

  const generateMutation = useMutation({
    mutationFn: (request: GenerateRoadmapRequest) => roadmapService.generateRoadmap(request),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(`Failed to generate roadmap: ${result.error.message}`)
        return
      }

      if (result.data) {
        setGeneratedRoadmap(result.data)
        toast.success('Roadmap generated successfully!')
        onRoadmapGenerated?.(result.data)
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate roadmap: ${error.message}`)
    },
  })

  const handleGenerate = () => {
    if (!skillName.trim()) {
      toast.error('Please enter a skill name')
      return
    }

    generateMutation.mutate({
      skill_name: skillName.trim(),
      current_level: currentLevel,
      user_id: profile?.user_id,
    })
  }

  const renderStepContent = (step: RoadmapStep) => (
    <div className="space-y-4">
      {/* Learning Objectives */}
      {step.learning_objectives && step.learning_objectives.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Learning Objectives:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {step.learning_objectives.map((objective, idx) => (
              <li key={idx}>{objective}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mapped Resources */}
      {step.mapped_resources && step.mapped_resources.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Recommended Resources:</h4>
          <div className="space-y-2">
            {step.mapped_resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {resource.resource_type === 'video' && (
                    <BookOpen className="h-4 w-4 text-primary" />
                  )}
                  {resource.resource_type === 'article' && (
                    <BookOpen className="h-4 w-4 text-blue-500" />
                  )}
                  {resource.resource_type === 'tutorial' && (
                    <BookOpen className="h-4 w-4 text-green-500" />
                  )}
                  {!['video', 'article', 'tutorial'].includes(resource.resource_type) && (
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {resource.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {resource.resource_type}
                    </Badge>
                    {resource.duration_minutes && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {resource.duration_minutes} min
                      </div>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Hours */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Estimated: {step.estimated_hours} hours</span>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Roadmap Generator
        </CardTitle>
        <CardDescription>
          Generate a personalized 4-week learning path powered by AI and mapped to our learning resources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        {!generatedRoadmap && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Skill to Learn</Label>
              <Input
                id="skill-name"
                placeholder="e.g., Python for Data Science, React Development"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                disabled={generateMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-level">Your Current Level</Label>
              <Select
                value={currentLevel}
                onValueChange={setCurrentLevel}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger id="current-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="learner">Learner</SelectItem>
                  <SelectItem value="skilled">Skilled</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !skillName.trim()}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Roadmap...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Roadmap
                </>
              )}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {generateMutation.isPending && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {/* Error State */}
        {generateMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {generateMutation.error instanceof Error
                ? generateMutation.error.message
                : 'Failed to generate roadmap'}
            </AlertDescription>
          </Alert>
        )}

        {/* Generated Roadmap */}
        {generatedRoadmap && (
          <div className="space-y-6">
            {/* Roadmap Header */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">{generatedRoadmap.skill_name}</h3>
                <Badge variant="secondary">
                  {generatedRoadmap.current_level} → {generatedRoadmap.target_level}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {generatedRoadmap.total_hours} total hours
                </div>
                <span>•</span>
                <span>{generatedRoadmap.duration_weeks} weeks</span>
              </div>
            </div>

            {/* Timeline */}
            <Timeline
              items={generatedRoadmap.steps.map((step) => ({
                title: `Week ${step.week}: ${step.title}`,
                description: step.description,
                content: renderStepContent(step),
                completed: false, // Can track completion later
              }))}
            />

            {/* Generate New Roadmap Button */}
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedRoadmap(null)
                setSkillName('')
              }}
              className="w-full"
            >
              Generate New Roadmap
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
