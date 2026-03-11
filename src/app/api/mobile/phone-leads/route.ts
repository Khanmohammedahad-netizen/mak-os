import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const { supabaseAdmin: supabase } = await import('@/lib/supabase-admin')

        const { data: pending, error: pendingErr } = await supabase
            .from('phone_leads_pending')
            .select('*')
            .limit(50)

        const { data: active, error: activeErr } = await supabase
            .from('phone_sequences_due')
            .select('*')
            .limit(50)

        if (pendingErr || activeErr) {
            throw pendingErr || activeErr
        }

        return NextResponse.json({
            pending: pending || [],
            active: active || []
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
