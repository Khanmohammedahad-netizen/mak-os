import { useEffect, useState } from 'react';
import { leadsApi } from '../lib/api';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

interface Stats {
    totalLeads: number;
    activeAgents: number;
    pipelineValue: number;
    conversionRate: number;
}

export function CommandCenter() {
    const [stats, setStats] = useState<Stats>({
        totalLeads: 0,
        activeAgents: 0,
        pipelineValue: 0,
        conversionRate: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [leadsResponse] = await Promise.all([
                    leadsApi.list({ limit: 1000 }),
                ]);

                const leads = leadsResponse.data;
                const approvedLeads = leads.filter((l: any) => l.vetting_status === 'approved');

                setStats({
                    totalLeads: leads.length,
                    activeAgents: 4, // Placeholder
                    pipelineValue: approvedLeads.length * 5000, // Estimated value
                    conversionRate: leads.length > 0 ? (approvedLeads.length / leads.length) * 100 : 0,
                });
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-zinc-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Command Center</h1>
                <p className="text-zinc-400 mt-2">Real-time overview of your agency pipeline</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Leads"
                    value={stats.totalLeads}
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    title="Active Agents"
                    value={stats.activeAgents}
                    icon={Target}
                    color="purple"
                />
                <StatCard
                    title="Pipeline Value"
                    value={`$${(stats.pipelineValue / 1000).toFixed(0)}K`}
                    icon={DollarSign}
                    color="green"
                />
                <StatCard
                    title="Conversion Rate"
                    value={`${stats.conversionRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    color="orange"
                />
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ size: number; className?: string }>;
    trend?: string; // Optional now
    color: 'blue' | 'purple' | 'green' | 'orange';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30',
        orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-6 backdrop-blur-sm`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-zinc-400 font-medium">{title}</p>
                    <p className="text-3xl font-bold mt-2">{value}</p>
                </div>
                <Icon size={24} className="text-zinc-400" />
            </div>
        </div>
    );
}
