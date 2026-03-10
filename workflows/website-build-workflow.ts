import { type WorkflowDefinition, WorkflowEngine } from './workflow-engine'

/**
 * Website Build Workflow
 * Pipeline: Research → Develop → Deploy → Security Audit
 *
 * Full website lifecycle from business analysis to production deployment
 * with a security audit gate before go-live.
 */
export const websiteBuildWorkflow: WorkflowDefinition = {
    name: 'Website Build Pipeline',
    description: 'End-to-end website creation: business research, development, deployment, and security audit.',
    stages: [
        // Stage 1: Research the business and competitors
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'analyze',
                    agentId: 'research',
                    taskTemplate: 'Analyze the business "{{context.businessName}}" in the "{{context.industry}}" industry. Identify their value proposition, target audience, competitors, and key differentiators. Output a creative brief for website development.',
                },
            ],
        },
        // Stage 2: Build the website
        {
            mode: 'sequential',
            steps: [
                {
                    id: 'develop',
                    agentId: 'developer',
                    taskTemplate: 'Design and develop a production-grade website for "{{context.businessName}}". Technology: {{context.stack}}. Use the business analysis from research: {{prev.analyze.activatedSkills}}. Include: landing page, about, services, contact. Ensure mobile-first, SEO-optimized, accessible.',
                    dependsOn: ['analyze'],
                },
            ],
        },
        // Stage 3: Deploy and Audit in parallel
        {
            mode: 'parallel',
            steps: [
                {
                    id: 'deploy',
                    agentId: 'devops',
                    taskTemplate: 'Configure deployment for the website built in the develop step. Platform: {{context.platform}}. Set up CI/CD pipeline, environment variables, domain configuration, and SSL. Development output: {{prev.develop.activatedSkills}}.',
                    dependsOn: ['develop'],
                },
                {
                    id: 'security-audit',
                    agentId: 'security',
                    taskTemplate: 'Perform a security audit on the website codebase from the develop step. Check for: XSS vectors, insecure headers, dependency vulnerabilities, exposed secrets, OWASP Top 10 compliance. Development output: {{prev.develop.activatedSkills}}.',
                    dependsOn: ['develop'],
                },
            ],
        },
    ],
}

export function runWebsiteBuild(businessName: string, industry: string, stack?: string, platform?: string) {
    return WorkflowEngine.run(websiteBuildWorkflow, {
        businessName,
        industry,
        stack: stack || 'Next.js 14 + TypeScript + Tailwind',
        platform: platform || 'Vercel',
    })
}

export function previewWebsiteBuild() {
    return WorkflowEngine.preview(websiteBuildWorkflow)
}
