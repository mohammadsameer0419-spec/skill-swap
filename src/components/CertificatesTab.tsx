import { useQuery } from '@tanstack/react-query'
import { certificateService } from '@/lib/services/certificateService'
import { useAuth } from '@/hooks/useAuth'
import { CertificateCard } from './CertificateCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Award } from 'lucide-react'
import { generateCertificatePDF } from '@/utils/certificatePdf'
import { toast } from 'sonner'
import type { Certificate } from '@/types/certificate.types'

/**
 * Certificates Tab Component
 * Displays user's earned certificates with download functionality
 */
export function CertificatesTab() {
  const { user, profile } = useAuth()

  const {
    data: certificates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['certificates', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const result = await certificateService.getUserCertificates(user.id)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!user?.id,
  })

  const handleDownload = async (certificate: Certificate) => {
    try {
      const userName = profile?.full_name || profile?.username || 'User'
      await generateCertificatePDF(certificate, userName)
      toast.success('Certificate downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to download certificate')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load certificates: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!certificates || certificates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
            <Award className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">No certificates yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Complete your first session to earn a certificate! Certificates are automatically generated when you complete a session with a 4+ star rating.
        </p>
        <Button
          variant="default"
          onClick={() => {
            // Navigate to skills or sessions page
            window.location.href = '/dashboard'
          }}
        >
          Browse Skills
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Your Certificates</h2>
        <p className="text-muted-foreground">
          {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} earned
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((certificate) => (
          <CertificateCard
            key={certificate.id}
            certificate={certificate}
            userName={profile?.full_name || profile?.username || undefined}
            onDownload={handleDownload}
          />
        ))}
      </div>
    </div>
  )
}
