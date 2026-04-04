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

        // --- Helper: Fallback to WhatsApp if Email fails/unavailable ---
        async function attemptWhatsAppFallback() {
            if (lead.phone) {
                const waResult = await triggerWhatsAppOutreach({
                    id: lead.id,
                    name: lead.company,
                    city: lead.city || 'Dubai',
                    country: lead.country || undefined,
                    phone: lead.phone,
                    business_type: lead.category || undefined,
                    pain_point: lead.opportunity_summary || undefined
                })

                if (waResult.success) {
                    return { success: true, status: 'wa_sent', message: 'WhatsApp outreach triggered.' }
                } else if (waResult.error === 'unreachable') {
                    await supabase.from('leads').update({ status: 'unreachable' }).eq('id', leadId)
                    return { success: false, status: 'unreachable', message: 'Phone number could not be normalized.' }
                }
            }
            
            const fallbackStatus = lead.phone ? 'unreachable' : 'no_email'
            await supabase.from('leads').update({ status: fallbackStatus }).eq('id', leadId)
            return { success: false, status: fallbackStatus, message: 'Contact info search yielded no results.' }
        }

        // 2. If lead has no website, try a Google search URL as fallback first
        if (!lead.website) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.company)}`
            console.log(`[Enrich] No website for "${lead.company}", trying Google search fallback`)

            const results = await enrichContacts([searchUrl])

            if (results.length > 0 && results[0].emails.length > 0) {
                await supabase.from('leads').update({
                    email: results[0].emails[0],
                    status: 'enriched',
                }).eq('id', leadId)

                return NextResponse.json({
                    success: true,
                    enriched: { email: results[0].emails[0] }
                })
            }

            // Fallback to WhatsApp
            const fallback = await attemptWhatsAppFallback()
            return NextResponse.json(fallback)
        }

        // 3. Scrape the business website for contact info
        const results = await enrichContacts([lead.website])

        if (results.length > 0 && results[0].emails.length > 0) {
            await supabase.from('leads').update({
                email: results[0].emails[0],
                status: 'enriched',
            }).eq('id', leadId)

            return NextResponse.json({
                success: true,
                enriched: { email: results[0].emails[0] }
            })
        }

        // 4. Final Fallback if website scrape yielded no email
        const finalFallback = await attemptWhatsAppFallback()
        return NextResponse.json(finalFallback)

    } catch (err: any) {
        console.error('[Enrich] API Fatal Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
