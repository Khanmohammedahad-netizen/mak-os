const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

export async function sendWhatsAppMessage(
    recipientPhone: string,
    messageBody: string,
    businessId: string | undefined = process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: string | undefined = process.env.WHATSAPP_ACCESS_TOKEN
): Promise<{ success: boolean; messageId?: string; error?: string }> {

    if (!businessId || !token) {
        return { success: false, error: 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN' }
    }

    // Format phone: must include country code, no + sign
    // US numbers: 13125550100 (1 + 10 digits)
    const formattedPhone = formatForWhatsApp(recipientPhone)

    try {
        const response = await fetch(
            `${WHATSAPP_API_URL}/${businessId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedPhone,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: messageBody
                    }
                })
            }
        )

        const data = await response.json()

        if (data.messages?.[0]?.id) {
            return { success: true, messageId: data.messages[0].id }
        }

        return { success: false, error: JSON.stringify(data.error) }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

function formatForWhatsApp(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    // Add US country code if not present (assuming primarily US leads for now)
    if (digits.length === 10) return `1${digits}`
    return digits
}
