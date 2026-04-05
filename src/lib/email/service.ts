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
 */
export async function sendOutreachEmail(options: OutreachEmailOptions): Promise<{
    success: boolean
    messageId?: string
    error?: string
    provider: 'brevo'
}> {
    const apiKey    = process.env.BREVO_API_KEY
    const fromEmail = options.fromEmail || process.env.OUTREACH_FROM_EMAIL
    const fromName  = options.fromName  || process.env.OUTREACH_FROM_NAME || 'MAK Software'

    if (!apiKey) {
        console.error('[Email] SKIPPED — Reason: BREVO_API_KEY not set')
        return { success: false, error: 'BREVO_API_KEY not set', provider: 'brevo' }
    }

    if (!fromEmail) {
        console.error('[Email] SKIPPED — Reason: OUTREACH_FROM_EMAIL not set')
        return { success: false, error: 'OUTREACH_FROM_EMAIL not set', provider: 'brevo' }
    }

    // Diagnostic Log
    console.log(`[Email] Attempting send to ${options.to} for business_name placeholder`)

    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                sender:      { name: fromName, email: fromEmail },
                to:          [{ email: options.to }],
                replyTo:     { email: options.replyTo || fromEmail },
                subject:     options.subject,
                htmlContent: options.body.replace(/\n/g, '<br/>'),
                textContent: options.body,
            }),
        })

        if (!response.ok) {
            const errorBody = await response.text()
            console.error(`[Email] FAILED — Reason: ${response.status} ${errorBody}`)
            return { success: false, error: errorBody, provider: 'brevo' }
        }

        const data = await response.json()
        console.log(`[Email] SUCCESS — Message ID: ${data.messageId}`)
        return { success: true, messageId: data.messageId, provider: 'brevo' }

    } catch (err: any) {
        console.error(`[Email] FAILED — Reason: ${err.message}`)
        return { success: false, error: err.message, provider: 'brevo' }
    }
}
