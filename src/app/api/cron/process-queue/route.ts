import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'
import { buildOutreachVariants } from '@/lib/zoho-mail'
import { sendOutreachEmail } from '@/lib/email/service'
import { evaluateVariants } from '@/lib/quality-gate'

export const maxDuration = 60 // 1 minute is plenty for one email

export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return cronUnauthorized()
    }

    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')

        // 1. Get ONE queued lead
        const { data: lead, error: fetchErr } = await supabase
            .from('leads')
            .select('*')
            .eq('contact_method', 'queued')
            .order('priority_score', { ascending: false })
            .limit(1)
            .single()

        if (fetchErr || !lead) {
            return NextResponse.json({ status: 'idle', message: 'No queued leads found' })
        }

        console.log(`[PulseCron] Processing: ${lead.company} (${lead.email})`)

        // 2. Generate content
        const variants = buildOutreachVariants({
            company: lead.company,
            city: lead.city || 'your area',
            category: lead.category,
            auditCategory: lead.website_category,
            opportunitySummary: lead.opportunity_summary,
        })

        const gate = evaluateVariants(lead.company, lead.city || 'your area', variants)

        if (gate.gate_result === 'fail' || !gate.selected_variant) {
            await supabase.from('leads').update({ contact_method: 'gate_failed' }).eq('id', lead.id)
            return NextResponse.json({ status: 'failed', reason: 'Quality gate failed' })
        }

        // 3. Send Email
        const resultMail = await sendOutreachEmail({
            to: lead.email,
            subject: gate.selected_subject!,
            body: gate.selected_body!,
            fromEmail: process.env.OUTREACH_FROM_EMAIL
        })

        if (!resultMail.success) {
            throw new Error(resultMail.error || 'SMTP Error')
        }

        // 4. Update CRM
        await supabase.from('leads').update({
            status: 'contacted',
            contacted_at: new Date().toISOString(),
            message_id: resultMail.messageId,
            outreach_message: gate.selected_body!.substring(0, 500),
            contact_method: 'emailed',
        }).eq('id', lead.id)

        // Log entry
        try {
            await supabase.from('outreach_log').insert({
                lead_id: lead.id,
                business_name: lead.company,
                email_address: lead.email,
                touch_number: 1,
                subject: gate.selected_subject,
                body: gate.selected_body,
                send_status: 'sent',
                sent_at: new Date().toISOString(),
                sequence_status: 'active',
                variant_used: gate.selected_variant,
                gate_score: (gate.scores as any)[gate.selected_variant!].average
            })
        } catch (logErr) {
            console.error('[PulseCron] Log insert failed:', logErr)
        }

        return NextResponse.json({
            status: 'success',
            lead: lead.company,
            provider: resultMail.provider
        })

    } catch (err: any) {
        console.error('[PulseCron] Error:', err.message)
        return NextResponse.json({ status: 'error', message: err.message }, { status: 200 })
    }
}
