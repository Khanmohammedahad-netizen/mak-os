// src/lib/email/brevo-sender.ts
export async function sendViaBrevo(
    to: string,
    subject: string,
    body: string,
    html: string,
    fromName: string
): Promise<{ success: boolean; messageId?: string, error?: string }> {

    if (!process.env.BREVO_API_KEY) {
        console.warn('[Brevo] BREVO_API_KEY is missing. Ensure you have added it to Render.')
        return { success: false, error: 'Missing BREVO_API_KEY' }
    }

    const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'ahad@maksoftwaresolutions.com'

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: fromName,
                    email: fromEmail
                },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                textContent: body
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('[Brevo Error]', data)
            return { success: false, error: data.message || 'Unknown Brevo Error' }
        }

        return {
            success: true,
            messageId: data.messageId
        }
    } catch (error: any) {
        console.error('[Brevo Catch Error]', error)
        return { success: false, error: error.message }
    }
}
