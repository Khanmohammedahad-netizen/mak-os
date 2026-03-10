import { type WorkflowDefinition, WorkflowEngine } from './workflow-engine'

/**
 * Automation Workflow
 * Pipeline: AutomationAgent → DevOpsAgent
 *
 * Designs an automation workflow, then deploys it to infrastructure.
 */
export const automationWorkflow: WorkflowDefinition = {
    name: 'Automation Pipeline',
    description: 'Design a workflow automation and deploy it to production infrastructure.',
    stages: [
        // Stage 1: Design the automation
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'design',
                    agentId: 'automation',
                    taskTemplate: 'Design a complete automation workflow for: "{{context.process}}". Platform: {{context.platform}}. Include: trigger mechanism, node-by-node logic, error handling strategy, retry logic, and monitoring. Output a deployable workflow specification.',
                },
            ],
        },
        // Stage 2: Deploy and monitor
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'deploy',
                    agentId: 'devops',
                    taskTemplate: 'Deploy the automation workflow designed in the previous step. Configure: hosting environment, cron scheduling, webhook endpoints, secret management, health checks, and alerting. Automation design: {{prev.design.activatedSkills}}.',
                    dependsOn: ['design'],
                },
            ],
        },
    ],
}

export function runAutomation(process: string, platform?: string) {
    return WorkflowEngine.run(automationWorkflow, {
        process,
        platform: platform || 'n8n',
    })
}

export function previewAutomation() {
    return WorkflowEngine.preview(automationWorkflow)
}
