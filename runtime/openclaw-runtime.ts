import { ToolExecutor, type ToolRequest, type ToolResult } from './tool-executor'
import { PermissionManager } from './permission-manager'
import type { AgentId } from '../agents/agent-registry'
import type { AgentResult } from '../agents/base-agent'

// ─── Execution Plan ──────────────────────────────────────────────────

export interface ExecutionStep {
    tool: ToolRequest
    condition?: (previousResults: ToolResult[]) => boolean // Optional gate
}

export interface ExecutionPlan {
    agentId: AgentId
    agentResult: AgentResult
    steps: ExecutionStep[]
}

export interface RuntimeResult {
    agentId: AgentId
    planExecuted: boolean
    toolResults: ToolResult[]
    totalDurationMs: number
    errors: string[]
}

// ─── OpenClaw Runtime ────────────────────────────────────────────────

export class OpenClawRuntime {
    private permissionManager: PermissionManager

    constructor(permissionManager?: PermissionManager) {
        this.permissionManager = permissionManager || new PermissionManager()
    }

    /**
     * Execute a full plan: run the agent, then execute each tool step sequentially.
     */
    public async executePlan(plan: ExecutionPlan): Promise<RuntimeResult> {
        const start = Date.now()
        const toolResults: ToolResult[] = []
        const errors: string[] = []

        console.log(`[OpenClaw] Executing plan for agent: ${plan.agentId}`)
        console.log(`[OpenClaw] Agent activated skills: ${plan.agentResult.activatedSkills.join(', ')}`)
        console.log(`[OpenClaw] Tool steps to execute: ${plan.steps.length}`)

        for (const step of plan.steps) {
            // Check conditional gate
            if (step.condition && !step.condition(toolResults)) {
                console.log(`[OpenClaw] Skipping tool "${step.tool.tool}:${step.tool.command}" — condition not met`)
                continue
            }

            // Execute the tool
            console.log(`[OpenClaw] Running: ${step.tool.tool}:${step.tool.command}`)
            const result = await ToolExecutor.execute(plan.agentId, step.tool)
            toolResults.push(result)

            if (!result.success) {
                errors.push(`${step.tool.tool}:${step.tool.command} failed: ${result.error}`)
                console.error(`[OpenClaw] Tool failed: ${result.error}`)
                // Continue execution — do not halt on non-critical failures
            } else {
                console.log(`[OpenClaw] Tool succeeded (${result.durationMs}ms)`)
            }
        }

        return {
            agentId: plan.agentId,
            planExecuted: true,
            toolResults,
            totalDurationMs: Date.now() - start,
            errors,
        }
    }

    /**
     * Quick single-tool execution without a full plan.
     */
    public async executeTool(agentId: AgentId, request: ToolRequest): Promise<ToolResult> {
        return ToolExecutor.execute(agentId, request)
    }

    /**
     * Dry-run: validate permissions and list what would be executed.
     */
    public previewPlan(plan: ExecutionPlan): string[] {
        const lines: string[] = []
        lines.push(`═══ Execution Plan: ${plan.agentId} ═══`)

        for (const step of plan.steps) {
            const perm = this.permissionManager.check(plan.agentId, step.tool.tool)
            const icon = perm === 'allow' ? '✓' : perm === 'ask' ? '⚠' : '✗'
            lines.push(`  ${icon} [${step.tool.tool}] ${step.tool.command} (${perm})`)
        }

        return lines
    }
}

export const runtime = new OpenClawRuntime()
