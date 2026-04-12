import { generateSMS, sendSMSViaGateway } from './sms-gateway-agent'
import { triggerWhatsAppOutreach } from '../actions/whatsapp-outreach'
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
    // Rule 1: Social-only presence (Instagram/Salon)
    if ((lead.social_links?.some(l => l.includes('instagram')) || lead.category?.toLowerCase().includes('salon')) && lead.website_category === 'C') {
        return {
            primaryChannel: 'instagram_dm',
            fallbackChannel: 'sms_gateway',
            reasoning: 'Social-only presence — Instagram DM'
        }
    }

    // Rule 2: High-WhatsApp markets
    const waCities = ['miami', 'new york', 'los angeles', 'dubai', 'abu dhabi', 'sharjah']
    if (waCities.some(c => lead.city.toLowerCase().includes(c))) {
        return {
            primaryChannel: 'whatsapp',
            fallbackChannel: 'sms_gateway',
            reasoning: 'High WhatsApp adoption market'
        }
    }

    // Rule 3: High-value lead + Bland AI
    if (lead.priority_score >= 9.0 && process.env.BLAND_AI_ENABLED === 'true') {
        return {
            primaryChannel: 'ai_call',
            fallbackChannel: 'sms_gateway',
            reasoning: 'Premium lead — AI voice call'
        }
    }

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
    try {
        if (channel === 'sms_gateway') {
            const smsMsg = await generateSMS({
                businessName: lead.company,
                city: lead.city,
                websiteCategory: lead.website_category
            })
            const carrierData = await lookupCarrier(lead.phone)
            const result = await sendSMSViaGateway(lead.phone, smsMsg.body, carrierData.carrier)
            return result.success
        }

        if (channel === 'whatsapp') {
            // UPDATED: Now uses consolidated Twilio Content Template logic
            const result = await triggerWhatsAppOutreach({
                id: lead.id,
                name: lead.company,
                city: lead.city,
                phone: lead.phone
            })
            return result.success
        }

        if (channel === 'ai_call') {
            const script = generateCallScript({
                businessName: lead.company,
                city: lead.city,
                websiteCategory: lead.website_category
            })
            const result = await initiateAICall(lead.phone, script, lead.id)
            return result.success
        }

        if (channel === 'instagram_dm') return true

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

    const { data: supressed } = await supabase.from('phone_suppression_list').select('phone_number').eq('phone_number', lead.phone).single()
    if (supressed) return { success: false, channelUsed: 'none', error: 'Number is suppressed' }

    const decision = selectChannel(lead)
    let selectedChannel = decision.primaryChannel

    if (touchNumber > 1) {
        const { data: previousLog } = await supabase
            .from('phone_outreach_log')
            .select('channel')
            .eq('lead_id', lead.id)
            .eq('touch_number', touchNumber - 1)
            .single()

        if (previousLog) {
            if (previousLog.channel === 'sms_gateway') selectedChannel = 'whatsapp'
            else if (previousLog.channel === 'whatsapp') selectedChannel = 'sms_gateway'
        } else {
            selectedChannel = 'sms_gateway'
        }
    }

    let success = false
    let finalChannel = selectedChannel

    success = await executeChannel(selectedChannel, lead, { touchNumber })

    if (!success && touchNumber === 1 && decision.fallbackChannel) {
        console.log(`[Orchestrator] Falling back to ${decision.fallbackChannel} for ${lead.company}`)
        finalChannel = decision.fallbackChannel
        success = await executeChannel(decision.fallbackChannel, lead, { touchNumber })
    }

    // Final result tracking
    const { data: outcomeData, error: logErr } = await supabase.from('phone_outreach_log').insert({
        lead_id: lead.id,
        business_name: lead.company,
        phone_number: lead.phone,
        channel: finalChannel,
        touch_number: touchNumber,
        send_status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
        failure_reason: success ? null : 'Channel execution failed',
        sequence_status: touchNumber === 3 ? 'complete' : 'active'
    })

    if (success && touchNumber === 1) {
        await supabase.from('leads').update({
            status: 'contacted',
            contacted_at: new Date().toISOString()
        }).eq('id', lead.id)
    }

    return { success, channelUsed: finalChannel }
}
