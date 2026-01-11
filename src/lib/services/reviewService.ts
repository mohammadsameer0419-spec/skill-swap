import { supabase } from '../supabase'

/**
 * Review Service
 * Handles review creation for live classes and skill sessions
 */
export class ReviewService {
  /**
   * Create a review for a live class
   */
  async createLiveClassReview(
    reviewerId: string, // auth.users user_id
    revieweeId: string, // auth.users user_id
    classId: string,
    rating: number,
    comment?: string | null
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data: reviewId, error } = await supabase.rpc(
        'create_live_class_review',
        {
          p_reviewer_id: reviewerId,
          p_reviewee_id: revieweeId,
          p_class_id: classId,
          p_rating: rating,
          p_comment: comment || null,
        } as any
      )

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to create review: ${error.message}`),
        }
      }

      return {
        data: reviewId as string,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Create a review for a skill session
   */
  async createSessionReview(
    reviewerId: string, // auth.users user_id
    revieweeId: string, // auth.users user_id
    sessionId: string,
    rating: number,
    comment?: string | null
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data: reviewId, error } = await supabase.rpc('create_review', {
        p_reviewer_id: reviewerId,
        p_reviewee_id: revieweeId,
        p_session_id: sessionId,
        p_rating: rating,
        p_comment: comment || null,
      } as any)

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to create review: ${error.message}`),
        }
      }

      return {
        data: reviewId as string,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }
}

export const reviewService = new ReviewService()
