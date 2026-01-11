import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reviewService } from '@/lib/services/reviewService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PostClassReviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  hostId: string // Profile ID of the host
  hostName?: string
  onReviewSubmitted?: () => void
}

/**
 * Post Class Review Modal
 * Appears automatically after a live class ends
 */
export function PostClassReview({
  open,
  onOpenChange,
  classId,
  hostId,
  hostName,
  onReviewSubmitted,
}: PostClassReviewProps) {
  const { user, profile } = useAuth()
  const [rating, setRating] = useState<number>(0)
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get host's user_id (auth.users user_id) from profile
  const getHostUserId = async (hostProfileId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', hostProfileId)
      .single()

    if (error || !data) {
      console.error('Error fetching host user_id:', error)
      return null
    }

    return data.user_id
  }

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast.error('Please sign in to submit a review')
      return
    }

    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    setIsSubmitting(true)

    try {
      // Get host's user_id
      const hostUserId = await getHostUserId(hostId)

      if (!hostUserId) {
        toast.error('Could not find host information')
        return
      }

      // Submit review using service
      const { data: reviewId, error } = await reviewService.createLiveClassReview(
        user.id, // Current user (auth.users user_id)
        hostUserId, // Host's user_id (auth.users user_id)
        classId,
        rating,
        comment || null
      )

      if (error || !reviewId) {
        console.error('Error submitting review:', error)
        toast.error(`Failed to submit review: ${error?.message || 'Unknown error'}`)
        return
      }

      toast.success('Thank you for your review! Your feedback helps improve the community.')
      
      // Reset form
      setRating(0)
      setComment('')
      
      // Close modal
      onOpenChange(false)
      
      // Callback - reputation update will trigger level recalculation automatically
      onReviewSubmitted?.()
    } catch (error) {
      console.error('Error submitting review:', error)
      toast.error('Failed to submit review. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onOpenChange(false)
    onReviewSubmitted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was your experience with {hostName || 'this class'}? Your feedback helps improve the community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className={cn(
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm',
                    (hoveredRating >= star || rating >= star)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  )}
                  disabled={isSubmitting}
                >
                  <Star
                    className={cn(
                      'h-8 w-8',
                      (hoveredRating >= star || rating >= star)
                        ? 'fill-current'
                        : 'fill-none'
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating} of 5
                </span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Comment (Optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Share your thoughts about the class..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
