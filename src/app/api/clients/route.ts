import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    console.log('[API] /api/clients POST hit')
    const supabase = createSupabaseServerClient()

    try {
        const body = await request.json()
        console.log('[API] /api/clients POST payload:', body)
        const { name } = body

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[API] Attempting insert for owner_id:', user.id)

        const { data: client, error } = await supabase
            .from('clients')
            .insert([
                {
                    name,
                    owner_id: user.id
                }
            ])
            .select()
            .single()

        if (error) {
            console.error('[API] Explicit Supabase Error Details:', JSON.stringify(error, null, 2))
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('[API] Successful insert response:', client)

        return NextResponse.json({ client }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
}

export async function DELETE(request: Request) {
    console.log('[API] /api/clients DELETE hit')
    const supabase = createSupabaseServerClient()

    try {
        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[API] Attempting to delete client ${id} for owner_id:`, user.id)

        const { error } = await supabase
            .from('clients')
            .delete()
            .match({ id: id, owner_id: user.id })

        if (error) {
            console.error('[API] Explicit Supabase Delete Error:', JSON.stringify(error, null, 2))
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('[API] Successful delete')
        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('[API] Parse error in DELETE payload', error)
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
}

