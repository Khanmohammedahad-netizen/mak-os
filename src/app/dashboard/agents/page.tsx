'use client'

import { useEffect, useState } from 'react'
import {
    Bot, Brain, Cpu, Activity, Zap, Shield, Search, Code,
    Rocket, Send, Play, BarChart3, Terminal, AlertCircle
} from 'lucide-react'

interface Agent {
    id: string
    name: string
    categories: string[]
    status: string
    role: string
    skillsAvailable: number
}

interface SystemData {
    system: { totalAgents: number; totalSkills: number; categories: string[]; categoryStats: Record<string, number> }
    agents: Agent[]
    workflows: { name: string; stages: number; agents: string[]; status: string }[]
}

const agentIcons: Record<string, any> = {
    'lead-finder': Search,
    'website-audit': Activity,
    'marketing': Rocket,
    'research': Brain,
    'developer': Code,
    'devops': Terminal,
    'security': Shield,
    'automation': Zap,
}

const agentColors: Record<string, string> = {
    'lead-finder': 'from-emerald-500 to-teal-600',
    'website-audit': 'from-blue-500 to-indigo-600',
    'marketing': 'from-pink-500 to-rose-600',
    'research': 'from-purple-500 to-violet-600',
    'developer': 'from-amber-500 to-orange-600',
    'devops': 'from-cyan-500 to-sky-600',
    'security': 'from-red-500 to-rose-700',
    'automation': 'from-yellow-500 to-amber-600',
}

const categoryColors: Record<string, string> = {
    'ai-agents': 'bg-violet-100 text-violet-700',
    'automation': 'bg-amber-100 text-amber-700',
    'development': 'bg-blue-100 text-blue-700',
    'devops': 'bg-cyan-100 text-cyan-700',
    'marketing': 'bg-pink-100 text-pink-700',
    'research': 'bg-purple-100 text-purple-700',
    'security': 'bg-red-100 text-red-700',
    'web-dev': 'bg-emerald-100 text-emerald-700',
}

type Tab = 'overview' | 'agents' | 'workflows' | 'tasks' | 'logs'

export default function AgentsDashboard() {
    const [data, setData] = useState<SystemData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [taskInput, setTaskInput] = useState('')
    const [taskLog, setTaskLog] = useState<{ time: string; msg: string; level: string }[]>([])
    const [taskPayload, setTaskPayload] = useState<any>(null)
    const [executing, setExecuting] = useState(false)

    useEffect(() => {
        fetch('/api/agents')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const submitTask = async () => {
        if (!taskInput.trim() || executing) return
        setExecuting(true)
        const now = new Date().toLocaleTimeString()

        setTaskPayload(null) // clear previous payload
        // Immediate feedback
        setTaskLog(prev => [
            ...prev,
            { time: now, msg: `Task submitted: "${taskInput}"`, level: 'info' },
        ])

        try {
            const res = await fetch('/api/agents/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: taskInput }),
            })
            const data = await res.json()

            if (data.logs && Array.isArray(data.logs)) {
                const ts = new Date().toLocaleTimeString()
                // Skip the first "Task submitted" since we already added it
                const apiLogs = data.logs.slice(1).map((msg: string) => {
                    let level = 'info'
                    if (msg.startsWith('Workflow detected')) level = 'workflow'
                    else if (msg.startsWith('Stage')) level = 'stage'
                    else if (msg.includes('completed')) level = 'success'
                    else if (msg.includes('dispatched')) level = 'info'
                    return { time: ts, msg, level }
                })
                setTaskLog(prev => [...prev, ...apiLogs])
            }
            if (data.payload) setTaskPayload(data.payload)
        } catch {
            setTaskLog(prev => [
                ...prev,
                { time: new Date().toLocaleTimeString(), msg: 'Error: Failed to execute task', level: 'error' },
            ])
        }

        setTaskInput('')
        setExecuting(false)
    }

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">Failed to load agent system data. Make sure the skill registry exists.</span>
                </div>
            </div>
        )
    }

    const tabs: { id: Tab; label: string; icon: any }[] = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'agents', label: 'Agents', icon: Bot },
        { id: 'workflows', label: 'Workflows', icon: Activity },
        { id: 'tasks', label: 'Task Center', icon: Send },
        { id: 'logs', label: 'Logs', icon: Terminal },
    ]

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Bot className="h-8 w-8 text-cyan-500" />
                    AI Agent Control Center
                </h1>
                <p className="text-gray-500 mt-1">Manage agents, workflows, and task execution</p>
            </div>

            {/* Tabs — scrollable on mobile */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition whitespace-nowrap min-h-[44px] ${activeTab === tab.id
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab data={data} />}
            {activeTab === 'agents' && <AgentsTab agents={data.agents} />}
            {activeTab === 'workflows' && <WorkflowsTab workflows={data.workflows} agents={data.agents} />}
            {activeTab === 'tasks' && (
                <TasksTab
                    taskInput={taskInput}
                    setTaskInput={setTaskInput}
                    submitTask={submitTask}
                    taskLog={taskLog}
                    taskPayload={taskPayload}
                    agents={data.agents}
                    executing={executing}
                />
            )}
            {activeTab === 'logs' && <LogsTab taskLog={taskLog} />}
        </div>
    )
}

// ─── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({ data }: { data: SystemData }) {
    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Agents" value={data.system.totalAgents} icon={Bot} color="text-cyan-500" bg="bg-cyan-50" />
                <StatCard label="Total Skills" value={data.system.totalSkills} icon={Brain} color="text-purple-500" bg="bg-purple-50" />
                <StatCard label="Categories" value={data.system.categories.length} icon={Cpu} color="text-amber-500" bg="bg-amber-50" />
                <StatCard label="Workflows" value={data.workflows.length} icon={Activity} color="text-emerald-500" bg="bg-emerald-50" />
            </div>

            {/* Skills by Category */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold mb-4">Skills by Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(data.system.categoryStats)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => (
                            <div key={cat} className={`rounded-lg p-3 ${categoryColors[cat] || 'bg-gray-100 text-gray-700'}`}>
                                <div className="text-2xl font-bold">{count}</div>
                                <div className="text-sm font-medium opacity-80">{cat}</div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Agent Quick View */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold mb-4">Agent Fleet</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.agents.map(agent => {
                        const Icon = agentIcons[agent.id] || Bot
                        return (
                            <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${agentColors[agent.id]} text-white`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{agent.name.replace('Agent', '')}</div>
                                    <div className="text-xs text-gray-400">{agent.skillsAvailable} skills</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: any; color: string; bg: string }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                </div>
            </div>
        </div>
    )
}

// ─── Agents Tab ──────────────────────────────────────────────────────

function AgentsTab({ agents }: { agents: Agent[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(agent => {
                const Icon = agentIcons[agent.id] || Bot
                const gradient = agentColors[agent.id] || 'from-gray-500 to-gray-600'
                return (
                    <div key={agent.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition">
                        <div className={`p-4 bg-gradient-to-r ${gradient} text-white`}>
                            <div className="flex items-center gap-3">
                                <Icon className="h-6 w-6" />
                                <div>
                                    <h3 className="font-bold text-lg">{agent.name}</h3>
                                    <p className="text-sm opacity-90">{agent.role}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 uppercase">Status</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    Ready
                                </span>
                            </div>
                            <div>
                                <span className="text-xs font-medium text-gray-500 uppercase">Categories</span>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {agent.categories.map(cat => (
                                        <span key={cat} className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[cat] || 'bg-gray-100 text-gray-600'}`}>
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm text-gray-500">{agent.skillsAvailable} skills available</span>
                                <div className="h-2 flex-1 max-w-[120px] ml-4 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
                                        style={{ width: `${Math.min(100, (agent.skillsAvailable / 3) * 1)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Workflows Tab ───────────────────────────────────────────────────

function WorkflowsTab({ workflows, agents: _agents }: { workflows: SystemData['workflows']; agents: Agent[] }) {
    const pipelineVisuals: Record<string, string[]> = {
        'Lead Generation Pipeline': ['ResearchAgent', 'LeadFinderAgent', 'WebsiteAuditAgent', 'MarketingAgent'],
        'Website Build Pipeline': ['ResearchAgent', 'DeveloperAgent', 'DevOpsAgent + SecurityAgent'],
        'Automation Pipeline': ['AutomationAgent', 'DevOpsAgent'],
    }

    return (
        <div className="space-y-4">
            {workflows.map(wf => (
                <div key={wf.name} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-5 border-b flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg">{wf.name}</h3>
                            <p className="text-sm text-gray-500">{wf.stages} stages · {wf.agents.length} agents</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
                            <Play className="h-4 w-4" />
                            Run
                        </button>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {(pipelineVisuals[wf.name] || wf.agents).map((step, i) => (
                                <div key={i} className="flex items-center gap-2 shrink-0">
                                    <div className="px-3 py-2 bg-gray-50 border rounded-lg text-sm font-medium text-gray-700 whitespace-nowrap">
                                        {step}
                                    </div>
                                    {i < (pipelineVisuals[wf.name] || wf.agents).length - 1 && (
                                        <svg className="h-4 w-6 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 16">
                                            <path d="M0 8h20m0 0l-5-5m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Tasks Tab ───────────────────────────────────────────────────────

function TasksTab({
    taskInput, setTaskInput, submitTask, taskLog, taskPayload, agents, executing,
}: {
    taskInput: string; setTaskInput: (v: string) => void; submitTask: () => void
    taskLog: { time: string; msg: string; level: string }[]
    taskPayload: any
    agents: Agent[]
    executing: boolean
}) {
    return (
        <div className="space-y-6">
            {/* Task Submission */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    Submit a Task
                </h3>
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        value={taskInput}
                        onChange={e => setTaskInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitTask()}
                        placeholder="e.g. Find labour supply agencies in Manchester..."
                        className="flex-1 px-4 py-3.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px] md:min-h-0"
                    />
                    <button
                        onClick={submitTask}
                        disabled={executing}
                        className={`touch-target px-6 text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${executing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        <Zap className={`h-4 w-4 ${executing ? 'animate-spin' : ''}`} />
                        {executing ? 'Executing...' : 'Execute'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Intent router automatically detects workflows. Try: &quot;Find restaurants in London&quot;
                </p>
                {/* Quick Presets */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    {[
                        { label: '🍕 Restaurants in Chicago', task: 'find restaurants in Chicago without websites' },
                        { label: '💇 Salons in Dallas', task: 'find salons in Dallas without websites' },
                        { label: '🏋️ Gyms in Houston', task: 'find gyms in Houston without websites' },
                        { label: '☕ Cafes in Miami', task: 'find cafes in Miami without websites' },
                    ].map(p => (
                        <button
                            key={p.label}
                            onClick={() => { setTaskInput(p.task); }}
                            disabled={executing}
                            className="py-3 px-3 bg-gray-50 border rounded-xl text-xs font-medium hover:bg-gray-100 transition active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Agent Selector */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold mb-4">Quick Launch</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {agents.map(agent => {
                        const Icon = agentIcons[agent.id] || Bot
                        return (
                            <button
                                key={agent.id}
                                onClick={() => setTaskInput(`[${agent.name}] `)}
                                className="touch-target flex items-center gap-2 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition text-left"
                            >
                                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                                <span className="text-sm font-medium truncate">{agent.name.replace('Agent', '')}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Task Activity */}
            {taskLog.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-6">
                    <h3 className="font-semibold mb-4">Recent Activity</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {taskLog.map((entry, i) => (
                            <div key={i} className={`flex items-start gap-3 p-2 rounded text-sm ${entry.level === 'success' ? 'bg-green-50'
                                : entry.level === 'error' ? 'bg-red-50'
                                    : entry.level === 'workflow' ? 'bg-yellow-50'
                                        : entry.level === 'stage' ? 'bg-cyan-50'
                                            : 'bg-gray-50'
                                }`}>
                                <span className="text-xs text-gray-400 pt-0.5 shrink-0">{entry.time}</span>
                                <span className={
                                    entry.level === 'success' ? 'text-green-700'
                                        : entry.level === 'error' ? 'text-red-700'
                                            : entry.level === 'workflow' ? 'text-yellow-700 font-semibold'
                                                : entry.level === 'stage' ? 'text-cyan-700'
                                                    : 'text-gray-700'
                                }>{entry.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results Output Box */}
            {taskPayload && (
                <div className="bg-white rounded-xl border shadow-sm p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="font-semibold mb-4 text-xl flex items-center gap-2">
                        <span className="p-1.5 bg-green-100 text-green-700 rounded-lg">✓</span>
                        Execution Result
                    </h3>

                    {taskPayload.type === 'table' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        {taskPayload.headers.map((h: string) => (
                                            <th key={h} className="p-3 font-medium text-gray-500">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {taskPayload.rows.map((row: any, i: number) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition">
                                            {taskPayload.headers.map((h: string) => (
                                                <td key={h} className="p-3">
                                                    {h === 'Status' ? (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{row[h]}</span>
                                                    ) : row[h]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {taskPayload.type === 'stats' && (
                        <div>
                            <p className="text-gray-500 mb-4">{taskPayload.title}</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {taskPayload.metrics.map((m: any, i: number) => (
                                    <div key={i} className="p-4 border rounded-xl bg-gray-50">
                                        <p className="text-sm font-medium text-gray-500">{m.label}</p>
                                        <p className="text-2xl font-bold mt-1 text-gray-900">{m.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {taskPayload.type === 'json' && (
                        <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                            <pre className="text-sm text-green-400 font-mono">
                                {JSON.stringify(taskPayload.data, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Logs Tab ────────────────────────────────────────────────────────

function LogsTab({ taskLog }: { taskLog: { time: string; msg: string; level: string }[] }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm mx-[-1rem] md:mx-0 overflow-hidden">
            <div className="p-4 border-b bg-gray-900 text-white flex justify-between items-center">
                <h3 className="font-mono text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    System Logs
                </h3>
            </div>
            <div className="bg-gray-950 p-4 min-h-[400px] max-h-[60vh] overflow-y-auto font-mono text-xs md:text-sm">
                {taskLog.length === 0 ? (
                    <div className="text-gray-500">
                        <p>{'>'} MAK OS Agent System v1.0</p>
                        <p>{'>'} 8 agents online. 978 skills loaded.</p>
                        <p>{'>'} Awaiting commands...</p>
                        <span className="inline-block w-2 h-4 bg-green-400 animate-pulse mt-2" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {taskLog.map((entry, i) => (
                            <div key={i} className={`flex flex-col md:flex-row md:items-start gap-1 md:gap-2 p-2 rounded ${entry.level === 'success' ? 'bg-green-950 border-green-900 border text-green-400'
                                : entry.level === 'error' ? 'bg-red-950 border-red-900 border text-red-400'
                                    : entry.level === 'workflow' ? 'bg-yellow-950/50 border-yellow-900 border text-yellow-300'
                                        : entry.level === 'stage' ? 'bg-cyan-950/30 text-cyan-400'
                                            : 'text-gray-300'
                                }`}>
                                <span className="text-gray-500 shrink-0 select-none">[{entry.time}]</span>
                                <span className="break-words">{entry.msg}</span>
                            </div>
                        ))}
                        <div className="pt-2">
                            <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
