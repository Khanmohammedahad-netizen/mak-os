import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendWithRetry } from '@/lib/email/brevo'
import { buildOutreachVariants } from '@/lib/zoho-mail'

/**
 * POST /api/leads/email
 *
 * Takes a lead ID, generates a personalized cold email, sends via Zoho Mail,
 * and updates the lead status to "emailed".
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

        // 2. Must have an email to send to
        if (!lead.email) {
            return NextResponse.json(
                { error: 'Lead has no email. Enrich the lead first.' },
                { status: 400 }
            )
        }

        // 3. Don't send duplicate emails
        if (lead.status === 'emailed') {
            return NextResponse.json(
                { error: 'Email already sent to this lead.' },
                { status: 409 }
            )
        }

        // 4. Build the cold outreach email
        const variants = buildOutreachVariants({
            company: lead.company,
            city: lead.city || 'your area',
            category: lead.category || null,
        })
        const { subject, body: text } = variants[0]

        // 5. Send via Brevo
        const mailResult = await sendWithRetry({
            to: lead.email,
            subject,
            body: text,
            replyTo: process.env.OUTREACH_FROM_EMAIL
        })

        if (!mailResult.success) {
            return NextResponse.json({ error: mailResult.error || 'Failed sending via Brevo' }, { status: 500 })
        }

        // 6. Update lead status
        const { error: updateErr } = await supabase
            .from('leads')
            .update({ status: 'emailed' })
            .eq('id', leadId)

        if (updateErr) {
            console.error('[Email] Status update failed:', updateErr)
        }

        return NextResponse.json({
            success: true,
            messageId: mailResult.messageId,
            sentTo: lead.email,
            subject,
        })
    } catch (err: any) {
        console.error('[Email] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
