import { NextResponse } from 'next/server'
import { runOutreachPipeline } from '@/lib/outreach-engine'

/**
 * POST /api/outreach/run
 *
 * Triggers the full autonomous outreach pipeline.
 * Body: { category: string, city: string, maxResults?: number, dryRun?: boolean }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { category, city, maxResults, dryRun } = body

        if (!category || !city) {
            return NextResponse.json(
                { error: 'category and city are required' },
                { status: 400 }
            )
        }

        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')
        const result = await runOutreachPipeline(category, city, supabase, {
            maxResults: maxResults || 20,
            dryRun: dryRun || false,
        })

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (err: any) {
        console.error('[Outreach] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
