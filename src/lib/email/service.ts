import { sendWithRetry as sendByBrevo } from './brevo'
import { sendEmail as sendByZoho } from '../zoho-mail'

export interface OutreachEmailOptions {
    to: string
    subject: string
    body: string
    fromName?: string
    fromEmail?: string
    replyTo?: string
}

/**
 * Unified Email Service - Primary: Brevo, Fallback: Zoho
 * This ensures the system remains functional even if credentials for one provider are missing.
 */
export async function sendOutreachEmail(options: OutreachEmailOptions): Promise<{ 
    success: boolean; 
    messageId?: string; 
    error?: string; 
    provider: 'brevo' | 'zoho' 
}> {
    const brevoKey = process.env.BREVO_API_KEY

    // 1. Attempt Brevo if key exists
    if (brevoKey) {
        console.log(`[EmailService] Attempting send via Brevo (Primary)...`)
        const result = await sendByBrevo(options)
        if (result.success) {
            return { ...result, provider: 'brevo' }
        }
        console.warn(`[EmailService] Brevo failed: ${result.error}. Falling back to Zoho...`)
    } else {
        console.warn(`[EmailService] BREVO_API_KEY missing. Falling back to Zoho...`)
    }

    // 2. Fallback to Zoho
    try {
        console.log(`[EmailService] Attempting send via Zoho (Fallback)...`)
        const zohoResult = await sendByZoho({
            to: options.to,
            subject: options.subject,
            html: options.body.replace(/\n/g, '<br/>'),
            text: options.body
        })
        return { 
            success: true, 
            messageId: zohoResult.messageId, 
            provider: 'zoho' 
        }
    } catch (zohoErr: any) {
        console.error(`[EmailService] Zoho fallback also failed: ${zohoErr.message}`)
        return { 
            success: false, 
            error: `Both providers failed. Zoho error: ${zohoErr.message}`,
            provider: 'zoho'
        }
    }
}
