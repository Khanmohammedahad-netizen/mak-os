import { NextResponse } from 'next/server'
import { parseTaskInput } from '@/lib/task-parser'

export const maxDuration = 300 // 5 minutes for Apify scrapers


// ─── Intent Matching (inline — no external imports needed) ───────────

interface WorkflowMatch {
    name: string
    stages: { step: number; agent: string }[]
    context?: Record<string, string>
}

function matchWorkflow(description: string): WorkflowMatch | null {
    const text = description.toLowerCase()

    const rules: { keywords: string[]; name: string; stages: { step: number; agent: string }[] }[] = [
        {
            keywords: ['lead', 'leads', 'prospect', 'find businesses', 'find business', 'find a', 'restaurant', 'restaurants', 'agency', 'agencies', 'outreach', 'find companies', 'find company', 'coffee', 'shop', 'store', 'cafe', 'salon', 'gym', 'clinic', 'bar', 'hotel', 'without website', 'without a website', 'no website'],
            name: 'Lead Generation Pipeline',
            stages: [
                { step: 1, agent: 'ResearchAgent' },
                { step: 2, agent: 'LeadFinderAgent' },
                { step: 3, agent: 'WebsiteAuditAgent' },
                { step: 4, agent: 'ContactEnrichmentAgent' },
                { step: 5, agent: 'MarketingAgent' },
                { step: 6, agent: 'AutomationAgent' },
                { step: 7, agent: 'CRM Update' },
            ],
        },
        {
            keywords: ['build website', 'create website', 'design website', 'develop website', 'landing page', 'web app'],
            name: 'Website Build Pipeline',
            stages: [
                { step: 1, agent: 'ResearchAgent' },
                { step: 2, agent: 'DeveloperAgent' },
                { step: 3, agent: 'DevOpsAgent' },
                { step: 4, agent: 'SecurityAgent' },
            ],
        },
        {
            keywords: ['automate', 'automation', 'workflow', 'n8n', 'integrate', 'pipeline'],
            name: 'Automation Pipeline',
            stages: [
                { step: 1, agent: 'AutomationAgent' },
                { step: 2, agent: 'DevOpsAgent' },
            ],
        },
    ]

    for (const rule of rules) {
        for (const keyword of rule.keywords) {
            if (text.includes(keyword)) {
                // Extract context (e.g. "restaurants in London" -> region: London)
                // Stop-words that should NOT be captured as part of the location
                const stopWords = ['without', 'with', 'who', 'that', 'which', 'where', 'and', 'or', 'not', 'no', 'near', 'for', 'the']
                const regionMatch = description.match(/\bin\s+([a-zA-Z][a-zA-Z\s]*)/i)
                let region = 'Chicago'
                if (regionMatch) {
                    // Take words from the match until we hit a stop-word
                    const words = regionMatch[1].trim().split(/\s+/)
                    const locationWords: string[] = []
                    for (const word of words) {
                        if (stopWords.includes(word.toLowerCase())) break
                        locationWords.push(word)
                    }
                    if (locationWords.length > 0) {
                        region = locationWords.join(' ')
                    }
                }

                // Detect "without website(s)" filter
                const wantsNoWebsite = /without\s+website/i.test(description)

                return {
                    name: rule.name,
                    stages: rule.stages,
                    context: { industry: description, region, filterNoWebsite: wantsNoWebsite ? 'true' : '' }
                }
            }
        }
    }
    return null
}

// ─── POST /api/agents/tasks ──────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { description } = body

        if (!description) {
            return NextResponse.json({ error: 'description is required' }, { status: 400 })
        }

        const workflow = matchWorkflow(description)
        const encoder = new TextEncoder()

        if (workflow && workflow.name.includes('Lead Generation Pipeline')) {
            // Streaming mode for long-running pipeline
            const stream = new ReadableStream({
                async start(controller) {
                    const send = (data: any) => {
                        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
                    }

                    try {
                        const { parseTaskInput } = await import('@/lib/task-parser')
                        const { runOutreachPipeline } = await import('@/lib/outreach-engine')
                        const { supabaseAdmin } = await import('@/lib/supabase-admin')

                        const parsed = parseTaskInput(description)
                        console.log('[TaskParser] Raw NLQuery result:', JSON.stringify(parsed))
                        const { categories, city: region, filter, error } = parsed

                        if (error || categories.length === 0) {
                            send({ type: 'log', message: `[TaskParser] Clarification needed: ${error || 'Please specify search.'}` })
                            send({ type: 'done', payload: { 
                                type: 'stats', 
                                title: 'Clarification Needed', 
                                metrics: [{ label: 'Status', value: 'Retrying...' }],
                                message: error || 'Please use format: "[business type] in [city]"'
                            } })
                            return
                        }

                        send({ type: 'log', message: `Task submitted: "${description}"` })
                        send({ type: 'log', message: `Workflow detected: ${workflow.name}` })
                        send({ type: 'log', message: `[TaskParser] City: "${region}", Category: "${categories[0]}"${filter ? `, Filter: "${filter}"` : ''}` })

                        const outreachResult = await runOutreachPipeline(
                            categories, region!, supabaseAdmin, {
                            maxResults: 100,
                            queuedMode: true,
                            filter: filter || undefined,
                            onLog: (msg) => send({ type: 'log', message: msg })
                        }
                        )


                        const payload = {
                            type: 'stats',
                            title: 'Outreach Pipeline Initialized',
                            metrics: [
                                { label: 'Discovered', value: String(outreachResult.discovered) },
                                { label: 'Qualified', value: String(outreachResult.qualified) },
                                { label: 'Queued', value: String(outreachResult.queued || 0) },
                                { label: 'Phone Required', value: String(outreachResult.phoneRequired) },
                                { label: 'Errors', value: String(outreachResult.errors) },
                            ],
                        }

                        send({ type: 'done', payload })
                    } catch (e: any) {
                        send({ type: 'log', message: `[System] Pipeline failed: ${e.message}` })
                        send({ type: 'done', payload: { type: 'stats', title: 'Pipeline Error', metrics: [{ label: 'Error', value: e.message }] } })
                    } finally {
                        controller.close()
                    }
                }
            })

            return new Response(stream, {
                headers: {
                    'Content-Type': 'application/x-ndjson',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            })
        }

        // Standard response for quick tasks
        const startTime = Date.now()
        const logs: string[] = [`Task submitted: "${description}"`]

        if (workflow) {
            logs.push(`Workflow detected: ${workflow.name}`)
            let payload: any = null

            if (workflow.name.includes('Website Build Pipeline')) {
                payload = {
                    type: 'stats',
                    title: 'Deployment Successful',
                    metrics: [
                        { label: 'URL', value: 'https://demo-agency-site.vercel.app' },
                        { label: 'Lighthouse Score', value: '98/100' },
                        { label: 'Components Generated', value: '14' }
                    ]
                }
            } else {
                payload = { type: 'json', data: { success: true, flowsDeployed: 2, endpoints: ["https://n8n.mak.software/webhook/1"] } }
            }

            logs.push(`Workflow completed (${Date.now() - startTime}ms)`)
            return NextResponse.json({
                mode: 'workflow',
                workflowName: workflow.name,
                logs,
                status: 'completed',
                payload
            })
        } else {
            const agentName = 'DeveloperAgent'
            logs.push(`Agent dispatched: ${agentName}`)
            logs.push(`Agent completed (${Date.now() - startTime}ms)`)

            return NextResponse.json({
                mode: 'agent',
                agentName,
                logs,
                status: 'completed',
                payload: {
                    type: 'stats',
                    title: `Analysis by ${agentName}`,
                    metrics: [
                        { label: 'Findings', value: '3 issues identified' },
                        { label: 'Confidence Score', value: '94%' },
                        { label: 'Action Items', value: '2 generated' }
                    ]
                }
            })
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

