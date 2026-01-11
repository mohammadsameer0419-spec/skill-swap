import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Certificate } from '@/types/certificate.types'
import { format } from 'date-fns'

/**
 * Generate PDF from certificate
 */
export async function generateCertificatePDF(
  certificate: Certificate,
  userName: string
): Promise<void> {
  // Create a temporary container for the certificate
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '800px'
  container.style.padding = '40px'
  container.style.background = 'white'
  container.style.border = '4px solid #e5e7eb'
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
  
  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; border-radius: 50%; background: #f3f4f6; border: 2px solid #d1d5db; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 24px; font-weight: bold; color: #3b82f6;">SS</span>
      </div>
      <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin: 0;">
        Certificate of Completion
      </h3>
    </div>
    <div style="text-align: center; margin-bottom: 30px;">
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">This certifies that</p>
      <h2 style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #111827;">
        ${userName}
      </h2>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">has successfully completed</p>
      <h3 style="font-size: 24px; font-weight: 600; color: #3b82f6; margin: 10px 0;">
        ${certificate.skill_name}
      </h3>
      <p style="font-size: 12px; color: #6b7280;">
        Taught by ${certificate.teacher_name}
      </p>
    </div>
    <div style="display: flex; justify-content: space-between; padding-top: 20px; border-top: 1px solid #e5e7eb; margin-bottom: 20px;">
      <div>
        <p style="font-size: 12px; font-weight: 600; color: #6b7280; margin: 0;">Issued</p>
        <p style="font-size: 12px; color: #111827; margin: 5px 0 0 0;">
          ${format(new Date(certificate.issued_at), 'MMM dd, yyyy')}
        </p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 12px; font-weight: 600; color: #6b7280; margin: 0;">Certificate No.</p>
        <p style="font-size: 12px; font-family: monospace; color: #111827; margin: 5px 0 0 0;">
          ${certificate.certificate_number}
        </p>
      </div>
    </div>
    ${certificate.verification_hash ? `
    <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <p style="font-size: 10px; color: #6b7280; margin: 0;">
        Verify this certificate at: ${window.location.origin}/verify/${certificate.verification_hash}
      </p>
    </div>
    ` : ''}
  `
  
  document.body.appendChild(container)

  try {
    // Wait a bit for rendering
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    // Create PDF in landscape
    const pdf = new jsPDF('landscape', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png', 1.0)
    
    // Calculate dimensions to fit A4 landscape
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
    const imgScaledWidth = imgWidth * ratio
    const imgScaledHeight = imgHeight * ratio
    const xOffset = (pdfWidth - imgScaledWidth) / 2
    const yOffset = (pdfHeight - imgScaledHeight) / 2

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight)
    pdf.save(`certificate-${certificate.certificate_number}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
