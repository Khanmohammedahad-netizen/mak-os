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

        // 1. Get ONE queued lead (prioritizing high-score)
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

        console.log(`[PulseCron] Processing: ${lead.company} (ID: ${lead.id})`)

        // 2. Decide Channel (Email vs WhatsApp)
        // If email exists and not already contacted, try email. 
        // If email is missing OR email failed OR status is 'contacted' (from email), tray WhatsApp if phone exists.
        const canEmail = lead.email && lead.status === 'new'
        const canWhatsApp = lead.phone && (lead.status === 'new' || lead.status === 'contacted')

        if (canEmail) {
            // ... (existing email logic)
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
                return NextResponse.json({ status: 'failed', reason: 'Email Quality Gate failed' })
            }

            const resultMail = await sendOutreachEmail({
                to: lead.email,
                subject: gate.selected_subject!,
                body: gate.selected_body!,
                fromEmail: process.env.OUTREACH_FROM_EMAIL
            })

            if (resultMail.success) {
                await supabase.from('leads').update({
                    status: 'contacted',
                    contacted_at: new Date().toISOString(),
                    message_id: resultMail.messageId,
                    outreach_message: gate.selected_body!.substring(0, 500),
                    contact_method: 'emailed',
                }).eq('id', lead.id)

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
            }
            
            return NextResponse.json({ status: resultMail.success ? 'success' : 'failed', channel: 'email' })
        } 
        
        if (canWhatsApp) {
            const { triggerWhatsAppOutreach } = await import('@/lib/actions/whatsapp-outreach')
            const resultWA = await triggerWhatsAppOutreach({
                id: lead.id,
                name: lead.company,
                city: lead.city || 'your area',
                phone: lead.phone
            })

            if (resultWA.success) {
                // update lead status if not already contacted
                if (lead.status === 'new') {
                   await supabase.from('leads').update({
                        status: 'contacted',
                        contacted_at: new Date().toISOString(),
                        contact_method: 'whatsapp',
                    }).eq('id', lead.id)
                }

                await supabase.from('outreach_log').insert({
                    lead_id: lead.id,
                    business_name: lead.company,
                    touch_number: 1,
                    send_status: 'sent',
                    sent_at: new Date().toISOString(),
                    channel: 'whatsapp',
                    message_sid: resultWA.sid
                })
            }

            return NextResponse.json({ status: resultWA.success ? 'success' : 'failed', channel: 'whatsapp' })
        }

        return NextResponse.json({ status: 'skipped', reason: 'No valid channel found' })

    } catch (err: any) {
        console.error('[PulseCron] Error:', err.message)
        return NextResponse.json({ status: 'error', message: err.message }, { status: 200 })
    }
}
