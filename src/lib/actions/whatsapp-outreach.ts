import { supabaseAdmin as supabase } from '../supabase-admin'
import { normalizeWhatsAppNumber } from '@/lib/utils/normalize-phone'

/*
  WHATSAPP TEMPLATE SETUP (one-time manual step):
  - Category: MARKETING
  - SID: HX279eba9368bd098f04577ddb043d9637
  - Body: "Hi {{1}}, we noticed your business in {{2}} doesn't have a website yet.
           MAK Software Solutions builds professional websites — reply YES for a demo."
*/

// ─── Types ────────────────────────────────────────────────────────

interface WhatsAppLead {
    id: string
    name: string // Business Name
    city: string
    country?: string
    phone: string
    business_type?: string
    pain_point?: string
    opportunity_summary?: string
    whatsapp_registered?: boolean | null
    whatsapp_checked_at?: string | null
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
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '+12134600101'
const TEMPLATE_SID = process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'HX279eba9368bd098f04577ddb043d9637'

// ─── Hardened Gating ──────────────────────────────────────────────

/**
 * Checks WhatsApp registration using Twilio Lookup v2 with persistent cache.
 * Fail-safe: returns false on error to prevent invalid send attempts.
 */
async function isOnWhatsApp(phone: string, leadId: string): Promise<boolean> {
    const { data: cached } = await (supabase.from('leads') as any)
      .select('whatsapp_registered, whatsapp_checked_at')
      .eq('id', leadId)
      .single()
  
    if (cached?.whatsapp_checked_at && cached?.whatsapp_registered !== null) {
      return cached.whatsapp_registered === true
    }
  
    try {
      if (!TWILIO_SID || !TWILIO_TOKEN) return false
      const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const lookup = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=whatsapp`,
        { headers: { 'Authorization': `Basic ${auth}` } }
      )
      
      if (!lookup.ok) return false
      const data = await lookup.json()
      const registered = data?.whatsapp?.registered === true
  
      await (supabase.from('leads') as any).update({
        whatsapp_registered: registered,
        whatsapp_checked_at: new Date().toISOString()
      }).eq('id', leadId)
  
      return registered
    } catch (err) {
      console.error('[WhatsAppLookup] Error:', err)
      return false
    }
}

// ─── Twilio Integration ───────────────────────────────────────────

/**
 * Sends a WhatsApp message via Twilio Content Template API.
 * CRITICAL: All 'body' fields must be removed to avoid Error 63016.
 */
async function sendWhatsAppTemplate(to: string, contentSid: string, variables: Record<string, string>): Promise<TwilioResponse> {
    if (!TWILIO_SID || !TWILIO_TOKEN) {
        throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
    }

    const fromPrefixed = `whatsapp:+${TWILIO_WHATSAPP_FROM.replace(/^\+/, '').replace('whatsapp:', '')}`
    const toPrefixed = `whatsapp:+${to.replace(/^\+/, '').replace('whatsapp:', '')}`
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    
    const params = new URLSearchParams()
    params.append('From', fromPrefixed)
    params.append('To', toPrefixed)
    params.append('ContentSid', contentSid)
    params.append('ContentVariables', JSON.stringify(variables))

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
 * Trigger WhatsApp Outreach using hardened template-first logic.
 */
export async function triggerWhatsAppOutreach(lead: WhatsAppLead) {
    // Startup Guard 
    if (!TEMPLATE_SID) {
        console.error('[WhatsAppOutreach] ABORTED — TWILIO_WHATSAPP_TEMPLATE_SID not set')
        return { success: false, error: 'missing_template_sid' }
    }

    console.log(`[WhatsAppOutreach] Initializing for ${lead.name} (${lead.phone})`)
    
    const normalized = normalizeWhatsAppNumber(lead.phone, lead.city, lead.country || '')
    if (!normalized) {
        await (supabase.from('leads') as any).update({ status: 'unreachable' }).eq('id', lead.id)
        return { success: false, error: 'unreachable' }
    }

    // Hardened Registration Gate (Resolves 63024)
    const registered = await isOnWhatsApp(normalized, lead.id)
    if (!registered) {
        console.log(`[WhatsApp] SKIPPED — ${lead.name}: not on WhatsApp`)
        await (supabase.from('outreach_log') as any).insert({
            lead_id: lead.id, business_name: lead.name, channel: 'whatsapp',
            send_status: 'skipped', failure_reason: 'not_on_whatsapp',
            original_phone: lead.phone, normalized_phone: normalized
        })
        await (supabase.from('leads') as any).update({ status: 'unreachable' }).eq('id', lead.id)
        return { success: false, error: 'not_on_whatsapp' }
    }

    try {
        const variables = { "1": lead.name, "2": lead.city }
        
        // Debug Test Log (as requested)
        console.log(`[WhatsApp] Sending template ${TEMPLATE_SID} to ${normalized} — vars: ${lead.name}, ${lead.city}`)

        // Dispatch via Template API (Resolves 63016)
        const twilio = await sendWhatsAppTemplate(normalized, TEMPLATE_SID, variables)

        await supabase.from('outreach_log').insert({
            lead_id: lead.id, business_name: lead.name,
            body: `Template: ${TEMPLATE_SID} | Vars: ${JSON.stringify(variables)}`,
            subject: 'WhatsApp Outreach (Template)', channel: 'whatsapp',
            message_sid: twilio.sid, wa_status: twilio.status || 'queued',
            send_status: twilio.status === 'failed' ? 'failed' : 'sent',
            sent_at: new Date().toISOString(), failure_reason: twilio.error_message || null,
            touch_number: 1, sequence_status: 'active', variant_used: 'template'
        })

        if (twilio.status !== 'failed') {
            await supabase.from('leads').update({
                status: 'wa_sent', contacted_at: new Date().toISOString(),
                contact_method: 'whatsapp', phone: normalized
            }).eq('id', lead.id)
        }

        return { success: true, sid: twilio.sid }
    } catch (e: any) {
        console.error('[WhatsAppOutreach] Fatal failure:', e)
        return { success: false, error: e.message }
    }
}
