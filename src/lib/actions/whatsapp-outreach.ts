/**
 * WhatsApp Outreach Service
 * Uses Twilio REST API for delivery and OpenRouter for personalization.
 */

import { supabaseAdmin as supabase } from '../supabase-admin'

// ─── Types ────────────────────────────────────────────────────────

interface WhatsAppLead {
    id: string
    name: string
    city: string
    country?: string
    phone: string
    category?: string
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
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+12134600101'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'anthropic/claude-3.5-sonnet'

// ─── Phone Formatting (E.164) ─────────────────────────────────────

/**
 * Formats a phone number to E.164, default to US if no country or 10 digits
 */
export function formatE164(phone: string, country?: string): string {
    let digits = phone.replace(/\D/g, '')
    
    // GCC Country Codes
    const gcc: Record<string, string> = {
        'UAE': '971',
        'Saudi Arabia': '966',
        'Kuwait': '965',
        'Qatar': '974',
        'Bahrain': '973',
        'Oman': '968'
    }

    if (country && gcc[country]) {
        if (!digits.startsWith(gcc[country])) {
            digits = gcc[country] + digits
        }
    } else if (digits.length === 10) {
        // Assume US if 10 digits
        digits = '1' + digits
    }

    return `+${digits}`
}

// ─── AI Message Generation ────────────────────────────────────────

/**
 * Uses OpenRouter to generate a personalized WhatsApp message
 */
async function generateWhatsAppMessage(lead: WhatsAppLead): Promise<string> {
    if (!OPENROUTER_KEY) {
        return `Hi! I was looking up ${lead.category || 'local businesses'} in ${lead.city} and came across ${lead.name}.\n\nI noticed you don't have a dedicated website yet — I put together a quick free preview of what one could look like for you.\n\nWant me to send the link? No pressure at all.\n\n— MAK Software Solutions`
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
                        content: `You are a friendly, direct web developer from MAK Software Solutions. 
                                  Generate a personalized WhatsApp outreach message for a local business.
                                  Constraints:
                                  - Max 300 characters.
                                  - Tone: Friendly, direct, not salesy.
                                  - Mention the business name and city.
                                  - End with soft CTA: "Want a free website audit?".
                                  - Sign off as: MAK Software Solutions.`
                    },
                    {
                        role: 'user',
                        content: `Business: ${lead.name}
                                  City: ${lead.city}
                                  Issue: ${lead.opportunity_summary || 'No dedicated website'}`
                    }
                ]
            })
        })

        const data = await response.json()
        return data.choices?.[0]?.message?.content || 'Hi! Interested in a free website preview for ' + lead.name + '?'
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

    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    
    // Twilio expects application/x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('From', TWILIO_FROM)
    params.append('To', `whatsapp:${to}`)
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
 * Logs result to database.
 */
export async function triggerWhatsAppOutreach(lead: WhatsAppLead) {
    console.log(`[WhatsAppOutreach] Initializing for ${lead.name} (${lead.phone})`)
    
    const formattedPhone = formatE164(lead.phone, lead.country)
    const body = await generateWhatsAppMessage(lead)

    try {
        const twilio = await sendWhatsAppViaTwilio(formattedPhone, body)

        // Log results (handles status tracking)
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
            sequence_status: 'active'
        })

        if (logErr) console.error('[WhatsAppOutreach] DB Log error:', logErr)

        // Update lead status in CRM
        await supabase.from('leads').update({
            status: 'contacted',
            contacted_at: new Date().toISOString(),
            contact_method: 'whatsapp'
        }).eq('id', lead.id)

        // Handle Twilio Offline error (63007) gracefully
        if (twilio.error_code === 63007) {
             console.warn('[WhatsAppOutreach] Twilio Sender is OFFLINE (63007) — logged as failed/pending.')
             return { success: false, error: 'Sender offline' }
        }

        return { success: true, sid: twilio.sid }

    } catch (e: any) {
        console.error('[WhatsAppOutreach] Fatal failure:', e)
        
        const { error: finalLogErr } = await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.name,
            channel: 'whatsapp',
            send_status: 'failed',
            failure_reason: e.message,
            touch_number: 1
        })
        if (finalLogErr) console.error('[WhatsAppOutreach] Final log error:', finalLogErr)

        return { success: false, error: e.message }
    }
}
