import { NextRequest, NextResponse } from 'next/server'
import { triggerWhatsAppOutreach } from '@/lib/actions/whatsapp-outreach'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const manualTo = searchParams.get('to')
        const manualName = searchParams.get('name') || 'Test User'

        let leadId = 'test-manual'
        let leadPhone = manualTo
        let leadName = manualName
        let leadCity = 'Test City'

        if (!manualTo) {
            // 1. Pick ONE lead with a GCC phone number if no manual 'to' is provided
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
                    message: 'No suitable GCC lead found for testing and no "?to=" parameter provided. Ensure you have leads in Supabase or provide a test number.' 
                }, { status: 404 })
            }
            leadId = lead.id
            leadPhone = lead.phone
            leadName = lead.company
            leadCity = lead.city || 'your area'
        }

        console.log(`[WhatsApp Test] Triggering for: ${leadName} (${leadPhone})`)

        // 2. Attempt outreach
        const result = await triggerWhatsAppOutreach({
            id: leadId,
            name: leadName,
            city: leadCity,
            phone: leadPhone!
        }, !!manualTo) // Bypass registration check if manually testing

        // 3. Return full result for debugging
        return NextResponse.json({
            success: result.success,
            target: {
                id: leadId,
                name: leadName,
                phone: leadPhone,
                city: leadCity
            },
            outreachResult: result,
            config: {
                from: process.env.TWILIO_WHATSAPP_FROM,
                templateSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'MISSING'
            }
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
