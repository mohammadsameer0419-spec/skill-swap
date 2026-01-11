import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { certificateService } from '@/lib/services/certificateService'
import type { CertificateVerification } from '@/types/certificate.types'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Award } from 'lucide-react'

/**
 * Public Certificate Verification Page
 * Route: /verify/:hash
 */
export function VerifyCertificate() {
  const { hash } = useParams<{ hash: string }>()
  const [verification, setVerification] = useState<CertificateVerification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verify = async () => {
      if (!hash) {
        setError('Invalid verification hash')
        setIsLoading(false)
        return
      }

      try {
        const result = await certificateService.verifyCertificate(hash)
        if (result.error) {
          setError(result.error.message)
        } else if (result.data) {
          setVerification(result.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify certificate')
      } finally {
        setIsLoading(false)
      }
    }

    verify()
  }, [hash])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !verification || !verification.is_valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
            <p className="text-muted-foreground">
              {error || 'The certificate you are looking for does not exist or has been invalidated.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/20">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Certificate Verified</CardTitle>
          <p className="text-muted-foreground mt-2">
            This certificate has been verified and is authentic
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Certificate Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Certificate Details</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Recipient</p>
                <p className="font-semibold">{verification.user_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Skill</p>
                <p className="font-semibold">{verification.skill_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Teacher</p>
                <p className="font-semibold">{verification.teacher_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Issued Date</p>
                <p className="font-semibold">
                  {verification.issued_at
                    ? format(new Date(verification.issued_at), 'MMM dd, yyyy')
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Certificate Number */}
          {verification.certificate_number && (
            <div className="p-4 bg-background border border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Certificate Number</p>
              <p className="font-mono text-sm">{verification.certificate_number}</p>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center justify-center">
            <Badge variant="default" className="bg-green-500 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Verified
            </Badge>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Verified by SkillSwap Platform
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
