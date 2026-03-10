import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { runOutreachPipeline } from '@/lib/outreach-engine'

/**
 * Auto-Scheduler Control Route (Serverless)
 * Modifies boolean states inside the remote Supabase database.
 * No local memory timers or browser dependencies exist here.
 */

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { action } = body
        const supabase = createSupabaseServerClient()

        // 1. Fetch current single config row
        const { data: config } = await supabase
            .from('scheduler_config')
            .select('id')
            .limit(1)
            .single()

        const configId = config?.id

        if (action === 'start' && configId) {
            await supabase
                .from('scheduler_config')
                .update({ scheduler_enabled: true, updated_at: new Date().toISOString() })
                .eq('id', configId)

            return NextResponse.json({ status: 'started' })
        }

        if (action === 'stop' && configId) {
            await supabase
                .from('scheduler_config')
                .update({ scheduler_enabled: false, updated_at: new Date().toISOString() })
                .eq('id', configId)

            return NextResponse.json({ status: 'stopped' })
        }

        // Run once manually (Sync Execution for UI testing)
        if (action === 'run_once') {
            const result = await runOutreachPipeline('restaurant', 'Dallas', supabase as any, { maxResults: 5 })
            return NextResponse.json({ status: 'triggered', result })
        }

        return NextResponse.json({ error: 'Valid action required or config not found' }, { status: 400 })
    } catch (err: any) {
        console.error('[AutoScheduler] API Route Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function GET() {
    try {
        const supabase = createSupabaseServerClient()

        const { data: config } = await supabase
            .from('scheduler_config')
            .select('*')
            .limit(1)
            .single()

        const { data: todayCitiesData } = await supabase
            .from('todays_cities')
            .select('*')
            .single()

        const cities = todayCitiesData?.cities_today || config?.cities || []

        // Find latest execution record
        const { data: lastRun } = await supabase
            .from('pipeline_runs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        return NextResponse.json({
            running: !!config?.scheduler_enabled,
            isExecuting: lastRun?.status === 'running',
            cities: cities,
            nextCity: cities[0] || 'Unknown',
            lastRunAt: lastRun?.created_at || null,
            lastResult: lastRun || null,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
