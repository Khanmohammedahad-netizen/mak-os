import { BaseAgent } from './base-agent'
import { LeadFinderAgent } from './lead-finder-agent'
import { WebsiteAuditAgent } from './website-audit-agent'
import { MarketingAgent } from './marketing-agent'
import { ResearchAgent } from './research-agent'
import { DeveloperAgent } from './developer-agent'
import { DevOpsAgent } from './devops-agent'
import { SecurityAgent } from './security-agent'
import { AutomationAgent } from './automation-agent'

export type AgentId =
    | 'lead-finder'
    | 'website-audit'
    | 'marketing'
    | 'research'
    | 'developer'
    | 'devops'
    | 'security'
    | 'automation'

const agents: Record<AgentId, BaseAgent> = {
    'lead-finder': new LeadFinderAgent(),
    'website-audit': new WebsiteAuditAgent(),
    'marketing': new MarketingAgent(),
    'research': new ResearchAgent(),
    'developer': new DeveloperAgent(),
    'devops': new DevOpsAgent(),
    'security': new SecurityAgent(),
    'automation': new AutomationAgent(),
}

/**
 * Get an agent by ID.
 */
export function getAgent(id: AgentId): BaseAgent {
    return agents[id]
}

/**
 * List all available agents.
 */
export function listAgents(): { id: AgentId; name: string; categories: string[] }[] {
    return (Object.entries(agents) as [AgentId, BaseAgent][]).map(([id, agent]) => ({
        id,
        name: agent.name,
        categories: agent.categories,
    }))
}

/**
 * Smart dispatch: given a task description, pick the best agent automatically.
 */
export function dispatch(taskDescription: string): BaseAgent {
    const text = taskDescription.toLowerCase()

    if (text.includes('lead') || text.includes('prospect') || text.includes('outbound')) return agents['lead-finder']
    if (text.includes('audit') || text.includes('lighthouse') || text.includes('website')) return agents['website-audit']
    if (text.includes('marketing') || text.includes('seo') || text.includes('campaign')) return agents['marketing']
    if (text.includes('research') || text.includes('competitor') || text.includes('market analysis')) return agents['research']
    if (text.includes('deploy') || text.includes('docker') || text.includes('ci/cd') || text.includes('pipeline')) return agents['devops']
    if (text.includes('security') || text.includes('vulnerability') || text.includes('pentest')) return agents['security']
    if (text.includes('automate') || text.includes('n8n') || text.includes('workflow') || text.includes('integration')) return agents['automation']

    // Default to developer for general coding tasks
    return agents['developer']
}

export { agents }
