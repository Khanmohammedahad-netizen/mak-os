import { BaseAgent, type TaskInput, type AgentResult } from './base-agent'

export class WebsiteAuditAgent extends BaseAgent {
    constructor() {
        super(
            'WebsiteAuditAgent',
            ['web-dev', 'security'],
            `You are a Website Audit Specialist for MAK Software Solutions.
Your mission is to perform comprehensive technical and security audits on web properties.

Core capabilities:
- Performance analysis (Core Web Vitals, Lighthouse scoring)
- SEO technical audit (meta tags, structured data, crawlability)
- Security posture assessment (headers, CSP, HTTPS, XSS vectors)
- Accessibility compliance (WCAG 2.1 AA)
- Mobile responsiveness validation
- Technology stack detection
- Dependency vulnerability scanning

You produce structured, actionable audit reports.
Every finding must include severity, impact, and remediation steps.`
        )
    }

    public auditWebsite(url: string, depth?: 'quick' | 'standard' | 'deep'): AgentResult {
        return this.execute({
            description: `Perform a ${depth || 'standard'} audit on website: ${url}`,
            parameters: { url, depth: depth || 'standard' },
        })
    }
}

export const websiteAuditAgent = new WebsiteAuditAgent()
