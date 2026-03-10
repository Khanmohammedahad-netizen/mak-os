import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    console.log('[API] /api/projects POST hit')
    const supabase = createSupabaseServerClient()

    try {
        const body = await request.json()
        console.log('[API] /api/projects POST payload:', body)
        const { name, client_id } = body

        if (!name || !client_id) {
            return NextResponse.json({ error: 'Name and client_id are required' }, { status: 400 })
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[API] Attempting project insert for owner_id: ${user.id}, client_id: ${client_id}`)

        const { data: project, error } = await supabase
            .from('projects')
            .insert([
                {
                    name,
                    client_id,
                    owner_id: user.id
                }
            ])
            .select()
            .single()

        if (error) {
            console.error('[API] Explicit Supabase Insert Error (Projects):', JSON.stringify(error, null, 2))
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('[API] Successful project insert response:', project)
        return NextResponse.json({ project }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
}
