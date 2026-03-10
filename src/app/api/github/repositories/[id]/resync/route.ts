import { NextResponse } from 'next/server'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        console.log(`[ROUTE ENTRY] /api/github/repositories/${params.id}/resync hit`)

        // 1. Validate Authentication
        const { createSupabaseServerClient } = await import('@/lib/supabase/server')
        const supabase = createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Fetch Repository From DB
        const { data: repo, error: repoError } = await supabase
            .from('repositories')
            .select('*')
            .eq('id', params.id)
            .eq('owner_id', user.id)
            .single()

        if (repoError || !repo) {
            return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
        }

        // 3. Verify it is GitHub-backed
        if (!repo.github_repo_id || !repo.github_full_name) {
            return NextResponse.json({ error: 'Repository is not GitHub-backed' }, { status: 400 })
        }

        const [owner, repoName] = repo.github_full_name.split('/')
        if (!owner || !repoName) {
            return NextResponse.json({ error: 'Invalid GitHub full name format' }, { status: 400 })
        }

        // 4. Fetch fresh metadata from GitHub
        const { getInstallationOctokit } = await import('@/lib/github/app')
        const octokit = await getInstallationOctokit()

        const githubResponse = await octokit.rest.repos.get({
            owner,
            repo: repoName,
        })

        const githubRepo = githubResponse.data

        // 5. Update Supabase with new metadata
        const updatedData = {
            visibility: githubRepo.private ? 'private' : 'public',
            clone_url: githubRepo.clone_url,
            github_full_name: githubRepo.full_name,
            is_template: githubRepo.is_template || false,
            topics: githubRepo.topics || [],
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const { data: updatedRepo, error: updateError } = await supabase
            .from('repositories')
            .update(updatedData)
            .eq('id', params.id)
            .eq('owner_id', user.id)
            .select()
            .single()

        if (updateError) {
            console.error('[DB ERROR] Failed to update repository:', updateError)
            return NextResponse.json({ error: 'Failed to update repository in database' }, { status: 500 })
        }

        // 6. Return structured JSON
        return NextResponse.json({ success: true, repository: updatedRepo }, { status: 200 })

    } catch (fatal: any) {
        console.error('[FATAL ROUTE ERROR]', fatal)
        return NextResponse.json({ error: fatal.message || 'Fatal server error' }, { status: 500 })
    }
}
