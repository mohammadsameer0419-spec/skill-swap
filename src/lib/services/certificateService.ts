import { supabase } from '../supabase'
import type { Certificate, CertificateVerification } from '@/types/certificate.types'

/**
 * Certificate Service
 * Handles certificate operations
 */
export class CertificateService {
  /**
   * Get all certificates for a user
   */
  async getUserCertificates(
    userId: string
  ): Promise<{ data: Certificate[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', userId)
        .order('issued_at', { ascending: false })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch certificates: ${error.message}`),
        }
      }

      return {
        data: data as Certificate[],
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
   * Get certificate by ID
   */
  async getCertificateById(
    certificateId: string
  ): Promise<{ data: Certificate | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', certificateId)
        .single()

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch certificate: ${error.message}`),
        }
      }

      return {
        data: data as Certificate,
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
   * Verify certificate by hash
   */
  async verifyCertificate(
    verificationHash: string
  ): Promise<{ data: CertificateVerification | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('verify_certificate', {
        p_verification_hash: verificationHash,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to verify certificate: ${error.message}`),
        }
      }

      if (!data || data.length === 0) {
        return {
          data: {
            certificate_id: null,
            certificate_number: null,
            user_name: null,
            skill_name: null,
            teacher_name: null,
            issued_at: null,
            is_valid: false,
          },
          error: null,
        }
      }

      return {
        data: data[0] as CertificateVerification,
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
   * Generate certificate for a session (manual trigger)
   */
  async generateCertificate(
    sessionId: string
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('generate_certificate_on_completion', {
        p_session_id: sessionId,
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to generate certificate: ${error.message}`),
        }
      }

      return {
        data: data as string,
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

export const certificateService = new CertificateService()
