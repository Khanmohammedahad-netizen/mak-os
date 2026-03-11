import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'
import { processLeadSequence, type PhoneLead } from '@/lib/agents/phone-outreach-agent'

export const maxDuration = 300 // 5 minutes max execution time

export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return cronUnauthorized()
    }

    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')

        // Fetch limits from process.env, with aggressive fallbacks
        const limitSMS = parseInt(process.env.MAX_SMS_PER_DAY || '20')
        const limitWA = parseInt(process.env.MAX_WHATSAPP_PER_DAY || '10')
        const limitCalls = parseInt(process.env.MAX_CALLS_PER_DAY || '5')

        // To calculate how many leads we can afford to pull today, we check today's sent count
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)

        // Count how many we already sent today
        const { count: sentToday } = await supabase
            .from('phone_outreach_log')
            .select('id', { count: 'exact', head: true })
            .gte('sent_at', todayStart.toISOString())
            .eq('touch_number', 1)

        // Global safeguard budget if limits aren't strict per-channel yet
        const totalBudget = (limitSMS + limitWA + limitCalls)
        const budgetRemaining = Math.max(0, totalBudget - (sentToday || 0))

        if (budgetRemaining === 0) {
            return NextResponse.json({ status: 'skipped', reason: 'Daily phone limits reached' })
        }

        // Fetch pending phone leads using the SQL view created in Phase 1
        const { data: pendingLeads, error } = await supabase
            .from('phone_leads_pending')
            .select('*')
            .limit(budgetRemaining)

        if (error || !pendingLeads || pendingLeads.length === 0) {
            return NextResponse.json({ status: 'complete', message: 'No pending phone leads found' })
        }

        const results = {
            leads_processed: 0,
            success: 0,
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
                social_links: rawLead.social_links
            }

            results.leads_processed++
            const outcome = await processLeadSequence(lead, 1)

            if (outcome.success) {
                results.success++
            } else {
                results.failed++
            }
        }

        return NextResponse.json({
            status: 'complete',
            ...results
        })

    } catch (err: any) {
        console.error('[Cron PhoneOutreach] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
