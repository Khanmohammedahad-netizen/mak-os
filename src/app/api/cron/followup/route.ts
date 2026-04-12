import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendOutreachEmail } from '@/lib/email/service'
import { buildOutreachVariants } from '@/lib/zoho-mail'

import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'

/* Stage 6: AutomationAgent    → Send email via Brevo API (or flag for phone) */

export const maxDuration = 300 // Max 5 mins for Vercel Cron

export async function GET(request: Request) {
    if (!verifyCronSecret(request as any)) {
        return cronUnauthorized()
    }

    try {
        const supabase = await createSupabaseServerClient()
        const logs: string[] = []
        let limitRemaining = 15 // Daily limit for follow-ups

        logs.push(`[FollowUpAgent] Triggered. Remaining budget: ${limitRemaining}`)

        // 1. Fetch active sequences that need touch 2 (sent_at > 3 days ago, touch_number = 1)
        // or touch 3 (sent_at > 6 days ago, touch_number = 2)
        const { data: activeLogs, error: logErr } = await supabase
            .from('outreach_log')
            .select('*')
            .eq('sequence_status', 'active')
            .in('touch_number', [1, 2])

        if (logErr) throw logErr

        const now = new Date()

        for (const log of activeLogs || []) {
            if (limitRemaining <= 0) break

            const sentAt = new Date(log.sent_at)
            const daysSince = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 3600 * 24))

            let shouldSend = false
            const nextTouch = log.touch_number + 1
            let body = ''
            let subject = log.subject
            if (!subject.startsWith('Re:')) subject = `Re: ${subject}`

            if (log.touch_number === 1 && daysSince >= 4) {
                shouldSend = true
                body = `Hi ${log.business_name} team,\n\nJust bumping this to the top of your inbox. Did you get a chance to look at my previous email?\n\nIf you're too busy right now, just let me know and I'll close out your file.\n\nBest,\nMohammed Ahad`
            } else if (log.touch_number === 2 && daysSince >= 6) {
                shouldSend = true
                body = `Hi ${log.business_name} team,\n\nI haven't heard back, so I'll assume improving your website isn't a priority right now and stop reaching out.\n\nIf you ever need help capturing more local traffic in the future, my door is open.\n\nThanks,\nMohammed Ahad`
            }

            if (shouldSend) {
                logs.push(`[FollowUpAgent] Sending Touch ${nextTouch} to ${log.email_address} (${log.business_name}) | Waited ${daysSince} days`)

                try {
                    const mailResult = await sendOutreachEmail({
                        to: log.email_address,
                        subject: subject,
                        body: body,
                        fromEmail: process.env.OUTREACH_FROM_EMAIL
                    })

                    if (!mailResult.success) {
                        throw new Error(mailResult.error || 'Failed sending via unified service')
                    }

                    // Mark previous touch as completed
                    await supabase.from('outreach_log')
                        .update({ sequence_status: 'completed' })
                        .eq('id', log.id)

                    // Insert new touch
                    const newStatus = nextTouch === 3 ? 'completed' : 'active'
                    await supabase.from('outreach_log').insert({
                        lead_id: log.lead_id,
                        business_name: log.business_name,
                        email_address: log.email_address,
                        touch_number: nextTouch,
                        subject: subject,
                        body: body,
                        send_status: 'sent',
                        sent_at: new Date().toISOString(),
                        sequence_status: newStatus
                    })

                    // Update Lead
                    await supabase.from('leads').update({
                        message_id: mailResult.messageId // store latest messageID for tracking
                    }).eq('id', log.lead_id)

                    limitRemaining--

                } catch (e: any) {
                    logs.push(`[FollowUpAgent] Error sending to ${log.email_address}: ${e.message}`)
                }
            }
        }

        logs.push(`[FollowUpAgent] Finished. Budget remaining: ${limitRemaining}`)

        return NextResponse.json({ success: true, logs })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
