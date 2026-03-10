import { NextResponse } from 'next/server'

export async function POST() {
    try {
        console.log('[ROUTE ENTRY] /api/github/sync hit')

        // Step 1: Instantiate GitHub App & Get Token dynamically
        const { getInstallationOctokit } = await import('@/lib/github/app')
        const octokit = await getInstallationOctokit()

        const org = process.env.GITHUB_ORG
        if (!org) {
            return NextResponse.json({ error: 'Missing GITHUB_ORG env variable' }, { status: 500 })
        }

        // Step 2: Fetch Repositories
        const response = await octokit.rest.repos.listForOrg({
            org: org,
            type: 'all',
            per_page: 100,
        })
        const repos = response.data

        // Step 3: Safe Supabase server client & auth validation
        const { createSupabaseServerClient } = await import('@/lib/supabase/server')
        const supabase = createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Step 4: Admin client instantiation
        let adminClient
        try {
            const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
            adminClient = createSupabaseAdminClient()
        } catch (e: any) {
            console.error('[ADMIN CLIENT FAILURE]', e)
            return NextResponse.json({ error: 'Admin client init failed: ' + e.message }, { status: 500 })
        }

        let syncedCount = 0

        // Step 5: Map and Upsert
        for (const repo of repos) {
            const repoData = {
                owner_id: user.id,
                name: repo.name,
                github_repo_id: repo.id,
                github_full_name: repo.full_name,
                clone_url: repo.clone_url,
                visibility: repo.private ? 'private' : 'public',
                is_template: repo.is_template || false,
                synced_at: new Date().toISOString()
            }

            const { error: upsertError } = await adminClient
                .from('repositories')
                .upsert(repoData, { onConflict: 'github_repo_id', ignoreDuplicates: false })

            if (upsertError) {
                console.error(`[DB ERROR] Sync failed for repo ${repo.name}:`, upsertError)
                continue // optionally fail entire request or just skip
            }

            syncedCount++;
        }

        console.log(`[API] Successfully synced ${syncedCount} repositories`)
        return NextResponse.json({ synced: syncedCount }, { status: 200 })

    } catch (fatal: any) {
        console.error('[FATAL ROUTE ERROR]', fatal)
        return NextResponse.json({ error: fatal.message || 'Fatal server error' }, { status: 500 })
    }
}
