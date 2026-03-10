import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { processOutreachQueue } from '@/lib/outreach-queue'

/**
 * POST /api/outreach/queue
 *
 * Process the outreach queue — sends emails to queued leads up to the daily limit.
 */
export async function POST() {
    try {
        const result = await processOutreachQueue(supabase)

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (err: any) {
        console.error('[Queue] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
