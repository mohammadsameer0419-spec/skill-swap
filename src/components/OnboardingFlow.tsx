import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"
import { useOnboardingProgress, useCompleteOnboardingStep } from "@/hooks/useGrowth"
import { useAuth } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

/**
 * Onboarding Flow Component
 * Guides new users through platform setup
 */
export function OnboardingFlow() {
  const { user } = useAuth()
  const { data: progress, isLoading } = useOnboardingProgress(user?.id)
  const completeStep = useCompleteOnboardingStep()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!progress || progress.is_complete) {
    return null // Don't show if onboarding is complete
  }

  const handleCompleteStep = async (stepKey: string) => {
    if (!user?.id) return

    try {
      await completeStep.mutateAsync({
        userId: user.id,
        stepKey,
      })
      toast.success('Step completed!')
    } catch (error) {
      toast.error('Failed to complete step')
      console.error(error)
    }
  }

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Welcome! Let's get you started</CardTitle>
        <CardDescription>
          Complete these steps to unlock all features
        </CardDescription>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.completed_steps} / {progress.total_steps} steps
            </span>
          </div>
          <Progress value={progress.progress_percentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {progress.steps.map((step) => (
            <div
              key={step.step_key}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                step.completed
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                  : 'bg-card border-border'
              }`}
            >
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${step.completed ? 'text-green-900 dark:text-green-100' : ''}`}>
                      {step.title}
                    </h4>
                    {step.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                  {!step.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCompleteStep(step.step_key)}
                      disabled={completeStep.isPending}
                    >
                      {step.component_type === 'action' ? 'Go' : 'Start'}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
