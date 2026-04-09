import { NextRequest, NextResponse } from 'next/server'
import { triggerWhatsAppOutreach } from '@/lib/actions/whatsapp-outreach'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
    try {
        const { leadId } = await request.json()
        if (!leadId) {
            return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
        }

        // 1. Fetch lead
        const { data: lead, error: fetchErr } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single()

        if (fetchErr || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }

        if (!lead.phone) {
            return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 })
        }

        console.log(`[Manual WhatsApp] Triggering for: ${lead.company} (ID: ${lead.id})`)

        // 2. Attempt outreach (triggerWhatsAppOutreach now handles the lookup gate with fallback)
        const result = await triggerWhatsAppOutreach({
            id: lead.id,
            name: lead.company,
            city: lead.city || 'your area',
            phone: lead.phone
        })

        if (!result.success) {
            return NextResponse.json({ 
                success: false, 
                error: result.error || 'WhatsApp send failed' 
            }, { status: 500 })
        }

        // 3. Update lead status if successful
        const { error: updateErr } = await supabase.from('leads').update({
            status: 'wa_sent',
            whatsapp_status: 'sent',
            whatsapp_message_sid: result.sid,
            contacted_at: new Date().toISOString()
        }).eq('id', lead.id)

        if (updateErr) {
            console.error('[Manual WhatsApp] Database Update Error:', updateErr)
            return NextResponse.json({ 
                success: false, 
                error: `Database update failed: ${updateErr.message}. Make sure you have run the SQL migration.` 
            }, { status: 500 })
        }

        // 4. Log the outreach
        const { error: logErr } = await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.company,
            touch_number: 1,
            send_status: 'sent',
            sent_at: new Date().toISOString(),
            channel: 'whatsapp',
            whatsapp_status: 'sent',
            whatsapp_message_sid: result.sid,
            whatsapp_message_body: result.body,
            message_sid: result.sid // backwards compatibility
        })

        if (logErr) {
            console.warn('[Manual WhatsApp] Outreach Logging Failed:', logErr)
            // We don't necessarily abort here if the lead status update succeeded, 
            // but it's good for debugging missing columns in outreach_log.
        }

        return NextResponse.json({
            success: true,
            sid: result.sid
        })

    } catch (err: any) {
        console.error('[Manual WhatsApp] Critical Error:', err.message)
        return NextResponse.json({ 
            error: err.message 
        }, { status: 500 })
    }
}
