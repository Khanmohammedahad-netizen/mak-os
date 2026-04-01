// ─── Startup env diagnostic (runs once on module load) ──────────────────────
console.log('[EmailService] Startup env check:')
console.log('  BREVO_API_KEY:', process.env.BREVO_API_KEY
    ? 'SET ✓ (' + process.env.BREVO_API_KEY.substring(0, 12) + '...)'
    : 'MISSING ✗')
console.log('  OUTREACH_FROM_EMAIL:', process.env.OUTREACH_FROM_EMAIL || 'MISSING ✗')
console.log('  OUTREACH_FROM_NAME:', process.env.OUTREACH_FROM_NAME || 'MISSING ✗')

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export interface OutreachEmailOptions {
    to: string
    subject: string
    body: string
    fromName?: string
    fromEmail?: string
    replyTo?: string
}

/**
 * Email Service — Brevo only (raw fetch, no SDK, no Zoho fallback)
 * All env vars are read inline at call time to avoid module-load timing issues.
 */
export async function sendOutreachEmail(options: OutreachEmailOptions): Promise<{
    success: boolean
    messageId?: string
    error?: string
    provider: 'brevo'
}> {
    // Read ALL env vars inline at call time — never at module load
    const apiKey = process.env.BREVO_API_KEY
    const fromEmail = options.fromEmail || process.env.OUTREACH_FROM_EMAIL
    const fromName = options.fromName || process.env.OUTREACH_FROM_NAME || 'MAK Software'

    if (!apiKey) {
        const err = '[EmailService] BREVO_API_KEY is not set'
        console.error(err)
        return { success: false, error: err, provider: 'brevo' }
    }

    if (!fromEmail) {
        const err = '[EmailService] OUTREACH_FROM_EMAIL is not set — cannot send. Set it in Render environment variables.'
        console.error(err)
        return { success: false, error: err, provider: 'brevo' }
    }

    console.log(`[EmailService] Sending via Brevo to: ${options.to}`)
    console.log(`[EmailService] From: ${fromEmail}`)

    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                sender: { name: fromName, email: fromEmail },
                to: [{ email: options.to }],
                replyTo: { email: options.replyTo || fromEmail },
                subject: options.subject,
                htmlContent: options.body.replace(/\n/g, '<br/>'),
                textContent: options.body,
            }),
        })

        if (!response.ok) {
            const errorBody = await response.text()
            const err = `[EmailService] Brevo API error ${response.status}: ${errorBody}`
            console.error(err)
            return { success: false, error: err, provider: 'brevo' }
        }

        const data = await response.json()
        console.log(`[EmailService] Email sent successfully to ${options.to} via Brevo — MessageID: ${data.messageId}`)
        return { success: true, messageId: data.messageId, provider: 'brevo' }

    } catch (err: any) {
        const msg = `[EmailService] Brevo fetch threw an exception: ${err.message}`
        console.error(msg)
        return { success: false, error: msg, provider: 'brevo' }
    }
}
