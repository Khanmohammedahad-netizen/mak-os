import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Target, MessageCircle, Activity, DollarSign, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = createSupabaseServerClient()

    try {
        // Fetch Metrics with basic error handling
        const { count: totalLeads, error: leadsErr } = await supabase.from('leads').select('*', { count: 'exact', head: true })
        
        if (leadsErr) throw new Error(leadsErr.message)

        const { count: emailOutreach } = await supabase.from('outreach_log').select('*', { count: 'exact', head: true }).eq('sequence_status', 'active').eq('channel', 'email')
        const { count: whatsappOutreach } = await supabase.from('outreach_log').select('*', { count: 'exact', head: true }).eq('sequence_status', 'active').eq('channel', 'whatsapp')
        const { count: totalReplies } = await supabase.from('replies').select('*', { count: 'exact', head: true })

        // Calculate API Costs
        const { data: costs } = await supabase.from('api_cost_log').select('cost')
        const totalCost = costs?.reduce((acc: number, row: any) => acc + (row.cost || 0), 0) || 0

        // Fetch Phone Pipeline Metrics
        const { count: activePhoneSequences } = await supabase.from('phone_sequences_due').select('*', { count: 'exact', head: true })

        return (
            <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Weekly Metrics</h1>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6">

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
                            <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">Email Sequences</h3>
                            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{emailOutreach || 0}</p>
                    </div>

                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">WhatsApp</h3>
                            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{whatsappOutreach || 0}</p>
                    </div>

                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase">Phone Sequences</h3>
                            <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-orange-600" />
                            </div>
                        </div>
                        <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{activePhoneSequences || 0}</p>
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
    } catch (e: any) {
        // Render a configuration warning instead of a 500 error page
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-4 text-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Database Connection Failed</h1>
                <p className="text-slate-600 max-w-md mx-auto">
                    The dashboard could not reachable your Supabase project. Please verify that <code className="px-1 py-0.5 bg-slate-100 rounded text-red-500">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="px-1 py-0.5 bg-slate-100 rounded text-red-500">SUPABASE_SERVICE_ROLE_KEY</code> are correctly set in your Render environment variables.
                </p>
                <div className="mt-4 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-left text-sm font-mono text-slate-500">
                    Error Detail: {e.message || 'Unknown runtime error'}
                </div>
            </div>
        )
    }
}
