import { NextResponse } from 'next/server'
import { runOutreachPipeline } from '@/lib/outreach-engine'

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
        const { category, city } = parseTask(task)

        const startTime = Date.now()

        const { supabaseAdmin } = await import('@/lib/supabase-admin')

        const result = await runOutreachPipeline(category, city, supabaseAdmin, {
            maxResults: 20,
        })

        return NextResponse.json({
            success: true,
            task,
            category,
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

// ─── Task Parser ─────────────────────────────────────────────────

function parseTask(task: string): { category: string; city: string } {
    const text = task.toLowerCase()

    // Detect city from "in <city>" pattern
    let city = 'Chicago'
    const stopWords = ['without', 'with', 'who', 'that', 'which', 'and', 'or', 'not', 'no', 'near', 'for', 'the']
    const regionMatch = task.match(/\bin\s+([a-zA-Z][a-zA-Z\s]*)/i)
    if (regionMatch) {
        const words = regionMatch[1].trim().split(/\s+/)
        const locationWords: string[] = []
        for (const word of words) {
            if (stopWords.includes(word.toLowerCase())) break
            locationWords.push(word)
        }
        if (locationWords.length > 0) city = locationWords.join(' ')
    }

    // Detect category
    let category = 'restaurant'
    if (text.includes('agency') || text.includes('agencies')) category = 'marketing agency'
    if (text.includes('salon')) category = 'salon'
    if (text.includes('gym')) category = 'gym'
    if (text.includes('coffee') || text.includes('cafe')) category = 'cafe'
    if (text.includes('clinic')) category = 'clinic'
    if (text.includes('hotel')) category = 'hotel'
    if (text.includes('bar')) category = 'bar'
    if (text.includes('shop') || text.includes('store')) category = 'shop'

    return { category, city }
}
