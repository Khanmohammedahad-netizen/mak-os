import { sendEmail } from '../zoho-mail'
import { formatPhoneDigits, CARRIER_GATEWAYS } from '../phone/carrier-lookup'

interface SMSInput {
    businessName: string
    city: string
    websiteCategory: 'A' | 'B' | 'C' | 'D'
    opportunitySummary?: string
    operatorName?: string
}

interface SMSOutput {
    body: string
    characterCount: number
    approved: boolean
}

/**
 * Stage 5 Alternative: MarketingAgent SMS Generation
 */
export async function generateSMS(input: SMSInput): Promise<SMSOutput> {
    const operator = input.operatorName || 'Mohammed'

    let body = ''

    if (input.websiteCategory === 'A' || input.websiteCategory === 'D') {
        body = `${input.businessName} — looked up businesses in ${input.city} & couldn't find your site. Worth a chat about how we could help? — ${operator}`
    } else if (input.websiteCategory === 'B') {
        body = `${input.businessName} — your site doesn't load right on phones. I'm helping businesses in ${input.city} fix this to get more customers. Interested? — ${operator}`
    } else if (input.websiteCategory === 'C') {
        body = `${input.businessName} — great info online but no website. I help local businesses in ${input.city} capture that search traffic. Want to hear more? — ${operator}`
    }

    // Safety fallback
    if (body.length > 130) {
        body = `Hi ${input.businessName}. I'm helping businesses in ${input.city} get more local customers by optimizing their digital footprint. Interested in a chat?`
    }

    return {
        body,
        characterCount: body.length,
        approved: body.length <= 160
    }
}

/**
 * Stage 6 Alternative: Send via SMS Gateway
 */
export async function sendSMSViaGateway(
    phoneNumber: string,
    messageBody: string,
    carrier?: string | null
): Promise<{ success: boolean; gatewaysAttempted: string[] }> {

    const digits = formatPhoneDigits(phoneNumber)
    let gatewayEmails: string[] = []

    if (carrier && CARRIER_GATEWAYS[carrier]) {
        // Known carrier — send to exactly one gateway
        gatewayEmails = [`${digits}@${CARRIER_GATEWAYS[carrier]}`]
    } else {
        // Unknown carrier fallback strategy — send to the top 4 US carriers.
        // It will succeed on one and silently fail on the others.
        gatewayEmails = [
            `${digits}@txt.att.net`,
            `${digits}@tmomail.net`,
            `${digits}@vtext.com`,
            `${digits}@sms.myboostmobile.com`
        ]
    }

    // Send to each gateway concurrently using the existing Zoho sender
    const results = await Promise.allSettled(
        gatewayEmails.map(gatewayEmail =>
            sendEmail({
                to: gatewayEmail,
                subject: '', // SMS gateway ignores subject, or prepends it
                html: messageBody, // Not used but required by type signature
                text: messageBody, // This is what the recipient actually sees
            })
        )
    )

    // Consider it a success if at least one email didn't throw an SMTP error
    const anySuccess = results.some(r => r.status === 'fulfilled')

    return {
        success: anySuccess,
        gatewaysAttempted: gatewayEmails
    }
}
