import { NextRequest, NextResponse } from 'next/server'
import { initiateAICall } from '@/lib/agents/ai-call-agent'

export async function POST(request: NextRequest) {
    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')
        const { phone, voice, script, lead_id } = await request.json()

        if (!phone || !script) {
            return NextResponse.json({ error: 'Phone and script are required' }, { status: 400 })
        }

        let businessName = 'Test Call'
        let actualLeadId = lead_id

        if (lead_id) {
            const { data: lead } = await supabase
                .from('leads')
                .select('company')
                .eq('id', lead_id)
                .single()

            if (lead) businessName = lead.company
        }

        // 1. Initiate the call via Bland.ai
        const result = await initiateAICall(phone, script, actualLeadId || 'test-call', voice || 'maya')

        if (!result.success) {
            return NextResponse.json({
                error: result.disabled ? 'Bland AI is disabled' : 'Failed to initiate call'
            }, { status: 500 })
        }

        // 2. Log to phone_outreach_log
        await supabase.from('phone_outreach_log').insert({
            lead_id: actualLeadId || null,
            business_name: businessName,
            phone_number: phone,
            channel: 'ai_call',
            touch_number: 1,
            message_body: script,
            send_status: 'sent',
            sent_at: new Date().toISOString(),
            sequence_status: 'active'
        })

        return NextResponse.json({
            success: true,
            call_id: result.callId,
            status: 'Dialing...'
        })

    } catch (error: any) {
        console.error('[TestCallAPI] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
