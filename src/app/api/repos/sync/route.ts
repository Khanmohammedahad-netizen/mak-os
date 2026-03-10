import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listOrgRepos } from '@/lib/github/repos'

export async function POST() {
    try {
        const supabase = createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const repos = await listOrgRepos()
        const adminClient = createSupabaseAdminClient()

        const repositoriesToUpsert = repos.map((repo: any) => ({
            github_repo_id: repo.id,
            github_full_name: repo.full_name,
            clone_url: repo.clone_url,
            visibility: repo.private ? 'private' : 'public',
            is_template: repo.is_template || false,
            topics: repo.topics || [],
            owner_id: user.id,
            synced_at: new Date().toISOString()
        }))

        if (repositoriesToUpsert.length > 0) {
            const { error: upsertError } = await adminClient
                .from('repositories')
                .upsert(repositoriesToUpsert, { onConflict: 'github_repo_id' })

            if (upsertError) {
                return NextResponse.json({ error: 'Failed to sync repositories to database', details: upsertError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, count: repositoriesToUpsert.length })
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
