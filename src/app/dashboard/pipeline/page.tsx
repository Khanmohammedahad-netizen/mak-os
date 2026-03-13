import { createSupabaseServerClient } from '@/lib/supabase/server'
import { KanbanBoard } from './kanban-board'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
    const supabase = createSupabaseServerClient()

    // Fetch funnel metrics
    const { data: funnel } = await supabase.from('sales_funnel').select('*').single()

    // Fetch opportunities
    const { data: opportunities } = await supabase
        .from('opportunities')
        .select('*')
        .order('updated_at', { ascending: false })

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto h-full flex flex-col">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Sales Pipeline</h1>

            {/* Funnel Metrics Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between overflow-x-auto gap-8 whitespace-nowrap">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Replies</span>
                    <span className="text-2xl font-black text-slate-900">{funnel?.new_replies || 0}</span>
                </div>
                <div className="text-slate-300">→</div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calls Booked</span>
                    <span className="text-2xl font-black text-slate-900">{funnel?.calls_booked || 0}</span>
                </div>
                <div className="text-slate-300">→</div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proposals</span>
                    <span className="text-2xl font-black text-slate-900">{funnel?.proposals_sent || 0}</span>
                </div>
                <div className="text-slate-300">→</div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closed Won</span>
                    <span className="text-2xl font-black text-emerald-600">{funnel?.deals_closed || 0}</span>
                </div>

                <div className="flex-1 min-w-[20px]"></div>

                <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Close Rate</span>
                    <span className="text-xl font-bold text-slate-700">{funnel?.close_rate_pct || 0}%</span>
                </div>
                <div className="flex flex-col text-right pr-4 border-r border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue</span>
                    <span className="text-2xl font-black text-slate-900">${(funnel?.revenue || 0).toLocaleString()}</span>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 mt-4">
                <KanbanBoard initialOpportunities={opportunities || []} />
            </div>
        </div>
    )
}
