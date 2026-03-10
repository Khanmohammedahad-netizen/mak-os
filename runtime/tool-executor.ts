import { permissionManager, type ToolCategory } from './permission-manager'
import type { AgentId } from '../agents/agent-registry'

// ─── Tool Result ─────────────────────────────────────────────────────

export interface ToolResult {
    tool: ToolCategory
    command: string
    success: boolean
    output: string
    error?: string
    durationMs: number
}

// ─── Tool Definitions ────────────────────────────────────────────────

export interface ToolRequest {
    tool: ToolCategory
    command: string
    args?: Record<string, unknown>
    cwd?: string
    timeout?: number // ms
}

// ─── Tool Executor ───────────────────────────────────────────────────

export class ToolExecutor {
    /**
     * Execute a tool request on behalf of an agent.
     * Checks permissions before execution.
     */
    public static async execute(agentId: AgentId, request: ToolRequest): Promise<ToolResult> {
        const start = Date.now()

        // 1. Permission check
        try {
            permissionManager.enforce(agentId, request.tool)
        } catch (e: unknown) {
            return {
                tool: request.tool,
                command: request.command,
                success: false,
                output: '',
                error: e instanceof Error ? e.message : 'Permission denied',
                durationMs: Date.now() - start,
            }
        }

        // 2. Route to the appropriate handler
        try {
            const output = await this.dispatch(request)
            return {
                tool: request.tool,
                command: request.command,
                success: true,
                output,
                durationMs: Date.now() - start,
            }
        } catch (e: unknown) {
            return {
                tool: request.tool,
                command: request.command,
                success: false,
                output: '',
                error: e instanceof Error ? e.message : 'Execution failed',
                durationMs: Date.now() - start,
            }
        }
    }

    /**
     * Route tool requests to the correct handler.
     */
    private static async dispatch(request: ToolRequest): Promise<string> {
        switch (request.tool) {
            case 'shell':
                return this.executeShell(request)
            case 'file':
                return this.executeFile(request)
            case 'git':
                return this.executeGit(request)
            case 'web':
                return this.executeWeb(request)
            case 'api':
                return this.executeApi(request)
            case 'deploy':
                return this.executeDeploy(request)
            case 'email':
                return this.executeEmail(request)
            default:
                throw new Error(`Unknown tool: ${request.tool}`)
        }
    }

    // ─── Shell Commands ──────────────────────────────────────────

    private static async executeShell(request: ToolRequest): Promise<string> {
        const { execSync } = await import('child_process')
        const timeout = request.timeout || 30000
        const result = execSync(request.command, {
            cwd: request.cwd || process.cwd(),
            timeout,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10, // 10MB
        })
        return result.toString()
    }

    // ─── File Operations ─────────────────────────────────────────

    private static async executeFile(request: ToolRequest): Promise<string> {
        const fs = await import('fs')
        const path = await import('path')
        const args = request.args || {}

        switch (request.command) {
            case 'read': {
                const filepath = args.path as string
                return fs.readFileSync(filepath, 'utf8')
            }
            case 'write': {
                const filepath = args.path as string
                const content = args.content as string
                const dir = path.dirname(filepath)
                fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(filepath, content)
                return `Written to ${filepath}`
            }
            case 'list': {
                const dir = args.path as string
                return fs.readdirSync(dir).join('\n')
            }
            case 'exists': {
                const filepath = args.path as string
                return fs.existsSync(filepath) ? 'true' : 'false'
            }
            default:
                throw new Error(`Unknown file command: ${request.command}`)
        }
    }

    // ─── Git Operations ──────────────────────────────────────────

    private static async executeGit(request: ToolRequest): Promise<string> {
        const { execSync } = await import('child_process')
        const result = execSync(`git ${request.command}`, {
            cwd: request.cwd || process.cwd(),
            encoding: 'utf8',
            timeout: 30000,
        })
        return result.toString()
    }

    // ─── Web Scraping ────────────────────────────────────────────

    private static async executeWeb(request: ToolRequest): Promise<string> {
        const args = request.args || {}
        const url = args.url as string || request.command

        const response = await fetch(url, {
            headers: { 'User-Agent': 'MAK-OS-Agent/1.0' },
            signal: AbortSignal.timeout(request.timeout || 15000),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('json')) {
            return JSON.stringify(await response.json(), null, 2)
        }
        return await response.text()
    }

    // ─── API Calls ───────────────────────────────────────────────

    private static async executeApi(request: ToolRequest): Promise<string> {
        const args = request.args || {}
        const url = request.command
        const method = (args.method as string || 'GET').toUpperCase()
        const headers = (args.headers as Record<string, string>) || {}
        const body = args.body ? JSON.stringify(args.body) : undefined

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body,
            signal: AbortSignal.timeout(request.timeout || 30000),
        })

        const text = await response.text()
        if (!response.ok) throw new Error(`API ${response.status}: ${text}`)
        return text
    }

    // ─── Deployment ──────────────────────────────────────────────

    private static async executeDeploy(request: ToolRequest): Promise<string> {
        // Deployment is a controlled shell execution with logging
        console.log(`[Deploy] Executing: ${request.command}`)
        return this.executeShell(request)
    }

    // ─── Email Sending ───────────────────────────────────────────

    private static async executeEmail(request: ToolRequest): Promise<string> {
        const args = request.args || {}
        // This would integrate with Zoho Mail API in production
        console.log(`[Email] To: ${args.to}, Subject: ${args.subject}`)
        return `Email queued: ${args.to} — ${args.subject}`
    }
}
