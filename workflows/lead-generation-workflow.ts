import { type WorkflowDefinition, WorkflowEngine } from './workflow-engine'

/**
 * Lead Generation Workflow
 * Pipeline: Research → Score → Audit Website → Generate Outreach
 *
 * 4-stage sequential pipeline that takes a market vertical + region
 * and produces scored leads with personalized outreach copy.
 */
export const leadGenerationWorkflow: WorkflowDefinition = {
    name: 'Lead Generation Pipeline',
    description: 'End-to-end lead discovery, scoring, website analysis, and outreach generation.',
    stages: [
        // Stage 1: Research — find businesses in the target market
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'research',
                    agentId: 'research',
                    taskTemplate: 'Research and identify businesses in the "{{context.industry}}" industry located in "{{context.region}}". Provide company names, domains, estimated size, and market positioning.',
                },
            ],
        },
        // Stage 2: Score — qualify and score the discovered leads
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'score',
                    agentId: 'lead-finder',
                    taskTemplate: 'Score and qualify the following leads based on ICP fit for a SaaS product targeting {{context.industry}}. Previous research findings: {{prev.research.activatedSkills}}. Prioritize by revenue potential and buying signals.',
                    dependsOn: ['research'],
                },
            ],
        },
        // Stage 3: Audit — analyze websites of top leads (parallel)
        {
            mode: 'parallel',
            steps: [
                {
                    id: 'audit',
                    agentId: 'website-audit',
                    taskTemplate: 'Analyze the websites of the top scored leads for technology stack, digital maturity, and pain points. Use findings from lead scoring: {{prev.score.activatedSkills}}.',
                    dependsOn: ['score'],
                },
            ],
        },
        // Stage 4: Outreach — generate personalized messaging
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'outreach',
                    agentId: 'marketing',
                    taskTemplate: 'Generate a 3-step personalized email outreach sequence for qualified leads in {{context.industry}}. Incorporate website audit insights: {{prev.audit.activatedSkills}}. Tone: professional, consultative. Include subject lines, body copy, and CTAs.',
                    dependsOn: ['audit'],
                },
            ],
        },
    ],
}

/**
 * Execute the lead generation workflow.
 */
export function runLeadGeneration(industry: string, region: string) {
    return WorkflowEngine.run(leadGenerationWorkflow, { industry, region })
}

/**
 * Preview the execution plan.
 */
export function previewLeadGeneration() {
    return WorkflowEngine.preview(leadGenerationWorkflow)
}
