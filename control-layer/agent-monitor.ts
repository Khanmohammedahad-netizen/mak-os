import { listAgents, type AgentId } from '../agents/agent-registry'
import { skillLoader } from '../core/skill-loader'
import { permissionManager, type ToolCategory } from '../runtime/permission-manager'

// ─── Types ────────────────────────────────────────────────────────────

export interface AgentStatus {
    id: AgentId
    name: string
    categories: string[]
    permissions: Record<ToolCategory, string>
    skillsAvailable: number
    status: 'idle' | 'active'
}

export interface SystemHealth {
    totalAgents: number
    totalSkills: number
    categories: string[]
    agentStatuses: AgentStatus[]
}

// ─── Agent Monitor ───────────────────────────────────────────────────

export class AgentMonitor {
    private activeAgents: Set<AgentId> = new Set()

    /**
     * Mark an agent as active (called by workflow engine).
     */
    public markActive(agentId: AgentId): void {
        this.activeAgents.add(agentId)
    }

    /**
     * Mark an agent as idle.
     */
    public markIdle(agentId: AgentId): void {
        this.activeAgents.delete(agentId)
    }

    /**
     * Get detailed status for every agent.
     */
    public getAgentStatuses(): AgentStatus[] {
        const agents = listAgents()
        const tools: ToolCategory[] = ['shell', 'file', 'git', 'web', 'api', 'deploy', 'email']

        return agents.map(agent => {
            const permissions: Record<ToolCategory, string> = {} as any
            for (const tool of tools) {
                permissions[tool] = permissionManager.check(agent.id, tool)
            }

            let skillCount = 0
            for (const cat of agent.categories) {
                skillCount += skillLoader.getByCategory(cat).length
            }

            return {
                id: agent.id,
                name: agent.name,
                categories: agent.categories,
                permissions,
                skillsAvailable: skillCount,
                status: this.activeAgents.has(agent.id) ? 'active' : 'idle',
            }
        })
    }

    /**
     * Full system health check.
     */
    public getSystemHealth(): SystemHealth {
        const statuses = this.getAgentStatuses()
        const categories = skillLoader.getCategories()

        let totalSkills = 0
        for (const cat of categories) {
            totalSkills += skillLoader.getByCategory(cat).length
        }

        return {
            totalAgents: statuses.length,
            totalSkills,
            categories,
            agentStatuses: statuses,
        }
    }
}

export const agentMonitor = new AgentMonitor()
