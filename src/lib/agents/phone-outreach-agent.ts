import { generateSMS, sendSMSViaGateway } from './sms-gateway-agent'
import { sendWhatsAppMessage } from '../channels/whatsapp'
import { initiateAICall, generateCallScript } from './ai-call-agent'
import { lookupCarrier } from '../phone/carrier-lookup'

export interface PhoneLead {
    id: string
    company: string
    city: string
    category: string
    phone: string
    website_category: 'A' | 'B' | 'C' | 'D'
    priority_score: number
    social_links?: string[]
}

export type OutreachChannel = 'sms_gateway' | 'whatsapp' | 'ai_call' | 'instagram_dm' | 'facebook_dm'

export interface ChannelDecision {
    primaryChannel: OutreachChannel
    fallbackChannel: OutreachChannel | null
    reasoning: string
}

/**
 * Determines the optimal outreach channel based on lead characteristics.
 */
export function selectChannel(lead: PhoneLead): ChannelDecision {

    // Rule 1: If lead has Instagram and is Category C → Instagram DM first
    if ((lead.social_links?.some(l => l.includes('instagram')) || lead.category?.toLowerCase().includes('salon')) && lead.website_category === 'C') {
        return {
            primaryChannel: 'instagram_dm',
            fallbackChannel: 'sms_gateway',
            reasoning: 'Social-only presence — Instagram DM is highest conversion channel'
        }
    }

    // Rule 2: Miami / New York or similar high-WhatsApp markets → WhatsApp first
    const waCities = ['miami', 'new york', 'los angeles', 'hialeah', 'doral']
    if (waCities.some(c => lead.city.toLowerCase().includes(c))) {
        return {
            primaryChannel: 'whatsapp',
            fallbackChannel: 'sms_gateway',
            reasoning: 'High WhatsApp adoption market'
        }
    }

    // Rule 3: High-value lead (score 9+) and AI calls enabled → call first
    if (lead.priority_score >= 9.0 && process.env.BLAND_AI_ENABLED === 'true') {
        return {
            primaryChannel: 'ai_call',
            fallbackChannel: 'sms_gateway',
            reasoning: 'Premium lead — voice call maximizes conversion'
        }
    }

    // Default: SMS gateway (always available, always free)
    return {
        primaryChannel: 'sms_gateway',
        fallbackChannel: null,
        reasoning: 'Standard SMS outreach'
    }
}

/**
 * Executes a specific outreach channel. Returns true if successful.
 */
async function executeChannel(channel: OutreachChannel, lead: PhoneLead, _context: { touchNumber: number }): Promise<boolean> {
    const slug = lead.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    try {
        if (channel === 'sms_gateway') {
            const smsMsg = await generateSMS({
                businessName: lead.company,
                city: lead.city,
                websiteCategory: lead.website_category,
                previewSlug: slug
            })

            const carrierData = await lookupCarrier(lead.phone)
            const result = await sendSMSViaGateway(lead.phone, smsMsg.body, carrierData.carrier)

            return result.success
        }

        if (channel === 'whatsapp') {
            const body = `Hi! I was looking up ${lead.category || 'local businesses'} in ${lead.city} and came across ${lead.company}.\n\nI noticed you don't have a dedicated website yet — I put together a quick free preview of what one could look like for you, just to show you what's possible.\n\nNo pitch, no pressure — just want to show you the preview if you're curious. Want me to send the link?\n\n— Mohammed`
            const result = await sendWhatsAppMessage(lead.phone, body)
            return result.success
        }

        if (channel === 'ai_call') {
            const script = generateCallScript({
                businessName: lead.company,
                city: lead.city,
                websiteCategory: lead.website_category,
                previewSlug: slug
            })
            const result = await initiateAICall(lead.phone, script, lead.id)

            // If Bland AI isn't configured, we consider this a fail so it falls back appropriately
            return result.success
        }

        if (channel === 'instagram_dm') {
            // For MVP, if we select Instagram, we consider it a success since the 
            // operator would need to manually copy the comment from the dashboard to send it.
            // In a V2 with Graph API permissions, this would actually send.
            return true
        }

        return false
    } catch (e) {
        console.error(`[Orchestrator] Failed executing ${channel} for ${lead.company}:`, e)
        return false
    }

}

/**
 * Triggers the Touch sequence for a specific lead.
 */
export async function processLeadSequence(lead: PhoneLead, touchNumber: 1 | 2 | 3): Promise<{ success: boolean; channelUsed: string; error?: string }> {
    const { supabaseAdmin: supabase } = await import('../supabase-admin')

    // 1. Double check the suppression list
    const { data: supressed } = await supabase.from('phone_suppression_list').select('phone_number').eq('phone_number', lead.phone).single()
    if (supressed) {
        return { success: false, channelUsed: 'none', error: 'Number is suppressed' }
    }

    const decision = selectChannel(lead)
    let selectedChannel = decision.primaryChannel
    let bodyUsed = ''

    // Touch 2 and 3 handling - Rotate Channels and Shorten Messages
    if (touchNumber > 1) {
        // Find previous touch
        const { data: previousLog } = await supabase
            .from('phone_outreach_log')
            .select('channel')
            .eq('lead_id', lead.id)
            .eq('touch_number', touchNumber - 1)
            .single()

        // If they received an SMS first, try WhatsApp for Touch 2. If they got WA, try SMS.
        if (previousLog) {
            if (previousLog.channel === 'sms_gateway') selectedChannel = 'whatsapp'
            else if (previousLog.channel === 'whatsapp') selectedChannel = 'sms_gateway'
            else if (previousLog.channel === 'ai_call') selectedChannel = 'sms_gateway'
        } else {
            selectedChannel = 'sms_gateway' // safe fallback
        }

        // Generate Touch 2/3 specific short copy
        const domain = process.env.NEXT_PUBLIC_SITE_URL || 'maksoftware.io'
        const slug = lead.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const link = `https://${domain}/preview/${slug}`

        if (touchNumber === 2) {
            bodyUsed = `Hey ${lead.company} — sent a note last week about your online presence. Free preview still works if you want to peek: ${link} — Mohammed Ahad`
        } else if (touchNumber === 3) {
            bodyUsed = `Last note from me — free preview for ${lead.company} is still up at ${link}. All yours if you ever want it. Reply STOP to opt out. — Mohammed Ahad`
        }
    }

    let success = false
    let finalChannel = selectedChannel

    // Execute Touch 1 (Standard execution with full logic)
    if (touchNumber === 1) {
        success = await executeChannel(selectedChannel, lead, { touchNumber })

        // Execute fallback if primary failed
        if (!success && decision.fallbackChannel) {
            console.log(`[Orchestrator] Falling back to ${decision.fallbackChannel} for ${lead.company}`)
            finalChannel = decision.fallbackChannel
            success = await executeChannel(decision.fallbackChannel, lead, { touchNumber })
        }
    } else {
        // Execute Touch 2/3 (Direct SMS or WhatsApp with short body)
        if (finalChannel === 'sms_gateway') {
            const carrierData = await lookupCarrier(lead.phone)
            const result = await sendSMSViaGateway(lead.phone, bodyUsed, carrierData.carrier)
            success = result.success
        } else if (finalChannel === 'whatsapp') {
            const result = await sendWhatsAppMessage(lead.phone, bodyUsed)
            success = result.success
        }
    }

    if (success) {
        // Log the successful execution
        await supabase.from('phone_outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.company,
            phone_number: lead.phone,
            channel: finalChannel,
            touch_number: touchNumber,
            message_body: bodyUsed || 'Dynamic generated',
            send_status: 'sent',
            sent_at: new Date().toISOString(),
            sequence_status: touchNumber === 3 ? 'complete' : 'active'
        })

        // On Touch 1, mark the CRM lead record as contacted
        if (touchNumber === 1) {
            await supabase.from('leads').update({
                status: 'contacted',
                contacted_at: new Date().toISOString()
            }).eq('id', lead.id)
        }
    } else {
        // Log the failure
        await supabase.from('phone_outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.company,
            phone_number: lead.phone,
            channel: finalChannel,
            touch_number: touchNumber,
            send_status: 'failed',
            failure_reason: 'Execution threw or returned false',
            sequence_status: 'active'
        })
    }

    return { success, channelUsed: finalChannel }
}
