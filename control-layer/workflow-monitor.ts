import type { WorkflowDefinition, WorkflowResult, StepResult } from '../workflows/workflow-engine'

// ─── Types ────────────────────────────────────────────────────────────

export interface WorkflowRun {
    id: string
    workflowName: string
    definition: WorkflowDefinition
    result: WorkflowResult | null
    startedAt: Date
    finishedAt: Date | null
    status: 'running' | 'completed' | 'failed'
}

// ─── Workflow Monitor ────────────────────────────────────────────────

export class WorkflowMonitor {
    private runs: Map<string, WorkflowRun> = new Map()
    private counter = 0

    /**
     * Register a workflow run (called before execution).
     */
    public startRun(definition: WorkflowDefinition): string {
        const id = `wf-${++this.counter}-${Date.now()}`
        this.runs.set(id, {
            id,
            workflowName: definition.name,
            definition,
            result: null,
            startedAt: new Date(),
            finishedAt: null,
            status: 'running',
        })
        return id
    }

    /**
     * Record workflow completion.
     */
    public completeRun(id: string, result: WorkflowResult): void {
        const run = this.runs.get(id)
        if (!run) return
        run.result = result
        run.finishedAt = new Date()
        run.status = result.status === 'completed' ? 'completed' : 'failed'
    }

    /**
     * Get a specific run.
     */
    public getRun(id: string): WorkflowRun | undefined {
        return this.runs.get(id)
    }

    /**
     * List all runs.
     */
    public listRuns(status?: WorkflowRun['status']): WorkflowRun[] {
        const all = Array.from(this.runs.values())
        if (status) return all.filter(r => r.status === status)
        return all.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    }

    /**
     * Generate a text-based pipeline visualization.
     */
    public visualize(definition: WorkflowDefinition): string {
        const lines: string[] = []
        lines.push(`┌─────────────────────────────────────────────┐`)
        lines.push(`│  ${definition.name.padEnd(42)}│`)
        lines.push(`├─────────────────────────────────────────────┤`)

        definition.stages.forEach((stage, i) => {
            const mode = stage.mode === 'parallel' ? '═══ PARALLEL ═══' : '─── SEQUENTIAL ───'
            lines.push(`│  Stage ${i + 1}: ${mode.padEnd(30)}│`)

            for (const step of stage.steps) {
                const deps = step.dependsOn?.length ? ` ← ${step.dependsOn.join(',')}` : ''
                const tools = step.tools?.length ? ` 🔧${step.tools.length}` : ''
                lines.push(`│    [${step.agentId}]${tools}${deps}`.padEnd(46) + '│')
            }

            if (i < definition.stages.length - 1) {
                lines.push(`│        ↓`.padEnd(46) + '│')
            }
        })

        lines.push(`└─────────────────────────────────────────────┘`)
        return lines.join('\n')
    }

    /**
     * Generate a run report.
     */
    public report(runId: string): string {
        const run = this.runs.get(runId)
        if (!run) return 'Run not found'
        if (!run.result) return `Workflow "${run.workflowName}" is still running...`

        const lines: string[] = []
        lines.push(`═══ Workflow Report: ${run.workflowName} ═══`)
        lines.push(`Status: ${run.status}`)
        lines.push(`Duration: ${run.result.totalDurationMs}ms`)
        lines.push('')

        run.result.stageResults.forEach((stage, i) => {
            lines.push(`Stage ${i + 1}:`)
            for (const step of stage) {
                const skillList = step.result.activatedSkills.slice(0, 3).join(', ')
                const toolCount = step.toolResults?.length || 0
                lines.push(`  [${step.stepId}] ${step.agentId} → ${step.result.status} (${step.durationMs}ms)`)
                lines.push(`    Skills: ${skillList}`)
                if (toolCount > 0) {
                    lines.push(`    Tools executed: ${toolCount}`)
                }
            }
        })

        if (run.result.error) {
            lines.push(`\nError: ${run.result.error}`)
        }

        return lines.join('\n')
    }
}

export const workflowMonitor = new WorkflowMonitor()
