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
        await supabase.from('leads').update({
            status: 'wa_sent',
            contacted_at: new Date().toISOString()
        }).eq('id', lead.id)

        // 4. Log the outreach
        await supabase.from('outreach_log').insert({
            lead_id: lead.id,
            business_name: lead.company,
            touch_number: 1,
            send_status: 'sent',
            sent_at: new Date().toISOString(),
            channel: 'whatsapp',
            message_sid: result.sid
        })

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
