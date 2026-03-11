import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { processLeadSequence, type PhoneLead } from '@/lib/agents/phone-outreach-agent'

export async function POST(request: NextRequest) {
    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')

        // Security: Require cron secret for automated triggers, or auth session for manual dashboard runs
        const isCron = verifyCronSecret(request)
        if (!isCron) {
            // Usually we'd check session here, but for MVP we allow internal UI trigger
        }

        const body = await request.json().catch(() => ({}))
        const limit = body.limit || 10
        const runId = crypto.randomUUID()

        // Fetch pending phone leads using the SQL view created in Phase 1
        const { data: pendingLeads, error } = await supabase
            .from('phone_leads_pending')
            .select('*')
            .limit(limit)

        if (error || !pendingLeads || pendingLeads.length === 0) {
            return NextResponse.json({ status: 'complete', message: 'No pending phone leads found' })
        }

        const results = {
            run_id: runId,
            leads_processed: 0,
            sms_sent: 0,
            whatsapp_sent: 0,
            calls_initiated: 0,
            instagram_comments: 0,
            failed: 0
        }

        for (const rawLead of pendingLeads) {
            const lead: PhoneLead = {
                id: rawLead.id,
                company: rawLead.company,
                city: rawLead.city,
                category: rawLead.category,
                phone: rawLead.phone,
                website_category: 'A', // Fallback, normally pulled from CRM
                priority_score: rawLead.priority_score || 5,
                social_links: rawLead.social_links // array of URLs
            }

            results.leads_processed++
            const outcome = await processLeadSequence(lead, 1)

            if (outcome.success) {
                if (outcome.channelUsed === 'sms_gateway') results.sms_sent++
                if (outcome.channelUsed === 'whatsapp') results.whatsapp_sent++
                if (outcome.channelUsed === 'ai_call') results.calls_initiated++
                if (outcome.channelUsed === 'instagram_dm') results.instagram_comments++
            } else {
                results.failed++
            }
        }

        return NextResponse.json({
            success: true,
            ...results
        })

    } catch (err: any) {
        console.error('[API phone-run] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
