const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

// Startup diagnostic — confirms key is loaded on Render boot
console.log('[EmailAgent] BREVO_API_KEY loaded:', process.env.BREVO_API_KEY ? 'YES ✓' : 'MISSING ✗')

interface BrevoEmailOptions {
    to: string
    subject: string
    body: string
    fromName?: string
    fromEmail?: string
    replyTo?: string
}

export async function sendViaBrevo(
    options: BrevoEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {

    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) {
        console.error('[Brevo] BREVO_API_KEY is not set')
        return { success: false, error: 'API key missing' }
    }

    const fromEmail = options.fromEmail || process.env.OUTREACH_FROM_EMAIL!
    const fromName = options.fromName || 'Mohammed Ahad' // Fallback if OUTREACH_FROM_NAME is not set

    console.log(`[Brevo] Sending to: ${options.to}`)
    console.log(`[Brevo] Subject: ${options.subject}`)

    const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: fromName,
                email: fromEmail
            },
            to: [{ email: options.to }],
            replyTo: { email: options.replyTo || fromEmail },
            subject: options.subject,
            textContent: options.body  // plain text — better deliverability
        })
    })

    const data = await response.json()

    if (!response.ok) {
        console.error('[Brevo] Send failed:', JSON.stringify(data))
        return { success: false, error: data.message || 'Unknown error' }
    }

    console.log(`[Brevo] Sent successfully — MessageID: ${data.messageId}`)
    return { success: true, messageId: data.messageId }
}

export async function sendWithRetry(
    options: BrevoEmailOptions,
    maxAttempts = 3
): Promise<{ success: boolean; messageId?: string; error?: string }> {

    const delays = [0, 5000, 30000] // 0s, 5s, 30s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
            console.log(`[Brevo] Retry attempt ${attempt}/${maxAttempts}`)
            await new Promise(r => setTimeout(r, delays[attempt - 1]))
        }

        const result = await sendViaBrevo(options)
        if (result.success) return result

        console.warn(`[Brevo] Attempt ${attempt} failed: ${result.error}`)
        if (attempt === maxAttempts) return result
    }

    return { success: false, error: 'Max retries reached' }
}
