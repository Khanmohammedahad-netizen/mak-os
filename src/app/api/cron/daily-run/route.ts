import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'
import { runOutreachPipeline } from '@/lib/outreach-engine'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 300 // 5 minutes — Vercel Pro allows up to 900s

export async function GET(request: NextRequest) {
    // Security check
    if (!verifyCronSecret(request)) {
        return cronUnauthorized()
    }

    const runId = crypto.randomUUID()

    try {
        const supabase = supabaseAdmin // Use admin for cron jobs to bypass RLS if needed, or stick to server client

        // Get the configured cities and category for today
        const { data: config, error: configErr } = await supabase
            .from('scheduler_config')
            .select('*')
            .limit(1)
            .single()

        if (configErr) {
            console.error('[DailyRunCron] Error fetching config:', configErr)
            throw new Error('Could not fetch scheduler config')
        }

        if (!config.scheduler_enabled) {
            return NextResponse.json({
                status: 'skipped',
                reason: 'Scheduler is disabled by operator'
            })
        }

        // Fetch today's rotated cities from the PostgreSQL view
        const { data: todayCitiesData } = await supabase
            .from('todays_cities')
            .select('*')
            .single()

        const todaysCities: string[] = todayCitiesData?.cities_today || config.cities || ['Dallas']
        const todaysCategory = 'restaurant' // Can pull dynamically if added to config

        // Log the run start
        await supabase.from('pipeline_runs').insert({
            id: runId,
            status: 'running',
            created_at: new Date().toISOString()
        })

        // Run pipeline for each city (sequentially to respect API limits)
        const results = []
        for (const city of todaysCities) {
            console.log(`[DailyRunCron] Starting execution for ${city}...`)
            const result = await runOutreachPipeline(todaysCategory, city, supabase, { maxResults: 20 })
            results.push({ city, result })
        }

        // Log completion
        await supabase.from('pipeline_runs').update({
            status: 'complete',
            error: null
        }).eq('id', runId)

        return NextResponse.json({
            status: 'complete',
            runId,
            cities: todaysCities,
            results
        })

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[DailyRunCron] Failed:', error)

        await supabaseAdmin.from('pipeline_runs').update({
            status: 'failed',
            error: errorMessage
        }).eq('id', runId)

        // Return 200 even on error — Vercel retries on 5xx which we don't want
        return NextResponse.json({
            status: 'failed',
            runId,
            error: errorMessage
        }, { status: 200 })
    }
}
