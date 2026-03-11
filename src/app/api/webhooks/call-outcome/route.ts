import { NextRequest, NextResponse } from 'next/server'
import { sendSMSViaGateway } from '@/lib/agents/sms-gateway-agent'

export async function POST(request: NextRequest) {
    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')
        const body = await request.json()
        const leadId = body.metadata?.lead_id

        if (!leadId) {
            return NextResponse.json({ error: 'Missing lead_id metadata' }, { status: 400 })
        }

        const duration = body.call_length || 0
        const transcript = body.transcripts || []

        // Parse outcome from the end-of-call data.
        const outcome = classifyCallOutcome(body, transcript)

        // 1. Log the call outcome into Phone Outreach Log
        await supabase
            .from('phone_outreach_log')
            .update({
                call_outcome: outcome,
                call_duration_seconds: duration,
                send_status: 'delivered',
                updated_at: new Date().toISOString()
            })
            .eq('lead_id', leadId)
            .eq('channel', 'ai_call')

        // 2. Automated Follow-up Strategy
        // If they requested the text message, or if we left a voicemail promising the text, 
        // dispatch it immediately.
        if (outcome === 'voicemail' || outcome === 'answered_interested') {
            await triggerPostCallSMS(leadId, outcome)
        }

        // 3. (Optional CRM Push) Update lead status to "replied" to notify operator of interest
        if (outcome === 'answered_interested') {
            await supabase
                .from('leads')
                .update({ status: 'replied' })
                .eq('id', leadId)
        }

        return NextResponse.json({ received: true, outcome })
    } catch (err: any) {
        console.error('[BlandWebhook] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

/**
 * Parses Bland.ai call metadata to determine exactly what happened.
 */
function classifyCallOutcome(data: any, transcripts: any[]): string {
    const callStatus = data.status || ''

    if (callStatus === 'no-answer' || callStatus === 'canceled') return 'no_answer'
    if (callStatus === 'voicemail') return 'voicemail'

    // Text parsing heuristics to gauge sentiment
    const fullTranscript = transcripts.map((t: any) => (t.text || '').toLowerCase()).join(' ')
    if (fullTranscript.includes('yes') || fullTranscript.includes('send it') || fullTranscript.includes('sure')) {
        return 'answered_interested'
    }

    if (fullTranscript.includes('not interested') || fullTranscript.includes('no thanks') || fullTranscript.includes('take me off')) {
        return 'answered_not_interested'
    }

    return 'answered_unknown' // They answered but the script completion sentiment was vague
}

/**
 * Triggers an immediate follow-up SMS containing the actual preview link
 * after an AI Call concludes with a voicemail or an "interested" outcome.
 */
async function triggerPostCallSMS(leadId: string, outcome: string) {
    const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')
    // 1. Look up the lead to get their phone number and details
    const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

    if (!lead || !lead.phone) return

    // 2. Fetch the initial Touch 1 log to see what was sent in the AI script
    const { data: log } = await supabase
        .from('phone_outreach_log')
        .select('*')
        .eq('lead_id', leadId)
        .eq('touch_number', 1)
        .single()

    const domain = process.env.NEXT_PUBLIC_SITE_URL || 'maksoftware.io'
    const slug = lead.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const link = `${domain}/preview/${slug}`

    let smsBody = ''
    if (outcome === 'voicemail') {
        smsBody = `Hi ${lead.company}! Just left a voicemail. I built the free customized website preview I mentioned. You can view it directly on your phone here: ${link} — Mohammed Ahad`
    } else {
        smsBody = `Hi, this is Mohammed from the phone call. As promised, here is the free preview link for ${lead.company}: ${link}`
    }

    // Safety fallback
    if (smsBody.length > 160) {
        smsBody = `Hi, Mohammed here from the call. Here is the free preview link for ${lead.company}: ${link}`
    }

    // Attempt to pull the cached carrier, otherwise use the multi-send gateway strategy
    await sendSMSViaGateway(lead.phone, smsBody, log?.carrier)

    // Log the follow-up text exactly like a Touch 1b
    await supabase.from('phone_outreach_log').insert({
        lead_id: leadId,
        business_name: lead.company,
        phone_number: lead.phone,
        channel: 'sms_gateway',
        touch_number: 1, // Considered part of the initial touch cluster
        message_body: smsBody,
        send_status: 'sent',
        sent_at: new Date().toISOString(),
        sequence_status: 'active'
    })
}
