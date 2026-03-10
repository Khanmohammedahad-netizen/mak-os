import { getAgent, type AgentId } from '../agents/agent-registry'
import { type AgentResult } from '../agents/base-agent'
import { ToolExecutor, type ToolRequest, type ToolResult } from '../runtime/tool-executor'

// ─── Types ────────────────────────────────────────────────────────────

export type StepMode = 'sequential' | 'parallel'

export interface WorkflowStep {
    id: string
    agentId: AgentId
    taskTemplate: string // Use {{prev.fieldName}} for result injection
    dependsOn?: string[] // Step IDs this step waits for (auto-inferred in sequential)
    tools?: ToolRequest[] // Optional tools to execute after agent reasoning
}

export interface WorkflowStage {
    mode: StepMode
    steps: WorkflowStep[]
}

export interface WorkflowDefinition {
    name: string
    description: string
    stages: WorkflowStage[]
}

export interface StepResult {
    stepId: string
    agentId: AgentId
    result: AgentResult
    toolResults: ToolResult[]
    durationMs: number
}

export interface WorkflowResult {
    workflowName: string
    status: 'completed' | 'failed'
    totalDurationMs: number
    stageResults: StepResult[][]
    error?: string
}

// ─── Engine ───────────────────────────────────────────────────────────

export class WorkflowEngine {
    /**
     * Execute a complete workflow definition.
     * Stages run in order. Steps within a stage run based on stage mode.
     */
    public static async run(definition: WorkflowDefinition, initialContext?: Record<string, unknown>): Promise<WorkflowResult> {
        const workflowStart = Date.now()
        const allResults: StepResult[][] = []
        const resultMap: Record<string, AgentResult> = {} // stepId → result

        try {
            for (const stage of definition.stages) {
                const stageResults: StepResult[] = []

                if (stage.mode === 'parallel') {
                    // Execute all steps in this stage simultaneously
                    for (const step of stage.steps) {
                        const result = await this.executeStep(step, resultMap, initialContext)
                        stageResults.push(result)
                        resultMap[step.id] = result.result
                    }
                } else {
                    // Execute steps sequentially, each can reference the previous
                    for (const step of stage.steps) {
                        const result = await this.executeStep(step, resultMap, initialContext)
                        stageResults.push(result)
                        resultMap[step.id] = result.result
                    }
                }

                allResults.push(stageResults)
            }

            return {
                workflowName: definition.name,
                status: 'completed',
                totalDurationMs: Date.now() - workflowStart,
                stageResults: allResults,
            }
        } catch (e: unknown) {
            return {
                workflowName: definition.name,
                status: 'failed',
                totalDurationMs: Date.now() - workflowStart,
                stageResults: allResults,
                error: e instanceof Error ? e.message : 'Unknown error',
            }
        }
    }

    /**
     * Execute a single workflow step.
     */
    private static async executeStep(
        step: WorkflowStep,
        previousResults: Record<string, AgentResult>,
        context?: Record<string, unknown>
    ): Promise<StepResult> {
        const stepStart = Date.now()

        // Resolve template: inject previous step results
        let resolvedTask = step.taskTemplate

        // Replace {{prev.stepId.field}} patterns
        resolvedTask = resolvedTask.replace(/\{\{prev\.(\w+)\.(\w+)\}\}/g, (_, stepId, field) => {
            const prev = previousResults[stepId]
            if (!prev) return `[no result from ${stepId}]`
            const val = (prev as unknown as Record<string, unknown>)[field]
            return typeof val === 'string' ? val : JSON.stringify(val)
        })

        // Replace {{context.field}} patterns
        if (context) {
            resolvedTask = resolvedTask.replace(/\{\{context\.(\w+)\}\}/g, (_, field) => {
                return String(context[field] || `[missing: ${field}]`)
            })
        }

        // Get agent and execute
        const agent = getAgent(step.agentId)
        const result = agent.execute({ description: resolvedTask })

        // Execute optional tools
        const toolResults: ToolResult[] = []
        if (step.tools && step.tools.length > 0) {
            for (const toolReq of step.tools) {
                // Resolve template variables in tool commands
                let cmd = toolReq.command
                cmd = cmd.replace(/\{\{context\.(\w+)\}\}/g, (_, field) => {
                    return String(context?.[field] || `[missing: ${field}]`)
                })
                const resolvedReq = { ...toolReq, command: cmd }
                const toolResult = await ToolExecutor.execute(step.agentId, resolvedReq)
                toolResults.push(toolResult)
            }
        }

        return {
            stepId: step.id,
            agentId: step.agentId,
            result,
            toolResults,
            durationMs: Date.now() - stepStart,
        }
    }

    /**
     * Dry-run: show the execution plan without running agents.
     */
    public static preview(definition: WorkflowDefinition): string {
        const lines: string[] = []
        lines.push(`═══ Workflow: ${definition.name} ═══`)
        lines.push(`${definition.description}\n`)

        definition.stages.forEach((stage, i) => {
            lines.push(`Stage ${i + 1} [${stage.mode}]:`)
            for (const step of stage.steps) {
                const deps = step.dependsOn?.length ? ` (waits for: ${step.dependsOn.join(', ')})` : ''
                lines.push(`  → [${step.id}] ${step.agentId}${deps}`)
                lines.push(`    Task: "${step.taskTemplate}"`)
            }
            lines.push('')
        })

        return lines.join('\n')
    }
}
