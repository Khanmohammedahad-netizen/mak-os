import { leadGenerationWorkflow } from '../workflows/lead-generation-workflow'
import type { WorkflowDefinition } from '../workflows/workflow-engine'
import { websiteBuildWorkflow } from '../workflows/website-build-workflow'
import { automationWorkflow } from '../workflows/automation-workflow'

// ─── Intent Rules ────────────────────────────────────────────────────

interface IntentRule {
    keywords: string[]
    workflow: WorkflowDefinition
    contextExtractor: (task: string) => Record<string, string>
}

const intentRules: IntentRule[] = [
    {
        keywords: ['lead', 'leads', 'prospect', 'find businesses', 'restaurants', 'agencies', 'outbound', 'outreach', 'find companies'],
        workflow: leadGenerationWorkflow,
        contextExtractor: (task) => {
            // Try to extract industry and region from the task
            const regionMatch = task.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
            const region = regionMatch ? regionMatch[1] : 'Global'
            return { industry: task, region }
        },
    },
    {
        keywords: ['build website', 'create website', 'design website', 'develop website', 'landing page', 'web app'],
        workflow: websiteBuildWorkflow,
        contextExtractor: (task) => {
            return { businessName: 'Target Business', industry: task, stack: 'Next.js 14 + TypeScript', platform: 'Vercel' }
        },
    },
    {
        keywords: ['automate', 'automation', 'workflow', 'n8n', 'integrate', 'pipeline', 'cron', 'scheduled'],
        workflow: automationWorkflow,
        contextExtractor: (task) => {
            return { process: task, platform: 'n8n' }
        },
    },
]

// ─── Router ──────────────────────────────────────────────────────────

export interface WorkflowMatch {
    matched: true
    workflow: WorkflowDefinition
    context: Record<string, string>
}

export interface NoMatch {
    matched: false
}

export type IntentResult = WorkflowMatch | NoMatch

export class WorkflowIntentRouter {
    /**
     * Analyze a task description and determine if it should trigger a workflow.
     */
    public static route(taskDescription: string): IntentResult {
        const text = taskDescription.toLowerCase()

        for (const rule of intentRules) {
            for (const keyword of rule.keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    return {
                        matched: true,
                        workflow: rule.workflow,
                        context: rule.contextExtractor(taskDescription),
                    }
                }
            }
        }

        return { matched: false }
    }
}
