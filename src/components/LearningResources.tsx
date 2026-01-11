import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ExternalLink, Play, BookOpen, FileText, Video, CheckCircle2 } from "lucide-react"
import { useAvailableResources, useResourceCategories, useUpdateResourceProgress } from "@/hooks/useGrowth"
import { useAuth } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import type { LearningResource, ResourceType } from "@/types/growth.types"
import { useState } from "react"

/**
 * Resource type icons
 */
const RESOURCE_ICONS: Record<ResourceType, any> = {
  video: Video,
  article: FileText,
  tutorial: Play,
  documentation: BookOpen,
  exercise: BookOpen,
  path: BookOpen,
}

/**
 * Learning Resources Component
 * Displays available learning resources based on user level
 */
export function LearningResources() {
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<string | undefined>()

  const { data: resources, isLoading } = useAvailableResources(user?.id, {
    categoryId: selectedCategory,
    resourceType: selectedType,
    limit: 20,
  })

  const { data: categories } = useResourceCategories()
  const updateProgress = useUpdateResourceProgress()

  const handleResourceClick = async (resource: LearningResource) => {
    if (!user?.id) return

    // Track view
    // await growthService.incrementResourceViews(resource.id)

    // Open resource in new tab
    window.open(resource.url, '_blank')

    // Update progress to started
    if (!resource.progress || resource.progress.status === 'started') {
      try {
        await updateProgress.mutateAsync({
          userId: user.id,
          resourceId: resource.id,
          progressPercentage: 0,
          status: 'started',
        })
      } catch (error) {
        console.error('Failed to update progress:', error)
      }
    }
  }

  const handleMarkComplete = async (resource: LearningResource, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return

    try {
      await updateProgress.mutateAsync({
        userId: user.id,
        resourceId: resource.id,
        progressPercentage: 100,
        status: 'completed',
      })
    } catch (error) {
      console.error('Failed to mark complete:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Learning Resources</h2>
        <p className="text-muted-foreground">
          Access curated resources to improve your skills
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!selectedCategory ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(undefined)}
        >
          All Categories
        </Button>
        {categories?.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.icon && <span className="mr-1">{category.icon}</span>}
            {category.name}
          </Button>
        ))}
      </div>

      {/* Resources Grid */}
      {resources && resources.resources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.resources.map((resource) => {
            const ResourceIcon = RESOURCE_ICONS[resource.resource_type] || BookOpen
            const isCompleted = resource.progress?.status === 'completed'

            return (
              <Card
                key={resource.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  isCompleted ? 'border-green-200 dark:border-green-800' : ''
                }`}
                onClick={() => handleResourceClick(resource)}
              >
                {resource.thumbnail_url && (
                  <div className="relative w-full h-32 bg-muted rounded-t-lg overflow-hidden">
                    <img
                      src={resource.thumbnail_url}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                    />
                    {isCompleted && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-2">{resource.title}</CardTitle>
                      <CardDescription className="text-xs mt-1 line-clamp-2">
                        {resource.description || 'No description'}
                      </CardDescription>
                    </div>
                    <ResourceIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {resource.resource_type}
                    </Badge>
                    {resource.difficulty_level && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {resource.difficulty_level}
                      </Badge>
                    )}
                    {resource.is_featured && (
                      <Badge variant="default" className="text-xs">
                        Featured
                      </Badge>
                    )}
                  </div>
                  {resource.progress && resource.progress.status !== 'completed' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{resource.progress.progress_percentage}%</span>
                      </div>
                      <Progress value={resource.progress.progress_percentage} className="h-1.5" />
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={isCompleted ? 'outline' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleResourceClick(resource)
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {isCompleted ? 'Review' : 'Open'}
                  </Button>
                  {!isCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleMarkComplete(resource, e)}
                      disabled={updateProgress.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mb-4">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No resources available</h3>
            <p className="text-sm text-muted-foreground">
              Learning resources will appear here as you progress through levels.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
