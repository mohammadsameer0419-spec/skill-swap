import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import type { Certificate } from '@/types/certificate.types'
import { useAuth } from '@/hooks/useAuth'

interface CertificateCardProps {
  certificate: Certificate
  userName?: string
  onDownload?: (certificate: Certificate) => void
}

/**
 * Certificate Card Component
 * Professional/Classic design with border-frame, logo, user name, skill, and QR code
 */
export function CertificateCard({
  certificate,
  userName,
  onDownload,
}: CertificateCardProps) {
  const { profile } = useAuth()
  
  // Generate verification URL
  const verificationUrl = certificate.verification_hash
    ? `${window.location.origin}/verify/${certificate.verification_hash}`
    : null

  const handleDownload = () => {
    if (onDownload) {
      onDownload(certificate)
    }
  }

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20">
      {/* Decorative border frame */}
      <div className="absolute inset-0 border-4 border-primary/10 pointer-events-none" />
      <div className="absolute inset-2 border-2 border-primary/5 pointer-events-none" />
      
      <CardContent className="p-8 relative">
        {/* Header with Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
              <span className="text-2xl font-bold text-primary">SS</span>
            </div>
          </div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Certificate of Completion
          </h3>
        </div>

        {/* Main Content */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground mb-2">This certifies that</p>
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            {userName || profile?.full_name || profile?.username || 'User'}
          </h2>
          <p className="text-sm text-muted-foreground mb-1">has successfully completed</p>
          <h3 className="text-xl font-semibold text-primary mb-4">
            {certificate.skill_name}
          </h3>
          <p className="text-xs text-muted-foreground">
            Taught by {certificate.teacher_name}
          </p>
        </div>

        {/* Date and Certificate Number */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-6 pt-4 border-t border-border">
          <div>
            <p className="font-semibold">Issued</p>
            <p>{format(new Date(certificate.issued_at), 'MMM dd, yyyy')}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Certificate No.</p>
            <p className="font-mono">{certificate.certificate_number}</p>
          </div>
        </div>

        {/* QR Code */}
        {verificationUrl && (
          <div className="flex flex-col items-center justify-center mb-6 p-4 bg-background/50 rounded-lg border border-border">
            <QRCodeSVG
              value={verificationUrl}
              size={120}
              level="M"
              includeMargin={false}
              className="mb-2"
            />
            <p className="text-xs text-muted-foreground text-center">
              Scan to verify
            </p>
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View verification
            </a>
          </div>
        )}

        {/* Download Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
