import { dispatch, getAgent, type AgentId } from '../agents/agent-registry'
import { WorkflowIntentRouter } from '../core/workflow-intent-router'
import { WorkflowEngine } from '../workflows/workflow-engine'
import { logsViewer } from './logs-viewer'
import type { AgentResult } from '../agents/base-agent'

// ─── Types ────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TaskMode = 'agent' | 'workflow'

export interface Task {
    id: string
    description: string
    assignedAgent: AgentId | null
    workflowName: string | null
    mode: TaskMode
    priority: TaskPriority
    status: TaskStatus
    result: AgentResult | null
    stages: string[]  // Log of workflow stages completed
    createdAt: Date
    startedAt: Date | null
    completedAt: Date | null
    error: string | null
}

// ─── Task Queue ──────────────────────────────────────────────────────

export class TaskQueue {
    private tasks: Map<string, Task> = new Map()
    private counter = 0

    /**
     * Submit a new task. Automatically detects whether it should run
     * as a workflow or a simple agent dispatch.
     */
    public submit(description: string, priority: TaskPriority = 'normal'): string {
        const id = `task-${++this.counter}-${Date.now()}`
        const task: Task = {
            id,
            description,
            assignedAgent: null,
            workflowName: null,
            mode: 'agent',
            priority,
            status: 'queued',
            result: null,
            stages: [],
            createdAt: new Date(),
            startedAt: null,
            completedAt: null,
            error: null,
        }
        this.tasks.set(id, task)
        logsViewer.info('TaskQueue', `Task submitted: "${description}"`, { taskId: id })
        return id
    }

    /**
     * Process the next queued task. Checks workflow intent first.
     */
    public async processNext(): Promise<Task | null> {
        const priorityOrder: TaskPriority[] = ['critical', 'high', 'normal', 'low']

        for (const prio of priorityOrder) {
            const next = Array.from(this.tasks.values()).find(
                t => t.status === 'queued' && t.priority === prio
            )
            if (next) {
                return this.executeTask(next)
            }
        }
        return null
    }

    /**
     * Execute a specific task by ID.
     */
    public async processById(id: string): Promise<Task | null> {
        const task = this.tasks.get(id)
        if (!task || task.status !== 'queued') return null
        return this.executeTask(task)
    }

    /**
     * Core execution: route to workflow or single agent.
     */
    private async executeTask(task: Task): Promise<Task> {
        task.status = 'running'
        task.startedAt = new Date()

        try {
            // Step 1: Check if a workflow matches
            const intentResult = WorkflowIntentRouter.route(task.description)

            if (intentResult.matched) {
                // ── Workflow Execution Path ──
                task.mode = 'workflow'
                task.workflowName = intentResult.workflow.name
                logsViewer.info('TaskQueue', `Workflow detected: ${intentResult.workflow.name}`, { taskId: task.id })

                // Log each stage
                for (let i = 0; i < intentResult.workflow.stages.length; i++) {
                    const stage = intentResult.workflow.stages[i]
                    for (const step of stage.steps) {
                        const stageName = `Stage ${i + 1}: ${step.agentId}`
                        task.stages.push(stageName)
                        logsViewer.info('WorkflowEngine', stageName, { taskId: task.id, stepId: step.id })
                    }
                }

                // Execute the workflow
                const workflowResult = await WorkflowEngine.run(intentResult.workflow, intentResult.context)

                if (workflowResult.status === 'completed') {
                    task.status = 'completed'
                    // Grab the last stage's result as the task result
                    const lastStage = workflowResult.stageResults[workflowResult.stageResults.length - 1]
                    if (lastStage && lastStage.length > 0) {
                        task.result = lastStage[lastStage.length - 1].result
                    }
                    logsViewer.info('TaskQueue', `Workflow completed: ${intentResult.workflow.name} (${workflowResult.totalDurationMs}ms)`, { taskId: task.id })
                } else {
                    task.status = 'failed'
                    task.error = workflowResult.error || 'Workflow failed'
                    logsViewer.error('TaskQueue', `Workflow failed: ${workflowResult.error}`, { taskId: task.id })
                }
            } else {
                // ── Single Agent Dispatch Path ──
                task.mode = 'agent'
                const agent = dispatch(task.description)
                task.assignedAgent = agent.name.toLowerCase().replace(/agent$/, '').trim() as AgentId
                task.stages.push(`Agent: ${agent.name}`)
                logsViewer.info('TaskQueue', `Agent dispatched: ${agent.name}`, { taskId: task.id })

                const agentResult = await agent.execute({ description: task.description })
                task.result = agentResult
                task.status = 'completed'
                logsViewer.info('TaskQueue', `Agent completed: ${agent.name} (${agentResult.activatedSkills.length} skills)`, { taskId: task.id })
            }
        } catch (e: unknown) {
            task.status = 'failed'
            task.error = e instanceof Error ? e.message : 'Unknown error'
            logsViewer.error('TaskQueue', `Task failed: ${task.error}`, { taskId: task.id })
        }

        task.completedAt = new Date()
        this.tasks.set(task.id, task)
        return task
    }

    public getTask(id: string): Task | undefined { return this.tasks.get(id) }

    public list(status?: TaskStatus): Task[] {
        const all = Array.from(this.tasks.values())
        if (status) return all.filter(t => t.status === status)
        return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    public cancel(id: string): boolean {
        const task = this.tasks.get(id)
        if (!task || task.status !== 'queued') return false
        task.status = 'cancelled'
        task.completedAt = new Date()
        return true
    }

    public stats(): Record<TaskStatus, number> {
        const counts: Record<TaskStatus, number> = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
        for (const task of Array.from(this.tasks.values())) { counts[task.status]++ }
        return counts
    }
}

export const taskQueue = new TaskQueue()
