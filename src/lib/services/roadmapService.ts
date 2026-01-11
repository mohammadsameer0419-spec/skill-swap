import { supabase } from '../supabase'
import type {
  GenerateRoadmapRequest,
  GenerateRoadmapResponse,
  AIRoadmap,
} from '@/types/roadmap.types'

/**
 * Roadmap Service
 * Manages AI-generated learning roadmaps
 */
export class RoadmapService {
  /**
   * Generate an AI-powered learning roadmap
   * @param request - Roadmap generation request
   * @returns Generated roadmap with mapped resources
   */
  async generateRoadmap(
    request: GenerateRoadmapRequest
  ): Promise<{ data: AIRoadmap | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-roadmap', {
        body: request,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to generate roadmap: ${error.message}`),
        }
      }

      const response = data as GenerateRoadmapResponse

      if (!response.success || !response.roadmap) {
        return {
          data: null,
          error: new Error(response.error || 'Failed to generate roadmap'),
        }
      }

      return { data: response.roadmap, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }
}

// Export singleton instance
export const roadmapService = new RoadmapService()
