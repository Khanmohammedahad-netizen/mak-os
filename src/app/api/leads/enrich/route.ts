import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { enrichContacts } from '@/lib/apify'
import { triggerWhatsAppOutreach } from '@/lib/actions/whatsapp-outreach'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leads/enrich
 *
 * Takes a lead ID, looks up its website, and runs the Apify Contact Info
 * Scraper to find owner email/phone. Updates the lead in Supabase.
 *
 * Body: { leadId: string }
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient()

    try {
        const { leadId } = await request.json()

        if (!leadId) {
            return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
        }

        // 1. Get lead from DB
        const { data: lead, error: fetchErr } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single()

        if (fetchErr || !lead) {
            return NextResponse.json(
                { error: fetchErr?.message || 'Lead not found' },
                { status: 404 }
            )
        }

        // 2. Run Contact Information Search
        let enrichedEmail: string | null = null
        if (lead.website) {
            const results = await enrichContacts([lead.website])
            if (results.length > 0 && results[0].emails.length > 0) {
                enrichedEmail = results[0].emails[0]
            }
        } else {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.company)}`
            console.log(`[Enrich] No website for "${lead.company}", trying Google search fallback`)
            const results = await enrichContacts([searchUrl])
            if (results.length > 0 && results[0].emails.length > 0) {
                enrichedEmail = results[0].emails[0]
            }
        }

        // 3. Update DB if email found
        if (enrichedEmail) {
            await supabase.from('leads').update({
                email: enrichedEmail,
                status: 'enriched',
            }).eq('id', leadId)
        }

        // 4. Always attempt WhatsApp outreach if phone available
        if (lead.phone) {
            console.log(`[Enrich] Triggering WhatsApp for ${lead.company} (${lead.phone})`)
            const waResult = await triggerWhatsAppOutreach({
                id: lead.id,
                name: lead.company,
                city: lead.city || 'Dubai',
                country: lead.country || undefined,
                phone: lead.phone,
                business_type: lead.category || undefined,
                pain_point: lead.opportunity_summary || undefined
            }, true) // BYPASS registration check for manual click

            if (waResult.success) {
                // If WA sent, mark as wa_sent (even if email was found, WA is more immediate)
                await supabase.from('leads').update({ status: 'wa_sent' }).eq('id', leadId)
                return NextResponse.json({
                    success: true,
                    status: 'wa_sent',
                    enriched: { email: enrichedEmail },
                    message: 'WhatsApp outreach triggered.'
                })
            }
        }

        // 5. Final fallback if No WhatsApp and No Email
        if (enrichedEmail) {
            return NextResponse.json({
                success: true,
                status: 'enriched',
                enriched: { email: enrichedEmail }
            })
        }

        const fallbackStatus = lead.phone ? 'unreachable' : 'no_email'
        await supabase.from('leads').update({ status: fallbackStatus }).eq('id', leadId)
        return NextResponse.json({ 
            success: false, 
            status: fallbackStatus, 
            message: 'Contact info search yielded no results.' 
        })

    } catch (err: any) {
        console.error('[Enrich] API Fatal Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
