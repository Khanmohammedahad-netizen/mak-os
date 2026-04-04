import { supabaseAdmin as supabase } from '../supabase-admin'
import { normalizeWhatsAppNumber } from '@/lib/utils/normalize-phone'

/*
  WHATSAPP TEMPLATE SETUP (one-time manual step):
  1. Go to Twilio Console → Messaging → Content Template Builder
  2. Create template with category: MARKETING
  3. Body example:
     "Hi {{1}}, we noticed your business in {{2}} doesn't have a website yet.
      MAK Software Solutions builds professional websites — reply YES to see a free demo."
  4. Submit for Meta approval (24-48hrs)
  5. Once approved, copy the Content SID → set as TWILIO_WHATSAPP_TEMPLATE_SID
*/

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
const TEMPLATE_SID = process.env.TWILIO_WHATSAPP_TEMPLATE_SID

// ─── Hardened Gating & Caching ─────────────────────────────────────

/**
 * Checks if a phone number is registered on WhatsApp using Twilio Lookup v2.
 * Hardened with fail-safe logic and persistent caching in Supabase.
 */
async function isOnWhatsApp(phone: string, leadId: string): Promise<boolean> {
    // 1. Check Supabase cache first
    const { data: cached } = await (supabase.from('leads') as any)
      .select('whatsapp_registered, whatsapp_checked_at')
      .eq('id', leadId)
      .single()
  
    if (cached?.whatsapp_checked_at && cached?.whatsapp_registered !== null) {
      return cached.whatsapp_registered === true
    }
  
    // 2. Call Twilio Lookup v2
    try {
      if (!TWILIO_SID || !TWILIO_TOKEN) return false

      const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const lookup = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=whatsapp`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      )
      
      if (!lookup.ok) {
          console.error('[WhatsAppLookup] API error:', await lookup.text())
          return false // Fail safe - do NOT send if lookup errors
      }

      const data = await lookup.json()
      const registered = data?.whatsapp?.registered === true
  
      // 3. Write result to cache — always, even if false
      await (supabase.from('leads') as any).update({
        whatsapp_registered: registered,
        whatsapp_checked_at: new Date().toISOString()
      }).eq('id', leadId)
  
      return registered
    } catch (err) {
      console.error('[WhatsAppLookup] Fatal execution failure:', err)
      return false // Fail safe
    }
}

// ─── Twilio Integration ───────────────────────────────────────────

/**
 * Sends a WhatsApp message via Twilio Content Template API.
 * This resolves Error 63016 (Session Window violation) for cold leads.
 */
async function sendWhatsAppTemplate(to: string, contentSid: string, variables: Record<string, string>): Promise<TwilioResponse> {
    if (!TWILIO_SID || !TWILIO_TOKEN) {
        throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
    }

    // Defensive prefixing: whatsapp:+1...
    const fromFormatted = `whatsapp:+${TWILIO_WHATSAPP_FROM.replace(/^\+/, '').replace('whatsapp:', '')}`
    const toFormatted = `whatsapp:+${to.replace(/^\+/, '').replace('whatsapp:', '')}`

    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    
    const params = new URLSearchParams()
    params.append('From', fromFormatted)
    params.append('To', toFormatted)
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

    const data = await res.json()
    return data as TwilioResponse
}

// ─── Main Entry Point ─────────────────────────────────────────────

/**
 * Personalizes and sends a template-based WhatsApp outreach.
 * Resolves Errors 63016 (Templates) and 63024 (Lookup Gating).
 */
export async function triggerWhatsAppOutreach(lead: WhatsAppLead) {
    console.log(`[WhatsAppOutreach] Initializing for ${lead.name} (${lead.phone})`)
    
    // Step 1: Normalize Number (E.164)
    const normalized = normalizeWhatsAppNumber(lead.phone, lead.city, lead.country || '')
    
    if (!normalized) {
        console.warn(`[WhatsAppOutreach] Normalization failed for ${lead.phone}.`)
        await (supabase.from('leads') as any).update({ status: 'unreachable' }).eq('id', lead.id)
        return { success: false, error: 'unreachable' }
    }

    // Step 1.2: Placeholder Guard — Skip if template SID is missing (prevent 63016)
    if (!TEMPLATE_SID) {
        console.warn(`[WhatsAppOutreach] ABORTED — TWILIO_WHATSAPP_TEMPLATE_SID is not set. Template required for cold outreach.`)
        return { success: false, error: 'missing_template_sid' }
    }

    // Step 2: Hardened Lookup Gate (Wait for confirm) — Resolves 63024
    const registered = await isOnWhatsApp(normalized, lead.id)
    if (!registered) {
        console.warn(`[WhatsAppOutreach] SKIPPED — ${lead.name}: not on WhatsApp (confirmed by v2 Lookup).`)
        
        await (supabase.from('outreach_log') as any).insert({
            lead_id: lead.id,
            business_name: lead.name,
            channel: 'whatsapp',
            send_status: 'skipped',
            failure_reason: 'not_on_whatsapp',
            original_phone: lead.phone,
            normalized_phone: normalized
        })
        
        await (supabase.from('leads') as any).update({ status: 'unreachable' }).eq('id', lead.id)
        return { success: false, error: 'not_on_whatsapp' }
    }

    try {
        // Step 3: Dispatch via Twilio Templates — Resolves 63016
        const variables = {
            "1": lead.name,
            "2": lead.city
        }

        const twilio = await sendWhatsAppTemplate(normalized, TEMPLATE_SID, variables)

        // Step 4: Log Results
        await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.name,
            body: `Template: ${TEMPLATE_SID} | Vars: ${JSON.stringify(variables)}`,
            subject: 'WhatsApp Outreach (Template)',
            channel: 'whatsapp',
            message_sid: twilio.sid,
            wa_status: twilio.status || 'queued',
            send_status: twilio.status === 'failed' ? 'failed' : 'sent',
            sent_at: new Date().toISOString(),
            failure_reason: twilio.error_message || null,
            touch_number: 1,
            sequence_status: 'active',
            variant_used: 'template',
            original_phone: lead.phone,
            normalized_phone: normalized
        })

        if (twilio.status !== 'failed') {
            await supabase.from('leads').update({
                status: 'wa_sent',
                contacted_at: new Date().toISOString(),
                contact_method: 'whatsapp',
                phone: normalized
            }).eq('id', lead.id)
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
