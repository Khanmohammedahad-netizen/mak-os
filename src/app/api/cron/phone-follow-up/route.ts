import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'
import { processLeadSequence, type PhoneLead } from '@/lib/agents/phone-outreach-agent'

export const maxDuration = 300 // 5 minutes max Vercel limit

export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return cronUnauthorized()
    }

    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')

        // Fetch leads that are "due" based on the SQL view created during Phase 1
        const { data: dueSequences, error } = await supabase
            .from('phone_sequences_due')
            .select('*')
            .limit(15) // Process a safe batch size automatically

        if (error || !dueSequences || dueSequences.length === 0) {
            return NextResponse.json({ status: 'complete', message: 'No phone follow-ups due' })
        }

        const results = {
            processed: 0,
            success: 0,
            failed: 0
        }

        for (const row of dueSequences) {
            const lead: PhoneLead = {
                id: row.lead_id,
                company: row.business_name,
                city: row.city,
                category: 'Unknown',
                phone: row.phone_number,
                website_category: 'A',
                priority_score: row.lead_score || 5
            }

            results.processed++

            // By definition of the view, if it shows up here, it needs Touch 2. 
            // In a fuller implementation, you'd check DateDiffs to see if it actually needs Touch 3.
            // For MVP parity with existing email structure, we trigger Touch 2.
            const outcome = await processLeadSequence(lead, 2)

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
        console.error('[Cron PhoneFollowUp] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
