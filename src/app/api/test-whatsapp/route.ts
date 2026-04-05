import { NextRequest, NextResponse } from 'next/server'
import { triggerWhatsAppOutreach } from '@/lib/actions/whatsapp-outreach'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        // 1. Pick ONE lead with a GCC phone number
        // (Prioritizing Dubai/UAE/Saudi for testing)
        const { data: lead, error: fetchErr } = await supabase
            .from('leads')
            .select('*')
            .not('phone', 'is', null)
            .or('city.ilike.%dubai%,city.ilike.%abu dhabi%,city.ilike.%riyadh%')
            .limit(1)
            .single()

        if (fetchErr || !lead) {
            return NextResponse.json({ 
                status: 'error', 
                message: 'No suitable GCC lead found for testing. Ensure you have leads with phone numbers and GCC cities in Supabase.' 
            }, { status: 404 })
        }

        console.log(`[WhatsApp Test] Triggering for: ${lead.company} (${lead.phone})`)

        // 2. Attempt outreach
        const result = await triggerWhatsAppOutreach({
            id: lead.id,
            name: lead.company,
            city: lead.city || 'your area',
            phone: lead.phone
        })

        // 3. Return full result for debugging
        return NextResponse.json({
            success: result.success,
            lead: {
                id: lead.id,
                name: lead.company,
                phone: lead.phone,
                city: lead.city
            },
            twilioResponse: result,
            templateSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'MISSING'
        })

    } catch (err: any) {
        console.error('[WhatsApp Test] Critical Error:', err.message)
        return NextResponse.json({ 
            status: 'error', 
            message: err.message,
            stack: err.stack 
        }, { status: 500 })
    }
}
