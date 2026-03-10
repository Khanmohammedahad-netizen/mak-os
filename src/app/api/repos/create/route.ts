import { NextResponse } from 'next/server'
import { z } from 'zod'

const createRepoSchema = z.object({
    name: z.string().min(1),
    project_id: z.string().optional(),
    templateOwner: z.string().optional(),
    templateRepo: z.string().optional(),
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    topics: z.array(z.string()).optional(),
    secrets: z.array(z.object({
        secretName: z.string().min(1),
        secretValue: z.string().min(1)
    })).optional()
})

export async function POST(request: Request) {
    try {
        console.log('[ROUTE ENTRY] /api/repos/create hit')
        console.log('SERVICE ROLE EXISTS:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

        // Step A: Safe Supabase server client structure
        const { createSupabaseServerClient } = await import('@/lib/supabase/server')
        const supabase = createSupabaseServerClient()

        // Step B: Validate auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Step C: Safe admin client instantiation inside try block
        let adminClient
        try {
            const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
            adminClient = createSupabaseAdminClient()
        } catch (e: any) {
            console.error('[ADMIN CLIENT FAILURE]', e)
            return NextResponse.json({ error: 'Admin client init failed: ' + e.message }, { status: 500 })
        }

        // Step D: Parse body safely
        let body
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = createRepoSchema.safeParse(body)
        if (!parsed.success) {
            console.error('[API] Invalid repo create payload:', parsed.error.format())
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 })
        }

        const data = parsed.data
        console.log('[BODY]', body)
        console.log(`[API] Processing repo create request for name: ${data.name}, project_id: ${data.project_id || 'none'}, owner_id: ${user.id}`)

        // Step E: Minimal insert without GitHub logic
        const repoData: any = {
            name: data.name,
            owner_id: user.id,
            visibility: data.isPrivate ? 'private' : 'public'
        }

        if (data.project_id) {
            repoData.project_id = data.project_id;
        }

        // GitHub logic safely wrapped if executed
        /*
        if (data.templateOwner && data.templateRepo) {
            console.log(`[API] GitHub template requested: ${data.templateOwner}/${data.templateRepo}`)
            try {
                const { createRepoFromTemplate, setRepoTopics, setRepoSecrets } = await import('@/lib/github/repos')

                const repo: any = await createRepoFromTemplate({
                    templateOwner: data.templateOwner,
                    templateRepo: data.templateRepo,
                    newName: data.name,
                    description: data.description,
                    isPrivate: data.isPrivate
                })
                
                repoData = {
                    ...repoData,
                    github_repo_id: repo.id,
                    github_full_name: repo.full_name,
                    clone_url: repo.clone_url,
                    is_template: repo.is_template || false,
                    topics: repo.topics || [],
                    synced_at: new Date().toISOString()
                }

                if (data.topics && data.topics.length > 0) {
                    await setRepoTopics({ repo: data.name, names: data.topics })
                }
                
                if (data.secrets && data.secrets.length > 0) {
                    for (const secret of data.secrets) {
                        await setRepoSecrets({
                            repo: data.name,
                            secretName: secret.secretName,
                            secretValue: secret.secretValue
                        })
                    }
                }
            } catch (err: any) {
                console.error('[API] Github template creation failed block:', err)
                return NextResponse.json({ error: err.message || 'Github Creation Failed' }, { status: 500 })
            }
        }
        */

        const { data: insertedRepo, error: upsertError } = await adminClient
            .from('repositories')
            .upsert({ ...repoData }, { onConflict: 'github_repo_id', ignoreDuplicates: false })
            .select()
            .single()

        if (upsertError) {
            console.error('[DB ERROR]', upsertError)
            return NextResponse.json({ error: upsertError.message || 'Failed to record repository in database' }, { status: 500 })
        }

        console.log('[API] Successful repo create response:', insertedRepo)
        return NextResponse.json({ data: insertedRepo }, { status: 201 })
    } catch (fatal: any) {
        console.error('[FATAL ROUTE ERROR]', fatal)
        return NextResponse.json({ error: 'Fatal server error' }, { status: 500 })
    }
}
