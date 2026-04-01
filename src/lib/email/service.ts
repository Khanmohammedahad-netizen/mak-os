import { sendViaBrevo } from './brevo'

export interface OutreachEmailOptions {
    to: string
    subject: string
    body: string
    fromName?: string
    fromEmail?: string
    replyTo?: string
}

/**
 * Email Service — Brevo only (Zoho removed: flagged for unusual activity)
 * If Brevo fails, the error is logged and the lead is marked email_failed in CRM.
 */
export async function sendOutreachEmail(options: OutreachEmailOptions): Promise<{
    success: boolean
    messageId?: string
    error?: string
    provider: 'brevo'
}> {
    const fromEmail = options.fromEmail || process.env.OUTREACH_FROM_EMAIL
    if (!fromEmail) {
        const err = '[EmailService] OUTREACH_FROM_EMAIL is not set — cannot send. Set it in Render environment variables.'
        console.error(err)
        return { success: false, error: err, provider: 'brevo' }
    }

    console.log(`[EmailService] Sending via Brevo to: ${options.to}`)
    console.log(`[EmailService] From: ${fromEmail}`)

    try {
        const result = await sendViaBrevo({ ...options, fromEmail })
        if (result.success) {
            console.log(`[EmailService] Brevo delivered — MessageID: ${result.messageId}`)
            return { ...result, provider: 'brevo' }
        }
        // Brevo returned a non-success response (e.g. 400/401/403)
        console.error(`[EmailService] Brevo send failed: ${result.error}`)
        return { success: false, error: result.error, provider: 'brevo' }
    } catch (err: any) {
        console.error(`[EmailService] Brevo threw an exception: ${err.message}`)
        return { success: false, error: err.message, provider: 'brevo' }
    }
}
