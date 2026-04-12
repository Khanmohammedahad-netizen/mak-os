/**
 * Zoho Mail Sender — Uses nodemailer with Zoho SMTP.
 *
 * Zoho SMTP: smtp.zoho.com:465 (SSL)
 * Requires an App-Specific Password.
 */

import nodemailer from 'nodemailer'

// ─── Types ────────────────────────────────────────────────────────

export interface EmailOptions {
    to: string
    subject: string
    html: string
    text?: string
}

export type EmailTone = 'professional' | 'conversational' | 'curiosity'
export type VariantId = 'A' | 'B' | 'C'

export interface EmailVariant {
    variant_id: VariantId
    subject: string
    body: string
    word_count: number
    tone: EmailTone
}

// ─── Transporter (lazy-initialized) ───────────────────────────────

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
    if (transporter) return transporter

    const user = process.env.ZOHO_MAIL_USER
    const pass = process.env.ZOHO_MAIL_PASSWORD

    if (!user || !pass) {
        throw new Error(
            'ZOHO_MAIL_USER and ZOHO_MAIL_PASSWORD must be set in environment variables.'
        )
    }

    transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
        auth: { user, pass },
    })

    return transporter
}

// ─── Send Email ───────────────────────────────────────────────────

export async function sendEmail(options: EmailOptions) {
    const transport = getTransporter()
    const from = process.env.ZOHO_MAIL_FROM || process.env.ZOHO_MAIL_USER!

    const info = await transport.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
    })

    console.log(`[ZohoMail] Sent to ${options.to} — messageId: ${info.messageId}`)
    return info
}

export function buildOutreachVariants(lead: {
    company: string
    city: string
    category?: string | null
    auditCategory?: string
    opportunitySummary?: string
}): EmailVariant[] {
    const issue = lead.opportunitySummary || `${lead.company} doesn't currently rely on a dedicated website.`

    // Variant A: Professional Tone
    const profSubject = `Quick thought about ${lead.company}'s search presence`
    const profBody = `Hi ${lead.company} team,

I was researching local businesses in ${lead.city} and noticed your profile. ${issue}

Many businesses rely on directory listings, but establishing a direct, fast-loading professional site helps build long-term trust and secures foot traffic from local search maps. Implementing a clean layout with proper mobile support can directly increase your weekly inquiries.

If you're open to improving your digital footprint, feel free to reply to this email.

Best regards,
Mohammed Ahad
MAK Software Solutions`

    // Variant B: Conversational / Peer Tone
    const convSubject = `Noticed something about ${lead.company} online`
    const convBody = `Hi there,

I work with local businesses around ${lead.city} and was looking up ${lead.company} earlier today.

${issue}

I've seen firsthand how just having a simple, modern page where customers can easily find your hours and services straight from their phones makes a massive difference in steady walk-ins.

If you're open to improving your digital footprint, feel free to reply to this email.

Best,
Mohammed Ahad`

    // Variant C: Curiosity Tone
    const curSubject = `One thing ${lead.company} is missing`
    const curBody = `Hi ${lead.company} team,

Are you currently taking on new customers in ${lead.city}?

${issue}

Customers checking their phones while deciding where to go often click away if they can't find a direct page. Fixing this is usually the fastest way to capture that lost traffic.

If you're open to improving your digital footprint, feel free to reply to this email.

Thanks,
Mohammed Ahad`

    const getWordCount = (text: string) => text.split(/\s+/).filter(w => w.trim().length > 0).length

    return [
        { variant_id: 'A', subject: profSubject, body: profBody, word_count: getWordCount(profBody), tone: 'professional' },
        { variant_id: 'B', subject: convSubject, body: convBody, word_count: getWordCount(convBody), tone: 'conversational' },
        { variant_id: 'C', subject: curSubject, body: curBody, word_count: getWordCount(curBody), tone: 'curiosity' }
    ]
}

// ─── Helpers ──────────────────────────────────────────────────────

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
