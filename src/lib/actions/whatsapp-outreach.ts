import { supabaseAdmin as supabase } from '../supabase-admin'
import { normalizeWhatsAppNumber } from '@/lib/utils/normalize-phone'

// ─── Startup Diagnostics ──────────────────────────────────────────
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '+12134600101'
const TEMPLATE_SID = process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'HX279eba9368bd098f04577ddb043d9637'

// STEP 1: Exact startup log requested by user
console.log('[WhatsApp] TEMPLATE_SID loaded:', process.env.TWILIO_WHATSAPP_TEMPLATE_SID ?? 'MISSING')
console.log(`[WhatsApp] Startup — SID: ${TWILIO_SID ? TWILIO_SID.substring(0, 6) + '...' : 'MISSING'}`)
console.log(`[WhatsApp] Startup — AUTH_TOKEN: ${TWILIO_TOKEN ? 'SET ✓' : 'MISSING ✗'}`)
console.log(`[WhatsApp] Startup — FROM: ${TWILIO_WHATSAPP_FROM}`)

interface WhatsAppLead {
    id: string
    name: string // Business Name
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

async function isOnWhatsApp(phone: string, leadId: string): Promise<boolean> {
    const { data: cached } = await (supabase.from('leads') as any)
      .select('whatsapp_registered, whatsapp_checked_at')
      .eq('id', leadId)
      .single()
  
    // If already checked, use cached value
    if (cached?.whatsapp_checked_at) {
      return cached.whatsapp_registered === true
    }
  
    try {
      if (!TWILIO_SID || !TWILIO_TOKEN) {
          console.warn('[WhatsApp] No Twilio credentials — allowing send as fallback')
          return true
      }
      
      const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const lookup = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=whatsapp`,
        { headers: { 'Authorization': `Basic ${auth}` } }
      )
      
      const data = await lookup.json()
      const registered = data?.whatsapp?.registered === true
      
      console.log(`[WhatsApp] Lookup result for ${phone}: ${registered}`)
  
      await (supabase.from('leads') as any).update({
        whatsapp_registered: registered,
        whatsapp_checked_at: new Date().toISOString()
      }).eq('id', leadId)
  
      return registered
    } catch (err) {
      console.error('[WhatsApp] Lookup FAILED — allowing send as fallback. Reason:', err)
      return true // FIX 2: Default to ALLOW send on failure
    }
}

async function sendWhatsAppTemplate(to: string, contentSid: string, variables: Record<string, string>): Promise<TwilioResponse> {
    if (!TWILIO_SID || !TWILIO_TOKEN) throw new Error('Missing Twilio credentials in environment variables')

    const fromPrefixed = `whatsapp:+${TWILIO_WHATSAPP_FROM.replace(/^\+/, '').replace('whatsapp:', '')}`
    const toPrefixed = `whatsapp:+${to.replace(/^\+/, '').replace('whatsapp:', '')}`
    
    console.log(`[WhatsApp] Sending from ${fromPrefixed} to ${toPrefixed}`)

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

    const data = await res.json()
    
    if (!res.ok) {
        console.error(`[WhatsApp] Twilio API Error (${res.status}):`, data)
        return {
            sid: data.sid || '',
            status: 'failed',
            error_code: data.code,
            error_message: data.message || res.statusText
        }
    }

    return data
}

export async function triggerWhatsAppOutreach(lead: WhatsAppLead, bypassRegistration: boolean = false) {
    // 1. Validate Credentials
    if (!TWILIO_SID || !TWILIO_TOKEN) {
        console.error('[WhatsApp] ABORTED — Reason: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set')
        return { success: false, error: 'missing_credentials' }
    }

    if (!TEMPLATE_SID) {
        console.error('[WhatsApp] ABORTED — Reason: TWILIO_WHATSAPP_TEMPLATE_SID not set')
        return { success: false, error: 'missing_template_sid' }
    }

    // 2. Normalize and Validate Number
    const normalized = normalizeWhatsAppNumber(lead.phone, lead.city, lead.country || '')
    if (!normalized) {
        console.error(`[WhatsApp] SKIPPED — Reason: Normalization failed for ${lead.phone}`)
        return { success: false, error: 'unreachable' }
    }

    // 3. Verify Registration (skip if bypassed)
    if (!bypassRegistration) {
        const registered = await isOnWhatsApp(normalized, lead.id)
        if (!registered) {
            console.warn(`[WhatsApp] SKIPPED — Reason: Not on WhatsApp for ${normalized}`)
            return { success: false, error: 'not_on_whatsapp' }
        }
    } else {
        console.log(`[WhatsApp] BYPASSING registration check for ${normalized}`)
    }

    console.log(`[WhatsApp] Attempting send — Template: ${TEMPLATE_SID}, To: ${normalized}`)

    try {
        const variables = { "1": lead.name, "2": lead.city }
        const twilio = await sendWhatsAppTemplate(normalized, TEMPLATE_SID, variables)

        if (twilio.error_code) {
            console.error(`[WhatsApp] FAILED — Twilio Error Code ${twilio.error_code}: ${twilio.error_message}`)
            return { success: false, error: twilio.error_message, errorCode: twilio.error_code }
        }

        const reconstructedBody = `Hi ${lead.name}, I found your business in ${lead.city} and I'm a local developer. I'd love to chat about how I can help you capture more local customers.`

        console.log(`[WhatsApp] SUCCESS — SID: ${twilio.sid}, Status: ${twilio.status}`)

        // Persist outreach status to Supabase
        await supabase
            .from('leads')
            .update({
                whatsapp_sent_at: new Date().toISOString(),
                whatsapp_status: 'sent',
                status: 'contacted'
            })
            .eq('id', lead.id);

        return { 
            success: true, 
            sid: twilio.sid,
            body: reconstructedBody 
        }
    } catch (e: any) {
        console.error(`[WhatsApp] CRITICAL FAILURE — Reason: ${e.message}`)
        return { success: false, error: e.message }
    }
}

