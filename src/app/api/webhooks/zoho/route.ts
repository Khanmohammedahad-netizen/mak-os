import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Webhook intended for Zoho Mail rules to forward incoming emails.
 * Receives JSON webhook payloads and matches the sender to `outreach_log`.
 */
export async function POST(request: Request) {
    try {
        const payload = await request.json()

        // Expecting some standard payload structure from Zoho / Make.com webhook
        // We'll normalize to a basic { from, subject, body }
        const fromHeader: string = payload.from || payload.sender || ''
        const textBody: string = typeof payload.text === 'string' ? payload.text :
            (typeof payload.body === 'string' ? payload.body : '')

        // Extract email address like "John <john@example.com>" -> "john@example.com"
        const emailMatch = fromHeader.match(/<([^>]+)>/)
        const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : fromHeader.trim().toLowerCase()

        if (!senderEmail) {
            return NextResponse.json({ error: 'No sender email found' }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient()

        // Match sender to an active lead in outreach_log
        const { data: logEntry, error: logErr } = await supabase
            .from('outreach_log')
            .select('*')
            .eq('email_address', senderEmail)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single()

        if (logErr || !logEntry) {
            // Unrecognized sender — ignore
            return NextResponse.json({ status: 'ignored', reason: 'Not an active sequence' })
        }

        // We have a match! It's a reply to our campaign.
        const leadId = logEntry.lead_id

        // Simple Keyword-based Sentiment Classification
        const textLower = textBody.toLowerCase()
        let sentiment = 'neutral'

        if (textLower.includes('unsubscribe') || textLower.includes('take me off') || textLower.includes('remove me') || textLower.includes('stop emailing')) {
            sentiment = 'unsubscribe'
        } else if (textLower.includes('interested') || textLower.includes('call me') || textLower.includes('yes') || textLower.includes('sounds good')) {
            sentiment = 'positive'
        } else if (textLower.includes('no thanks') || textLower.includes('not interested') || textLower.includes('we are good') || textLower.includes('have a website')) {
            sentiment = 'negative'
        }

        // Insert into replies log
        await supabase.from('replies').insert({
            lead_id: leadId,
            outreach_log_id: logEntry.id,
            email_address: senderEmail,
            body: textBody,
            sentiment: sentiment
        })

        // Halt the sequence
        await supabase.from('outreach_log')
            .update({ sequence_status: 'halted' })
            .eq('lead_id', leadId)
            .eq('sequence_status', 'active')

        // Update main CRM lead based on sentiment
        let newStatus = 'replied'
        if (sentiment === 'positive') newStatus = 'interested'
        else if (sentiment === 'negative' || sentiment === 'unsubscribe') newStatus = 'not_interested'

        await supabase.from('leads').update({
            status: newStatus,
            replied_at: new Date().toISOString()
        }).eq('id', leadId)

        return NextResponse.json({ success: true, lead_id: leadId, sentiment })

    } catch (e: any) {
        console.error('[ReplyWebhook] Error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
