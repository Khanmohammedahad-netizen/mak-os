import { supabaseAdmin as supabase } from '../supabase-admin'
import { normalizeWhatsAppNumber } from '@/lib/utils/normalize-phone'

// ─── Types ────────────────────────────────────────────────────────

interface WhatsAppLead {
    id: string
    name: string
    city: string
    country?: string
    phone: string
    business_type?: string
    pain_point?: string
    opportunity_summary?: string
}

interface TwilioResponse {
    sid: string
    status: string
    error_code?: number
    error_message?: string
}

// ─── Configuration ────────────────────────────────────────────────

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'anthropic/claude-3.5-sonnet'

// ─── AI Message Generation ────────────────────────────────────────

/**
 * Uses OpenRouter to generate a high-quality personalized WhatsApp message
 */
async function generateWhatsAppMessage(lead: WhatsAppLead): Promise<string> {
    if (!OPENROUTER_KEY) {
        return `Hi ${lead.name}! I noticed your business in ${lead.city} and wanted to reach out. I put together a quick free preview of what a new website could look like for you. Want me to send the link? No pressure. — MAK Software Solutions`
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'HTTP-Referer': 'https://maksoftware.io',
                'X-Title': 'MAK OS v1',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are an outreach specialist for MAK Software Solutions, a premium software and AI agency based in Hyderabad serving businesses globally. Write a WhatsApp message to a business owner. Be conversational, warm, and specific to their business. Never sound like a bot or mass mailer.`
                    },
                    {
                        role: 'user',
                        content: `Write a WhatsApp outreach message for:
- Business: ${lead.name}
- City: ${lead.city}, ${lead.country || 'Unknown'}
- Category: ${lead.business_type || lead.opportunity_summary || 'Business'}
- Their likely pain point: ${lead.pain_point || 'No dedicated website'}

Requirements:
- 150-250 characters (WhatsApp sweet spot, not too long)
- Start with their business name naturally
- Mention one specific thing relevant to their category
- Soft CTA: offer a free website audit or demo
- Sign off: MAK Software Solutions
- No emojis unless it feels natural
- Must feel handwritten, not automated`
                    }
                ]
            })
        })

        const data = await response.json()
        return data.choices?.[0]?.message?.content || `Hi ${lead.name}! Interested in a free website preview for your business in ${lead.city}? — MAK Software Solutions`
    } catch (e) {
        console.error('[WhatsAppPersonalization] AI generation failed:', e)
        return `Hi ${lead.name}, I noticed your business in ${lead.city} could use a website refresh. Want a free audit? — MAK Software Solutions`
    }
}

// ─── Twilio Integration ───────────────────────────────────────────

/**
 * Sends a message via Twilio WhatsApp API
 */
async function sendWhatsAppViaTwilio(to: string, body: string): Promise<TwilioResponse> {
    if (!TWILIO_SID || !TWILIO_TOKEN) {
        throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
    }

    const fromFormatted = `whatsapp:${(process.env.TWILIO_WHATSAPP_FROM || '+12134600101').replace('whatsapp:', '')}`
    const toFormatted = `whatsapp:${to.replace('whatsapp:', '')}`

    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    
    // Twilio expects application/x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('From', fromFormatted)
    params.append('To', toFormatted)
    params.append('Body', body)

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    })

    return res.json()
}

// ─── Main Entry Point ─────────────────────────────────────────────

/**
 * Personalizes and sends a WhatsApp message to a lead.
 * Logs result to database with intelligent normalization.
 */
export async function triggerWhatsAppOutreach(lead: WhatsAppLead) {
    console.log(`[WhatsAppOutreach] Initializing for ${lead.name} (${lead.phone})`)
    
    // Step 1: Normalize Number
    const normalized = normalizeWhatsAppNumber(lead.phone, lead.city, lead.country || '')
    
    if (!normalized) {
        console.warn(`[WhatsAppOutreach] Normalization failed for ${lead.phone} (${lead.city}). Marking as unreachable.`)
        await supabase.from('leads').update({ status: 'unreachable' }).eq('id', lead.id)
        
        await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.name,
            channel: 'whatsapp',
            send_status: 'failed',
            failure_reason: 'Invalid or unmappable phone format',
            original_phone: lead.phone
        })
        
        return { success: false, error: 'unreachable' }
    }

    // Step 2: Generate Content
    const body = await generateWhatsAppMessage(lead)

    try {
        // Step 3: Dispatch via Twilio
        const twilio = await sendWhatsAppViaTwilio(normalized, body)

        // Step 4: Log Results
        const { error: logErr } = await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.name,
            body: body,
            subject: 'WhatsApp Outreach',
            channel: 'whatsapp',
            message_sid: twilio.sid,
            wa_status: twilio.status || 'queued',
            send_status: twilio.status === 'failed' ? 'failed' : 'sent',
            sent_at: new Date().toISOString(),
            failure_reason: twilio.error_message || null,
            touch_number: 1,
            sequence_status: 'active',
            original_phone: lead.phone,
            normalized_phone: normalized
        })

        if (logErr) console.error('[WhatsAppOutreach] DB Log error:', logErr)

        // Step 5: Update Lead CRM Status
        if (twilio.status !== 'failed') {
            await supabase.from('leads').update({
                status: 'wa_sent',
                contacted_at: new Date().toISOString(),
                contact_method: 'whatsapp',
                phone: normalized // Persist the normalized number back
            }).eq('id', lead.id)
        }

        // Handle Twilio Offline error (63007) gracefully
        if (twilio.error_code === 63007) {
             console.warn('[WhatsAppOutreach] Twilio Sender is OFFLINE (63007) — logged as failed/pending.')
             return { success: false, error: 'Sender offline' }
        }

        return { success: true, sid: twilio.sid }

    } catch (e: any) {
        console.error('[WhatsAppOutreach] Fatal failure:', e)
        
        await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.name,
            channel: 'whatsapp',
            send_status: 'failed',
            failure_reason: e.message,
            original_phone: lead.phone,
            normalized_phone: normalized,
            touch_number: 1
        })

        return { success: false, error: e.message }
    }
}
