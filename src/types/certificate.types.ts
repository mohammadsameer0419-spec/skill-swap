/**
 * Certificate interface matching database schema
 */
export interface Certificate {
  id: string
  certificate_number: string
  user_id: string // profiles.user_id (auth.users.id)
  skill_id: string
  session_id: string
  skill_name: string
  teacher_id: string // profiles.user_id (auth.users.id)
  teacher_name: string
  issued_at: string
  verification_hash: string | null
  certificate_url: string | null
  created_at: string
}

/**
 * Certificate with user profile details
 */
export interface CertificateWithUser extends Certificate {
  user_profile?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  }
}

/**
 * Verification result
 */
export interface CertificateVerification {
  certificate_id: string | null
  certificate_number: string | null
  user_name: string | null
  skill_name: string | null
  teacher_name: string | null
  issued_at: string | null
  is_valid: boolean
}
