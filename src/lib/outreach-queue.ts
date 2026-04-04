/**
 * Outreach Queue — Rate-limited queue processor.
 *
 * Max 30 emails per day (resets at midnight UTC).
 * Processes leads in priority_score order (highest first).
 */

import { sendEmail, buildOutreachVariants } from './zoho-mail'

const DAILY_LIMIT = 30

export interface QueueResult {
    processed: number
    emailsSent: number
    phoneRequired: number
    remaining: number
    logs: string[]
}

/**
 * Process queued leads — sends emails to leads with contact_method 'queued'
 * that have an email, up to the daily limit.
 */
export async function processOutreachQueue(supabase: any): Promise<QueueResult> {
    const logs: string[] = []
    const result: QueueResult = {
        processed: 0, emailsSent: 0, phoneRequired: 0, remaining: 0, logs,
    }

    // 1. Check daily send count
    const sentToday = await getDailySentCount(supabase)
    const budget = Math.max(0, DAILY_LIMIT - sentToday)
    logs.push(`[Queue] Daily budget: ${budget}/${DAILY_LIMIT} (${sentToday} sent today)`)

    if (budget === 0) {
        logs.push(`[Queue] Daily limit reached. Try again tomorrow.`)
        return result
    }

    // 2. Fetch queued leads, ordered by priority
    const { data: queued, error } = await supabase
        .from('leads')
        .select('*')
        .eq('contact_method', 'queued')
        .not('email', 'is', null)
        .order('priority_score', { ascending: false })
        .limit(budget)

    if (error) {
        logs.push(`[Queue] Fetch error: ${error.message}`)
        return result
    }

    if (!queued || queued.length === 0) {
        logs.push(`[Queue] No leads in queue.`)
        return result
    }

    logs.push(`[Queue] Processing ${queued.length} leads...`)

    for (const lead of queued) {
        result.processed++

        if (!lead.email) {
            result.phoneRequired++
            await supabase.from('leads').update({ contact_method: 'phone' }).eq('id', lead.id)
            logs.push(`[Queue] ${lead.company}: No email → phone outreach required`)
            continue
        }

        // Generate + send
        try {
            const variants = buildOutreachVariants({
                company: lead.company,
                city: lead.city || 'your area',
                category: lead.category,
            })
            const { subject, body: text } = variants[0]
            const html = text.replace(/\n/g, '<br/>')

            const mailResult = await sendEmail({ to: lead.email, subject, html, text })

            await supabase.from('leads').update({
                contacted_at: new Date().toISOString(),
                message_id: mailResult.messageId,
                outreach_message: text.substring(0, 500),
                contact_method: 'emailed',
            }).eq('id', lead.id)

            await supabase.from('outreach_log').insert({
                lead_id: lead.id,
                subject: `Email sent: ${subject}`,
                body: `Outreach email triggered via queue`,
                channel: 'email',
                send_status: 'sent'
            }).catch(() => { })

            result.emailsSent++
            logs.push(`[Queue] ✉ Sent to ${lead.company} (${lead.email})`)

        } catch (err: any) {
            logs.push(`[Queue] ✗ Failed for ${lead.company}: ${err.message}`)
            await supabase.from('leads').update({ contact_method: 'email_failed' }).eq('id', lead.id)
        }
    }

    // Check remaining in queue
    const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('contact_method', 'queued')
        .not('email', 'is', null)

    result.remaining = count || 0

    logs.push(``)
    logs.push(`[Queue] Complete — Sent: ${result.emailsSent}, Phone: ${result.phoneRequired}, Remaining: ${result.remaining}`)

    return result
}

// ─── Helper ──────────────────────────────────────────────────────

async function getDailySentCount(supabase: any): Promise<number> {
    try {
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)

        const { count, error } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('contact_method', 'emailed')
            .gte('contacted_at', todayStart.toISOString())

        if (error) {
            const { count: fallbackCount } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('contact_method', 'emailed')
            return fallbackCount || 0
        }

        return count || 0
    } catch {
        return 0
    }
}
