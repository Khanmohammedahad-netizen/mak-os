import type { AgentId } from '../agents/agent-registry'

// ─── Permission Levels ───────────────────────────────────────────────

export type ToolCategory = 'shell' | 'file' | 'git' | 'web' | 'api' | 'deploy' | 'email'
export type PermissionLevel = 'deny' | 'ask' | 'allow'

export interface PermissionRule {
    agentId: AgentId | '*'
    tool: ToolCategory | '*'
    level: PermissionLevel
}

// ─── Default Policy ──────────────────────────────────────────────────
// Principle of least privilege. Agents only get what they need.

const DEFAULT_POLICY: PermissionRule[] = [
    // Global defaults: deny everything, require explicit grants
    { agentId: '*', tool: '*', level: 'deny' },

    // LeadFinderAgent: can scrape, call APIs
    { agentId: 'lead-finder', tool: 'web', level: 'allow' },
    { agentId: 'lead-finder', tool: 'api', level: 'allow' },

    // WebsiteAuditAgent: can scrape, read files
    { agentId: 'website-audit', tool: 'web', level: 'allow' },
    { agentId: 'website-audit', tool: 'file', level: 'ask' },

    // MarketingAgent: can call APIs (email enrichment), send email
    { agentId: 'marketing', tool: 'api', level: 'allow' },
    { agentId: 'marketing', tool: 'email', level: 'ask' },

    // ResearchAgent: can scrape, call APIs
    { agentId: 'research', tool: 'web', level: 'allow' },
    { agentId: 'research', tool: 'api', level: 'allow' },

    // DeveloperAgent: can read/write files, run shell, use git
    { agentId: 'developer', tool: 'file', level: 'allow' },
    { agentId: 'developer', tool: 'shell', level: 'ask' },
    { agentId: 'developer', tool: 'git', level: 'allow' },

    // DevOpsAgent: full infra access (with confirmation on destructive ops)
    { agentId: 'devops', tool: 'shell', level: 'ask' },
    { agentId: 'devops', tool: 'file', level: 'allow' },
    { agentId: 'devops', tool: 'git', level: 'allow' },
    { agentId: 'devops', tool: 'deploy', level: 'ask' },
    { agentId: 'devops', tool: 'api', level: 'allow' },

    // SecurityAgent: read-only file + web, shell for scanning
    { agentId: 'security', tool: 'file', level: 'allow' },
    { agentId: 'security', tool: 'web', level: 'allow' },
    { agentId: 'security', tool: 'shell', level: 'ask' },

    // AutomationAgent: API + deploy
    { agentId: 'automation', tool: 'api', level: 'allow' },
    { agentId: 'automation', tool: 'deploy', level: 'ask' },
    { agentId: 'automation', tool: 'email', level: 'ask' },
]

// ─── Permission Manager ──────────────────────────────────────────────

export class PermissionManager {
    private rules: PermissionRule[]

    constructor(customRules?: PermissionRule[]) {
        this.rules = customRules || DEFAULT_POLICY
    }

    /**
     * Check if an agent is allowed to use a tool category.
     * Returns 'allow', 'ask' (requires human confirmation), or 'deny'.
     */
    public check(agentId: AgentId, tool: ToolCategory): PermissionLevel {
        // Most specific rule wins: exact agent+tool > exact agent+wildcard > wildcard+tool > wildcard+wildcard
        const exactMatch = this.rules.find(r => r.agentId === agentId && r.tool === tool)
        if (exactMatch) return exactMatch.level

        const agentWild = this.rules.find(r => r.agentId === agentId && r.tool === '*')
        if (agentWild) return agentWild.level

        const toolWild = this.rules.find(r => r.agentId === '*' && r.tool === tool)
        if (toolWild) return toolWild.level

        const globalWild = this.rules.find(r => r.agentId === '*' && r.tool === '*')
        return globalWild?.level || 'deny'
    }

    /**
     * Enforce permission. Throws if denied.
     */
    public enforce(agentId: AgentId, tool: ToolCategory): void {
        const level = this.check(agentId, tool)
        if (level === 'deny') {
            throw new Error(`PERMISSION_DENIED: Agent "${agentId}" is not authorized to use tool "${tool}"`)
        }
        if (level === 'ask') {
            console.warn(`[PermissionManager] Agent "${agentId}" requires human approval for tool "${tool}"`)
        }
    }
}

export const permissionManager = new PermissionManager()
