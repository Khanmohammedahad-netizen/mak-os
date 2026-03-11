import { NextResponse } from 'next/server'

/**
 * GET /api/mobile/history
 *
 * Returns recent leads + outreach metrics for the mobile dashboard.
 * Query: ?limit=50  (default 50)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))

        const { supabaseAdmin } = await import('@/lib/supabase-admin')

        // Fetch recent leads
        const { data: leads, error } = await supabaseAdmin
            .from('leads')
            .select('id, company, email, phone, city, category, website, source, contact_method, contacted_at, priority_score, created_at')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Compute metrics
        const total = leads?.length || 0
        const emailed = leads?.filter(l => l.contact_method === 'emailed').length || 0
        const phoneNeeded = leads?.filter(l => l.contact_method === 'phone').length || 0
        const queued = leads?.filter(l => l.contact_method === 'queued').length || 0
        const failed = leads?.filter(l => l.contact_method === 'email_failed').length || 0

        return NextResponse.json({
            metrics: {
                total,
                emailed,
                phoneNeeded,
                queued,
                failed,
            },
            leads: leads || [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
