import { NextResponse } from 'next/server'
import { runOutreachPipeline } from '@/lib/outreach-engine'
import { parseTaskInput } from '@/lib/task-parser'

export const maxDuration = 300 // 5 minutes — required for Apify polling

/**
 * POST /api/mobile/run
 *
 * Simplified mobile trigger for the outreach pipeline.
 * Body: { "task": "find restaurants in chicago without websites" }
 */
export async function POST(request: Request) {
    try {
        const { task } = await request.json()

        if (!task || typeof task !== 'string') {
            return NextResponse.json({ error: 'task is required' }, { status: 400 })
        }

        // Parse category + city from task string
        const { categories, city } = parseTaskInput(task)

        const startTime = Date.now()

        const { supabaseAdmin } = await import('@/lib/supabase-admin')

        const result = await runOutreachPipeline(categories, city, supabaseAdmin, {
            maxResults: 20,
        })

        return NextResponse.json({
            success: true,
            task,
            categories,
            city,
            durationMs: Date.now() - startTime,
            metrics: {
                discovered: result.discovered,
                qualified: result.qualified,
                enriched: result.enriched,
                emailsSent: result.emailsSent,
                phoneRequired: result.phoneRequired,
                errors: result.errors,
            },
            logs: result.logs,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
