import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ─── Signature Verification ──────────────────────────────────────────
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
    if (!signature) return false
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(rawBody, 'utf8')
    const digest = `sha256=${hmac.digest('hex')}`
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
    } catch {
        return false
    }
}

// ─── Replay Protection (in-memory; production should use Redis/DB) ───
const processedDeliveries = new Set<string>()
const MAX_DELIVERIES = 10000

function isReplayAttack(deliveryId: string | null): boolean {
    if (!deliveryId) return false
    if (processedDeliveries.has(deliveryId)) return true
    if (processedDeliveries.size >= MAX_DELIVERIES) {
        const firstKey = processedDeliveries.values().next().value
        if (firstKey) processedDeliveries.delete(firstKey)
    }
    processedDeliveries.add(deliveryId)
    return false
}

// ─── Event Handlers ──────────────────────────────────────────────────

interface WebhookRepo {
    id: number
    full_name: string
    clone_url: string
    private: boolean
    is_template?: boolean
    topics?: string[]
}

async function handleRepositoryEvent(action: string, repo: WebhookRepo, adminClient: any) {
    const githubRepoId = repo.id
    const now = new Date().toISOString()

    switch (action) {
        case 'created': {
            // Upsert so it's idempotent
            const { error } = await adminClient
                .from('repositories')
                .upsert({
                    github_repo_id: githubRepoId,
                    github_full_name: repo.full_name,
                    name: repo.full_name.split('/')[1] || repo.full_name,
                    clone_url: repo.clone_url,
                    visibility: repo.private ? 'private' : 'public',
                    is_template: repo.is_template || false,
                    topics: repo.topics || [],
                    synced_at: now,
                    updated_at: now
                }, { onConflict: 'github_repo_id', ignoreDuplicates: false })

            if (error) console.error('[WEBHOOK] repository.created upsert error:', error)
            else console.log(`[WEBHOOK] repository.created: ${repo.full_name}`)
            break
        }

        case 'renamed':
        case 'publicized':
        case 'privatized': {
            const { error } = await adminClient
                .from('repositories')
                .update({
                    github_full_name: repo.full_name,
                    name: repo.full_name.split('/')[1] || repo.full_name,
                    clone_url: repo.clone_url,
                    visibility: repo.private ? 'private' : 'public',
                    is_template: repo.is_template || false,
                    synced_at: now,
                    updated_at: now
                })
                .eq('github_repo_id', githubRepoId)

            if (error) console.error(`[WEBHOOK] repository.${action} update error:`, error)
            else console.log(`[WEBHOOK] repository.${action}: ${repo.full_name}`)
            break
        }

        case 'deleted': {
            const { error } = await adminClient
                .from('repositories')
                .delete()
                .eq('github_repo_id', githubRepoId)

            if (error) console.error('[WEBHOOK] repository.deleted error:', error)
            else console.log(`[WEBHOOK] repository.deleted: ${repo.full_name}`)
            break
        }

        default:
            console.log(`[WEBHOOK] Ignoring repository action: ${action}`)
    }
}

async function handlePushEvent(repo: WebhookRepo, payload: any, adminClient: any) {
    const now = new Date().toISOString()
    const updateData: Record<string, any> = {
        synced_at: now,
        updated_at: now
    }

    // Optionally store last commit SHA
    if (payload.after) {
        updateData.last_commit_sha = payload.after
    }

    const { error } = await adminClient
        .from('repositories')
        .update(updateData)
        .eq('github_repo_id', repo.id)

    if (error) console.error('[WEBHOOK] push update error:', error)
    else console.log(`[WEBHOOK] push: ${repo.full_name} synced`)
}

async function handleInstallationRepositoriesEvent(action: string, payload: any, adminClient: any) {
    const now = new Date().toISOString()

    if (action === 'added' && payload.repositories_added) {
        for (const repo of payload.repositories_added) {
            const { error } = await adminClient
                .from('repositories')
                .upsert({
                    github_repo_id: repo.id,
                    github_full_name: repo.full_name,
                    name: repo.full_name.split('/')[1] || repo.full_name,
                    visibility: repo.private ? 'private' : 'public',
                    synced_at: now,
                    updated_at: now
                }, { onConflict: 'github_repo_id', ignoreDuplicates: false })

            if (error) console.error(`[WEBHOOK] installation_repositories.added error for ${repo.full_name}:`, error)
            else console.log(`[WEBHOOK] installation_repositories.added: ${repo.full_name}`)
        }
    }

    if (action === 'removed' && payload.repositories_removed) {
        for (const repo of payload.repositories_removed) {
            const { error } = await adminClient
                .from('repositories')
                .delete()
                .eq('github_repo_id', repo.id)

            if (error) console.error(`[WEBHOOK] installation_repositories.removed error for ${repo.full_name}:`, error)
            else console.log(`[WEBHOOK] installation_repositories.removed: ${repo.full_name}`)
        }
    }
}

// ─── Main Handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        // 1. Read raw body for signature verification
        const rawBody = await request.text()

        // 2. Validate webhook secret exists
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
        if (!webhookSecret) {
            console.error('[WEBHOOK] GITHUB_WEBHOOK_SECRET not configured')
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
        }

        // 3. Validate signature BEFORE any processing
        const signature = request.headers.get('x-hub-signature-256')
        if (!verifySignature(rawBody, signature, webhookSecret)) {
            console.error('[WEBHOOK] Invalid signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // 4. Replay protection
        const deliveryId = request.headers.get('x-github-delivery')
        if (isReplayAttack(deliveryId)) {
            console.warn(`[WEBHOOK] Duplicate delivery: ${deliveryId}`)
            return NextResponse.json({ message: 'Duplicate delivery, ignored' }, { status: 200 })
        }

        // 5. Parse payload safely
        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch {
            return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
        }

        // 6. Extract event type
        const event = request.headers.get('x-github-event')
        const action = payload.action || null

        console.log(`[WEBHOOK] Event: ${event}, Action: ${action}, Delivery: ${deliveryId}`)

        // 7. Instantiate admin client dynamically
        let adminClient
        try {
            const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
            adminClient = createSupabaseAdminClient()
        } catch (e: any) {
            console.error('[WEBHOOK] Admin client init failed:', e)
            return NextResponse.json({ error: 'Internal configuration error' }, { status: 500 })
        }

        // 8. Route to appropriate handler
        switch (event) {
            case 'repository':
                if (payload.repository) {
                    await handleRepositoryEvent(action, payload.repository, adminClient)
                }
                break

            case 'push':
                if (payload.repository) {
                    await handlePushEvent(payload.repository, payload, adminClient)
                }
                break

            case 'installation_repositories':
                await handleInstallationRepositoriesEvent(action, payload, adminClient)
                break

            case 'ping':
                console.log('[WEBHOOK] Ping received, webhook is active')
                break

            default:
                console.log(`[WEBHOOK] Ignoring unhandled event: ${event}`)
        }

        return NextResponse.json({ received: true, event, action }, { status: 200 })

    } catch (fatal: any) {
        console.error('[FATAL WEBHOOK ERROR]', fatal)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
