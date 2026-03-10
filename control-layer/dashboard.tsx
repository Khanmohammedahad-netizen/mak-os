import { taskQueue, type TaskStatus } from './task-queue'
import { agentMonitor } from './agent-monitor'
import { workflowMonitor } from './workflow-monitor'
import { logsViewer } from './logs-viewer'
import { leadGenerationWorkflow } from '../workflows/lead-generation-workflow'
import { websiteBuildWorkflow } from '../workflows/website-build-workflow'
import { automationWorkflow } from '../workflows/automation-workflow'

// ─── Dashboard ───────────────────────────────────────────────────────

export class Dashboard {
    /**
     * Render the full system dashboard as a structured text report.
     */
    public static render(): string {
        const lines: string[] = []

        // ── Header ──
        lines.push('╔═══════════════════════════════════════════════════╗')
        lines.push('║            MAK OS — Control Dashboard             ║')
        lines.push('╚═══════════════════════════════════════════════════╝')
        lines.push('')

        // ── System Health ──
        const health = agentMonitor.getSystemHealth()
        lines.push('┌── System Health ────────────────────────────────┐')
        lines.push(`│  Agents: ${health.totalAgents}    Skills: ${health.totalSkills}    Categories: ${health.categories.length}`.padEnd(52) + '│')
        lines.push('└─────────────────────────────────────────────────┘')
        lines.push('')

        // ── Agent Status ──
        lines.push('┌── Agents ───────────────────────────────────────┐')
        for (const agent of health.agentStatuses) {
            const status = agent.status === 'active' ? '🟢' : '⚪'
            const line = `│  ${status} ${agent.name.padEnd(22)} [${agent.categories.join(',')}]`
            lines.push(line.padEnd(52) + '│')
            lines.push(`│     Skills: ${agent.skillsAvailable}`.padEnd(52) + '│')
        }
        lines.push('└─────────────────────────────────────────────────┘')
        lines.push('')

        // ── Task Queue ──
        const stats = taskQueue.stats()
        lines.push('┌── Task Queue ──────────────────────────────────┐')
        lines.push(`│  Queued: ${stats.queued}  Running: ${stats.running}  Done: ${stats.completed}  Failed: ${stats.failed}`.padEnd(52) + '│')

        const recentTasks = taskQueue.list().slice(0, 5)
        for (const task of recentTasks) {
            const statusIcon = task.status === 'completed' ? '✓' : task.status === 'running' ? '⟳' : task.status === 'failed' ? '✗' : '○'
            const desc = task.description.length > 30 ? task.description.substring(0, 30) + '…' : task.description
            lines.push(`│  ${statusIcon} ${desc}`.padEnd(52) + '│')
        }
        lines.push('└─────────────────────────────────────────────────┘')
        lines.push('')

        // ── Workflows ──
        const runs = workflowMonitor.listRuns().slice(0, 3)
        lines.push('┌── Recent Workflows ────────────────────────────┐')
        if (runs.length === 0) {
            lines.push('│  No workflow runs yet.'.padEnd(52) + '│')
        }
        for (const run of runs) {
            const icon = run.status === 'completed' ? '✓' : run.status === 'running' ? '⟳' : '✗'
            const dur = run.result?.totalDurationMs ? `${run.result.totalDurationMs}ms` : '…'
            lines.push(`│  ${icon} ${run.workflowName.padEnd(28)} ${dur}`.padEnd(52) + '│')
        }
        lines.push('└─────────────────────────────────────────────────┘')
        lines.push('')

        // ── Available Pipelines ──
        lines.push('┌── Available Pipelines ─────────────────────────┐')
        lines.push(workflowMonitor.visualize(leadGenerationWorkflow).split('\n').map(l => '│  ' + l).join('\n'))
        lines.push('│')
        lines.push(workflowMonitor.visualize(websiteBuildWorkflow).split('\n').map(l => '│  ' + l).join('\n'))
        lines.push('│')
        lines.push(workflowMonitor.visualize(automationWorkflow).split('\n').map(l => '│  ' + l).join('\n'))
        lines.push('└─────────────────────────────────────────────────┘')
        lines.push('')

        // ── Recent Logs ──
        const recentLogs = logsViewer.query({ limit: 10 })
        lines.push('┌── Recent Logs ─────────────────────────────────┐')
        if (recentLogs.length === 0) {
            lines.push('│  No logs recorded yet.'.padEnd(52) + '│')
        } else {
            for (const log of recentLogs) {
                const ts = log.timestamp.toISOString().substring(11, 19)
                const msg = log.message.length > 30 ? log.message.substring(0, 30) + '…' : log.message
                lines.push(`│  [${ts}] ${log.level.toUpperCase().padEnd(5)} ${msg}`.padEnd(52) + '│')
            }
        }
        const logStats = logsViewer.stats()
        lines.push(`│  Totals: ${logStats.error} errors, ${logStats.warn} warnings, ${logStats.info} info`.padEnd(52) + '│')
        lines.push('└─────────────────────────────────────────────────┘')

        return lines.join('\n')
    }

    /**
     * Submit a task via the dashboard.
     */
    public static submitTask(description: string, priority?: 'low' | 'normal' | 'high' | 'critical'): string {
        const id = taskQueue.submit(description, priority || 'normal')
        logsViewer.info('Dashboard', `Task submitted: ${description}`, { taskId: id })
        return id
    }

    /**
     * Approve a pending tool execution (placeholder for human-in-the-loop).
     */
    public static approveTool(requestId: string): boolean {
        logsViewer.info('Dashboard', `Tool execution approved: ${requestId}`)
        return true
    }
}
