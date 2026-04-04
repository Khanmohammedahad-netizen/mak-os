import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { enrichContacts } from '@/lib/apify'
import { validateGCCPhone } from '@/lib/utils/phone-validation'
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

            // --- Enrichment Failure Handling ---
            const validation = validateGCCPhone(lead.phone, lead.city)
            
            if (validation.status === 'wa_ready') {
                // Trigger WhatsApp Outreach
                await triggerWhatsAppOutreach({
                    id: lead.id,
                    name: lead.company,
                    city: lead.city || 'Dubai',
                    phone: lead.phone!,
                    category: lead.category || undefined
                })
                
                return NextResponse.json({
                    success: true,
                    message: 'No email found. WhatsApp outreach triggered.',
                    status: 'wa_sent'
                })
            }

            // Update status based on validation
            await supabase.from('leads').update({
                status: validation.status === 'bad_data' ? 'bad_data' : 'unreachable',
                phone: validation.status === 'bad_data' ? null : lead.phone
            }).eq('id', leadId)

            return NextResponse.json({
                success: false,
                message: validation.status === 'bad_data' ? 'Bad phone data for this region.' : 'No contact info found.',
                status: validation.status
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

        // --- Enrichment Failure Handling ---
        const validation = validateGCCPhone(lead.phone, lead.city)
        
        if (validation.status === 'wa_ready') {
            await triggerWhatsAppOutreach({
                id: lead.id,
                name: lead.company,
                city: lead.city || 'Dubai',
                phone: lead.phone!,
                category: lead.category || undefined
            })
            
            return NextResponse.json({
                success: true,
                message: 'No email found. WhatsApp outreach triggered.',
                status: 'wa_sent'
            })
        }

        await supabase.from('leads').update({
            status: validation.status === 'bad_data' ? 'bad_data' : 'unreachable',
            phone: validation.status === 'bad_data' ? null : lead.phone
        }).eq('id', leadId)

        return NextResponse.json({
            success: false,
            message: validation.status === 'bad_data' ? 'Bad phone data for this region.' : 'No contact info found on the website.',
            status: validation.status
        })
    } catch (err: any) {
        console.error('[Enrich] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
