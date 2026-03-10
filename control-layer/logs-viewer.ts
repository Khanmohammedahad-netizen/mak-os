// ─── Types ────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface LogEntry {
    id: number
    timestamp: Date
    level: LogLevel
    source: string // agent name, workflow name, or system component
    message: string
    metadata?: Record<string, unknown>
}

// ─── Logs Viewer ─────────────────────────────────────────────────────

export class LogsViewer {
    private entries: LogEntry[] = []
    private counter = 0
    private maxEntries = 10000

    /**
     * Write a log entry.
     */
    public log(level: LogLevel, source: string, message: string, metadata?: Record<string, unknown>): void {
        this.entries.push({
            id: ++this.counter,
            timestamp: new Date(),
            level,
            source,
            message,
            metadata,
        })

        // Ring buffer: keep last N entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries)
        }
    }

    // Convenience methods
    public debug(source: string, message: string, meta?: Record<string, unknown>) { this.log('debug', source, message, meta) }
    public info(source: string, message: string, meta?: Record<string, unknown>) { this.log('info', source, message, meta) }
    public warn(source: string, message: string, meta?: Record<string, unknown>) { this.log('warn', source, message, meta) }
    public error(source: string, message: string, meta?: Record<string, unknown>) { this.log('error', source, message, meta) }
    public critical(source: string, message: string, meta?: Record<string, unknown>) { this.log('critical', source, message, meta) }

    /**
     * Query logs with filters.
     */
    public query(filters?: {
        level?: LogLevel
        source?: string
        since?: Date
        limit?: number
        search?: string
    }): LogEntry[] {
        let results = [...this.entries]

        if (filters?.level) results = results.filter(e => e.level === filters.level)
        if (filters?.source) results = results.filter(e => e.source.includes(filters.source!))
        if (filters?.since) results = results.filter(e => e.timestamp >= filters.since!)
        if (filters?.search) {
            const term = filters.search.toLowerCase()
            results = results.filter(e => e.message.toLowerCase().includes(term))
        }

        results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

        if (filters?.limit) results = results.slice(0, filters.limit)
        return results
    }

    /**
     * Format logs for display.
     */
    public format(entries: LogEntry[]): string {
        const levelIcons: Record<LogLevel, string> = {
            debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌', critical: '🔥'
        }

        return entries.map(e => {
            const ts = e.timestamp.toISOString().replace('T', ' ').substring(0, 19)
            return `${levelIcons[e.level]} [${ts}] [${e.source}] ${e.message}`
        }).join('\n')
    }

    /**
     * Log statistics.
     */
    public stats(): Record<LogLevel, number> {
        const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0, critical: 0 }
        for (const entry of this.entries) {
            counts[entry.level]++
        }
        return counts
    }
}

export const logsViewer = new LogsViewer()
