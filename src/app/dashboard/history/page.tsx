'use client'

import { useEffect, useState } from 'react'
import {
    Mail, Phone, Clock, AlertCircle, MapPin, Globe,
    RefreshCw, Play, Square, Zap, Send,
} from 'lucide-react'

interface Lead {
    id: string
    company: string
    email: string | null
    phone: string | null
    city: string | null
    category: string | null
    website: string | null
    source: string | null
    contact_method: string | null
    contacted_at: string | null
    priority_score: number | null
    created_at: string
}

interface Metrics {
    total: number
    emailed: number
    phoneNeeded: number
    queued: number
    failed: number
}

interface SchedulerStatus {
    running: boolean
    isExecuting: boolean
    cities: string[]
    nextCity: string
    lastRunAt: string | null
    lastResult: any | null
}

const contactMethodColors: Record<string, string> = {
    emailed: 'bg-green-100 text-green-700',
    email: 'bg-blue-100 text-blue-700',
    phone: 'bg-amber-100 text-amber-700',
    queued: 'bg-purple-100 text-purple-700',
    email_failed: 'bg-red-100 text-red-700',
}

const contactMethodIcons: Record<string, any> = {
    emailed: Mail,
    email: Mail,
    phone: Phone,
    queued: Clock,
    email_failed: AlertCircle,
}

export default function HistoryPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [taskInput, setTaskInput] = useState('')
    const [running, setRunning] = useState(false)
    const [runResult, setRunResult] = useState<any>(null)

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/mobile/history?limit=50')
            const data = await res.json()
            setLeads(data.leads || [])
            setMetrics(data.metrics || null)
        } catch (err) {
            console.error('[HistoryPage] Error fetching history:', err)
        }
        setLoading(false)
    }

    const fetchScheduler = async () => {
        try {
            const res = await fetch('/api/mobile/auto-run')
            const data = await res.json()
            setScheduler(data)
        } catch (err) {
            console.error('[HistoryPage] Error fetching scheduler status:', err)
        }
    }

    useEffect(() => {
        fetchHistory()
        fetchScheduler()
    }, [])

    const runTask = async (task: string) => {
        if (running) return
        setRunning(true)
        setRunResult(null)
        try {
            const res = await fetch('/api/mobile/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task }),
            })
            const data = await res.json()
            setRunResult(data)
            fetchHistory()
        } catch (err: any) {
            console.error('[HistoryPage] Error running task:', err)
            setRunResult({ error: err.message })
        }
        setRunning(false)
    }

    const toggleScheduler = async (action: 'start' | 'stop') => {
        await fetch('/api/mobile/auto-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        })
        fetchScheduler()
    }

    const presets = [
        { label: '🍕 Restaurants', task: 'find restaurants without websites' },
        { label: '💇 Salons', task: 'find salons without websites' },
        { label: '🏋️ Gyms', task: 'find gyms without websites' },
        { label: '☕ Cafes', task: 'find cafes without websites' },
        { label: '🏨 Hotels', task: 'find hotels without websites' },
        { label: '🏥 Clinics', task: 'find clinics without websites' },
    ]

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                    <Zap className="h-7 w-7 text-amber-500" />
                    Command Center
                </h1>
                <p className="text-gray-500 mt-1 text-sm">Run pipelines, view leads, control automation</p>
            </div>

            {/* Quick Run */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                    <Send className="h-5 w-5 text-blue-500" />
                    Quick Run
                </h3>
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={taskInput}
                        onChange={e => setTaskInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && taskInput.trim() && runTask(taskInput)}
                        placeholder="e.g. find restaurants in Dallas without websites"
                        className="w-full px-4 py-3.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => taskInput.trim() && runTask(taskInput)}
                        disabled={running || !taskInput.trim()}
                        className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-base"
                    >
                        {running ? '⚡ Running Pipeline...' : 'Run Pipeline'}
                    </button>
                </div>

                {/* Preset Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                    {presets.map(p => (
                        <button
                            key={p.label}
                            onClick={() => !running && runTask(`${p.task} in chicago`)}
                            disabled={running}
                            className="py-3 px-3 bg-gray-50 border rounded-xl text-sm font-medium hover:bg-gray-100 transition active:scale-[0.98] disabled:opacity-50"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Run Result */}
            {runResult && (
                <div className="bg-white rounded-2xl border shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="font-semibold mb-3 text-lg">
                        {runResult.error ? '❌ Error' : '✅ Pipeline Complete'}
                    </h3>
                    {runResult.error ? (
                        <p className="text-red-600">{runResult.error}</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(runResult.metrics || {}).map(([key, val]) => (
                                <div key={key} className="p-3 bg-gray-50 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase">{key}</p>
                                    <p className="text-xl font-bold">{String(val)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Auto-Scheduler */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-500" />
                        Auto-Scheduler
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${scheduler?.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {scheduler?.running ? '● Running' : '○ Stopped'}
                    </span>
                </div>
                {scheduler && (
                    <div className="mb-3 text-sm text-gray-500">
                        <p>Cities: {scheduler.cities.join(' → ')}</p>
                        <p>Next: <strong>{scheduler.nextCity}</strong></p>
                        {scheduler.lastRunAt && <p>Last run: {new Date(scheduler.lastRunAt).toLocaleString()}</p>}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        onClick={() => toggleScheduler(scheduler?.running ? 'stop' : 'start')}
                        className={`flex-1 py-3 rounded-xl font-semibold transition active:scale-[0.98] flex items-center justify-center gap-2 ${scheduler?.running
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                            }`}
                    >
                        {scheduler?.running ? <><Square className="h-4 w-4" /> Stop</> : <><Play className="h-4 w-4" /> Start 24h Auto</>}
                    </button>
                </div>
            </div>

            {/* Metrics Bar */}
            {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <MetricCard label="Total Leads" value={metrics.total} color="text-gray-900" bg="bg-gray-50" />
                    <MetricCard label="Emailed" value={metrics.emailed} color="text-green-700" bg="bg-green-50" />
                    <MetricCard label="Phone" value={metrics.phoneNeeded} color="text-amber-700" bg="bg-amber-50" />
                    <MetricCard label="Queued" value={metrics.queued} color="text-purple-700" bg="bg-purple-50" />
                    <MetricCard label="Failed" value={metrics.failed} color="text-red-700" bg="bg-red-50" />
                </div>
            )}

            {/* Lead Cards */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Recent Leads</h3>
                <button onClick={() => { setLoading(true); fetchHistory() }} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-lg">No leads yet</p>
                    <p className="text-sm">Run a pipeline above to discover businesses</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {leads.map(lead => {
                        const cm = lead.contact_method || 'email'
                        const Icon = contactMethodIcons[cm] || Mail
                        const colorClass = contactMethodColors[cm] || 'bg-gray-100 text-gray-600'

                        return (
                            <div key={lead.id} className="bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-semibold text-base truncate">{lead.company}</h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            {lead.city && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <MapPin className="h-3 w-3" /> {lead.city}
                                                </span>
                                            )}
                                            {lead.category && (
                                                <span className="text-xs text-gray-400">{lead.category}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${colorClass}`}>
                                        <Icon className="h-3 w-3" />
                                        {cm}
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                    {lead.email && <span>✉ {lead.email}</span>}
                                    {lead.phone && <span>📞 {lead.phone}</span>}
                                    {lead.website && (
                                        <span className="flex items-center gap-1">
                                            <Globe className="h-3 w-3" /> {
                                                (() => {
                                                    try { return new URL(lead.website!).hostname }
                                                    catch (e) { return lead.website }
                                                })()
                                            }
                                        </span>
                                    )}
                                </div>
                                {lead.contacted_at && (
                                    <p className="text-xs text-gray-400 mt-2">
                                        Contacted: {new Date(lead.contacted_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function MetricCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
    return (
        <div className={`${bg} rounded-xl p-4 border`}>
            <p className="text-xs text-gray-500 uppercase">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
    )
}
