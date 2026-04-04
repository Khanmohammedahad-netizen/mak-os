/**
 * Twilio WhatsApp Webhook Handler
 * Captures delivery status updates (sent, delivered, read, failed)
 * and updates the outreach_log table.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: Request) {
    try {
        // Twilio sends data as application/x-www-form-urlencoded
        const formData = await req.formData()
        const sid = formData.get('MessageSid') as string
        const status = formData.get('MessageStatus') as string
        const errorCode = formData.get('ErrorCode') as string
        const errorMessage = formData.get('ErrorMessage') as string

        if (!sid) {
            return NextResponse.json({ error: 'Missing MessageSid' }, { status: 400 })
        }

        console.log(`[TwilioWebhook] Update for SID: ${sid} -> Status: ${status}`)

        // Map Twilio status to our internal send_status if necessary
        // Twilio statuses: queued, failed, sent, delivered, undelivered, read
        let sendStatus = 'sent'
        if (status === 'failed' || status === 'undelivered') sendStatus = 'failed'
        if (status === 'delivered' || status === 'read') sendStatus = 'sent' // Still 'sent' but we track wa_status

        const { error } = await supabase
            .from('outreach_log')
            .update({
                wa_status: status,
                send_status: sendStatus,
                failure_reason: errorMessage || null
            })
            .eq('message_sid', sid)

        if (error) {
            console.error('[TwilioWebhook] Database update error:', error)
            return NextResponse.json({ error: 'DB Update Failed' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (e: any) {
        console.error('[TwilioWebhook] Fatal Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
