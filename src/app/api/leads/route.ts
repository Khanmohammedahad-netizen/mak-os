import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
    const supabase = createSupabaseServerClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ leads })
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient()

    try {
        const body = await request.json()
        console.log('[API] /api/leads hit with body:', body)
        const { name, company, email } = body
        const companyName = company || name

        if (!companyName || !email) {
            return NextResponse.json({ error: 'Company name and email are required' }, { status: 400 })
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[API] Attempting insert for owner_id:', session.user.id)

        const { data: lead, error } = await supabase
            .from('leads')
            .insert([
                {
                    company: companyName,
                    email,
                    status: 'new',
                    owner_id: session.user.id
                }
            ])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ lead }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
}
