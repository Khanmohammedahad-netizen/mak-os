import { useState, useEffect } from 'react';
import { agentsApi } from '../lib/api';
import { Play, Clock, CheckCircle, XCircle } from 'lucide-react';

interface AgentLog {
    id: number;
    agent_name: string;
    start_time: string;
    end_time: string | null;
    status: string;
    leads_processed: number;
    error_message: string | null;
}

const AGENTS = [
    {
        id: 'discovery',
        name: 'Discovery Agent',
        description: 'Ingest leads from external sources',
        color: 'blue'
    },
    {
        id: 'vetting',
        name: 'Vetting Agent',
        description: 'Apply business rules to filter leads',
        color: 'purple'
    },
    {
        id: 'tech_debt',
        name: 'Tech Debt Agent',
        description: 'Trigger website analysis workflows',
        color: 'green'
    },
];

export function Agents() {
    const [logs, setLogs] = useState<AgentLog[]>([]);
    const [executing, setExecuting] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const response = await agentsApi.getLogs({ limit: 20 });
            setLogs(response.data);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    const executeAgent = async (agentId: string) => {
        setExecuting(agentId);

        try {
            await agentsApi.execute(agentId);

            // Wait a bit then refresh logs
            setTimeout(() => {
                fetchLogs();
                setExecuting(null);
            }, 2000);
        } catch (error) {
            console.error('Failed to execute agent:', error);
            setExecuting(null);
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Agent Control</h1>
                <p className="text-zinc-400 mt-2">Manually trigger agents or view execution history</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {AGENTS.map(agent => (
                    <div
                        key={agent.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-6"
                    >
                        <h3 className="font-bold text-lg mb-2">{agent.name}</h3>
                        <p className="text-sm text-zinc-400 mb-4">{agent.description}</p>

                        <button
                            onClick={() => executeAgent(agent.id)}
                            disabled={executing === agent.id}
                            className={`
                w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                font-medium transition-all
                ${executing === agent.id
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }
              `}
                        >
                            {executing === agent.id ? (
                                <>
                                    <Clock size={16} className="animate-spin" />
                                    Executing...
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    Run Agent
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="p-4 border-b border-zinc-800">
                    <h2 className="font-bold text-lg">Execution History</h2>
                </div>

                <div className="divide-y divide-zinc-800">
                    {logs.length === 0 && (
                        <div className="p-8 text-center text-zinc-500">
                            No execution logs yet. Run an agent to get started.
                        </div>
                    )}

                    {logs.map(log => (
                        <div key={log.id} className="p-4 hover:bg-zinc-900/50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-semibold">{log.agent_name}</span>
                                        <StatusBadge status={log.status} />
                                    </div>

                                    <div className="text-sm text-zinc-400">
                                        <div className="flex items-center gap-4">
                                            <span>
                                                Started: {new Date(log.start_time).toLocaleString()}
                                            </span>
                                            {log.end_time && (
                                                <span>
                                                    Duration: {getDuration(log.start_time, log.end_time)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1">
                                            Leads processed: <span className="text-white">{log.leads_processed}</span>
                                        </div>

                                        {log.error_message && (
                                            <div className="mt-2 text-red-400 text-xs bg-red-500/10 p-2 rounded">
                                                {log.error_message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        success: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10' },
        failed: { icon: XCircle, color: 'text-red-400 bg-red-500/10' },
        partial: { icon: Clock, color: 'text-yellow-400 bg-yellow-500/10' },
        running: { icon: Clock, color: 'text-blue-400 bg-blue-500/10' },
    }[status] || { icon: Clock, color: 'text-zinc-400 bg-zinc-500/10' };

    const Icon = config.icon;

    return (
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${config.color}`}>
            <Icon size={12} />
            {status}
        </span>
    );
}

function getDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
}
