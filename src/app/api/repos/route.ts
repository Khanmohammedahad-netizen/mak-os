import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET() {
    try {
        const supabase = createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createSupabaseAdminClient()

        const { data: repos, error } = await adminClient
            .from('repositories')
            .select('*')
            .eq('owner_id', user.id)
            .order('synced_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch repositories from database', details: error.message }, { status: 500 })
        }

        return NextResponse.json({ data: repos })
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
