import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { enrichContacts } from '@/lib/apify'

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

        // 2. If lead has no website, we can't enrich — need a URL to scrape
        if (!lead.website) {
            // Try a Google search URL as fallback
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.company)}`
            console.log(`[Enrich] No website for "${lead.company}", using Google search fallback`)

            const results = await enrichContacts([searchUrl])

            if (results.length > 0 && results[0].emails.length > 0) {
                const { error: updateErr } = await supabase
                    .from('leads')
                    .update({
                        email: results[0].emails[0],
                        status: 'enriched',
                    })
                    .eq('id', leadId)

                if (updateErr) {
                    return NextResponse.json(
                        { error: `DB update failed: ${updateErr.message}` },
                        { status: 500 }
                    )
                }

                return NextResponse.json({
                    success: true,
                    enriched: {
                        email: results[0].emails[0],
                        phones: results[0].phones,
                        socials: results[0].socials,
                    },
                })
            }

            return NextResponse.json({
                success: false,
                message: 'No contact info found for this business.',
            })
        }

        // 3. Scrape the business website for contact info
        const results = await enrichContacts([lead.website])

        if (results.length > 0 && results[0].emails.length > 0) {
            const { error: updateErr } = await supabase
                .from('leads')
                .update({
                    email: results[0].emails[0],
                    status: 'enriched',
                })
                .eq('id', leadId)

            if (updateErr) {
                return NextResponse.json(
                    { error: `DB update failed: ${updateErr.message}` },
                    { status: 500 }
                )
            }

            return NextResponse.json({
                success: true,
                enriched: {
                    email: results[0].emails[0],
                    phones: results[0].phones,
                    socials: results[0].socials,
                },
            })
        }

        return NextResponse.json({
            success: false,
            message: 'No contact info found on the website.',
        })
    } catch (err: any) {
        console.error('[Enrich] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
