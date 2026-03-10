import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Target, MessageCircle, Activity, DollarSign } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = createSupabaseServerClient()

    // Fetch Metrics
    const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const { count: activeOutreach } = await supabase.from('outreach_log').select('*', { count: 'exact', head: true }).eq('sequence_status', 'active')
    const { count: totalReplies } = await supabase.from('replies').select('*', { count: 'exact', head: true })

    // Calculate API Costs
    const { data: costs } = await supabase.from('api_cost_log').select('cost')
    const totalCost = costs?.reduce((acc: number, row: any) => acc + (row.cost || 0), 0) || 0

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Weekly Metrics</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">Total Leads</h3>
                        <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                            <Target className="w-4 h-4 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{totalLeads || 0}</p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">Sequences</h3>
                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{activeOutreach || 0}</p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">Responses</h3>
                        <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{totalReplies || 0}</p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">AI Costs</h3>
                        <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-amber-600" />
                        </div>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">${totalCost.toFixed(2)}</p>
                </div>

            </div>
        </div>
    )
}
