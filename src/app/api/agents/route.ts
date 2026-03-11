import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serve the skill registry and agent metadata as a REST API
export async function GET() {
    try {
        // Load the skill registry
        const registryPath = path.join(process.cwd(), 'core', 'skill-registry.json')
        let skills: any[] = []
        if (fs.existsSync(registryPath)) {
            skills = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
        }

        // Build category stats
        const categoryStats: Record<string, number> = {}
        for (const s of skills) {
            categoryStats[s.category] = (categoryStats[s.category] || 0) + 1
        }

        // Agent definitions (static metadata — mirrors agent-registry.ts)
        const agents = [
            { id: 'lead-finder', name: 'LeadFinderAgent', categories: ['research', 'marketing'], status: 'idle', role: 'Lead discovery, ICP matching, scoring' },
            { id: 'website-audit', name: 'WebsiteAuditAgent', categories: ['web-dev', 'security'], status: 'idle', role: 'Performance, SEO, security posture' },
            { id: 'marketing', name: 'MarketingAgent', categories: ['marketing', 'research'], status: 'idle', role: 'Content strategy, campaigns, growth' },
            { id: 'research', name: 'ResearchAgent', categories: ['research'], status: 'idle', role: 'Market analysis, competitive intel' },
            { id: 'developer', name: 'DeveloperAgent', categories: ['development', 'web-dev'], status: 'idle', role: 'Full-stack code, architecture' },
            { id: 'devops', name: 'DevOpsAgent', categories: ['devops', 'automation'], status: 'idle', role: 'CI/CD, infra, deployment' },
            { id: 'security', name: 'SecurityAgent', categories: ['security'], status: 'idle', role: 'Pentesting, OWASP, compliance' },
            { id: 'automation', name: 'AutomationAgent', categories: ['automation'], status: 'idle', role: 'n8n, workflows, integrations' },
            { id: 'phone-outreach', name: 'PhoneOutreachAgent', categories: ['automation', 'marketing'], status: 'idle', role: 'Multi-Channel SMS & WhatsApp' },
            { id: 'ai-call', name: 'AICallAgent', categories: ['marketing'], status: process.env.BLAND_AI_ENABLED === 'true' ? 'ready' : 'disabled', role: 'Automated AI Voice Caller' },
        ]

        // Compute skills per agent
        const agentsWithSkills = agents.map(agent => {
            let skillCount = 0
            for (const cat of agent.categories) {
                skillCount += (categoryStats[cat] || 0)
            }
            return { ...agent, skillsAvailable: skillCount }
        })

        // Workflow definitions
        const workflows = [
            { name: 'Lead Generation Pipeline', stages: 4, agents: ['research', 'lead-finder', 'website-audit', 'marketing'], status: 'ready' },
            { name: 'Website Build Pipeline', stages: 3, agents: ['research', 'developer', 'devops', 'security'], status: 'ready' },
            { name: 'Automation Pipeline', stages: 2, agents: ['automation', 'devops'], status: 'ready' },
        ]

        return NextResponse.json({
            system: {
                totalAgents: agents.length,
                totalSkills: skills.length,
                categories: Object.keys(categoryStats).sort(),
                categoryStats,
            },
            agents: agentsWithSkills,
            workflows,
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
