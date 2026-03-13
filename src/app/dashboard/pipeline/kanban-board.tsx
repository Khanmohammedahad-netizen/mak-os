'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, MessageSquare, Phone, FileText, CheckCircle2, XCircle } from 'lucide-react'

// Define the shape of our Opportunity
export type Opportunity = {
    id: string
    lead_id: string | null
    business_name: string
    contact_email: string | null
    contact_phone: string | null
    city: string | null
    reply_body: string | null
    reply_received_at: string | null
    status: 'new_reply' | 'follow_up_sent' | 'call_scheduled' | 'proposal_sent' | 'negotiating' | 'closed_won' | 'closed_lost'
    deal_value_estimate: number | null
    notes: string | null
    next_action: string | null
    next_action_due: string | null
    created_at: string
    updated_at: string
}

export const COLUMNS = [
    { id: 'new_reply', title: 'NEW REPLY', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { id: 'follow_up_sent', title: 'FOLLOW UP', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    { id: 'call_scheduled', title: 'CALL BOOKED', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    { id: 'proposal_sent', title: 'PROPOSAL', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    { id: 'negotiating', title: 'NEGOTIATING', color: 'bg-orange-50 border-orange-200 text-orange-800' },
    { id: 'closed', title: 'CLOSED', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
]

export function KanbanBoard({ initialOpportunities }: { initialOpportunities: Opportunity[] }) {
    const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities)
    const [isUpdating, setIsUpdating] = useState(false)
    const supabase = createSupabaseBrowserClient()

    const updateStatus = async (id: string, newStatus: string) => {
        setIsUpdating(true)
        try {
            await supabase.from('opportunities').update({ status: newStatus }).eq('id', id)
            setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: newStatus as Opportunity['status'] } : o))
        } catch (error) {
            console.error('Failed to update status', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const getColumnOpps = (colId: string) => {
        if (colId === 'closed') {
            return opportunities.filter(o => o.status === 'closed_won' || o.status === 'closed_lost')
        }
        return opportunities.filter(o => o.status === colId)
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-8 h-full min-h-[500px]">
            {COLUMNS.map(column => (
                <div key={column.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200 h-full">
                    {/* Column Header */}
                    <div className={`px-4 py-3 border-b rounded-t-xl text-xs font-bold tracking-wider ${column.color}`}>
                        {column.title} <span className="ml-2 opacity-60 font-medium">{getColumnOpps(column.id).length}</span>
                    </div>

                    {/* Column Body / Cards */}
                    <div className="p-3 flex-1 overflow-y-auto space-y-3">
                        {getColumnOpps(column.id).map(opp => (
                            <div key={opp.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-blue-400 transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-sm">{opp.business_name}</h3>
                                        <p className="text-xs text-slate-500">{opp.city}</p>
                                    </div>
                                    <button className="text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </div>

                                {opp.reply_body && (
                                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic line-clamp-3 mb-3">
                                        "{opp.reply_body}"
                                    </div>
                                )}

                                <div className="text-[11px] text-slate-400 mb-4 font-medium flex items-center justify-between">
                                    <span>
                                        {opp.reply_received_at
                                            ? formatDistanceToNow(new Date(opp.reply_received_at), { addSuffix: true })
                                            : formatDistanceToNow(new Date(opp.created_at), { addSuffix: true })}
                                    </span>
                                    {opp.deal_value_estimate && (
                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                                            ${opp.deal_value_estimate.toLocaleString()}
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-slate-100">
                                    {opp.status === 'new_reply' && (
                                        <>
                                            <button onClick={() => updateStatus(opp.id, 'follow_up_sent')} className="text-xs px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium flex items-center flex-1 justify-center">
                                                <MessageSquare className="w-3 h-3 mr-1" /> Respond
                                            </button>
                                            <button onClick={() => updateStatus(opp.id, 'call_scheduled')} className="text-xs px-2 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded font-medium flex items-center flex-1 justify-center border border-slate-200">
                                                <Phone className="w-3 h-3 mr-1" /> Call
                                            </button>
                                        </>
                                    )}

                                    {(opp.status === 'follow_up_sent' || opp.status === 'call_scheduled') && (
                                        <>
                                            <button onClick={() => updateStatus(opp.id, 'proposal_sent')} className="text-xs px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-medium flex items-center flex-1 justify-center">
                                                <FileText className="w-3 h-3 mr-1" /> Proposal
                                            </button>
                                            <button onClick={() => updateStatus(opp.id, 'call_scheduled')} className="text-xs px-2 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded font-medium flex items-center flex-1 justify-center border border-slate-200">
                                                <Phone className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}

                                    {opp.status === 'proposal_sent' || opp.status === 'negotiating' ? (
                                        <>
                                            <button onClick={() => updateStatus(opp.id, 'closed_won')} className="text-xs px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium flex items-center flex-1 justify-center border border-emerald-200">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Won
                                            </button>
                                            <button onClick={() => updateStatus(opp.id, 'closed_lost')} className="text-xs px-2 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-medium flex items-center flex-1 justify-center border border-rose-200">
                                                <XCircle className="w-3 h-3 mr-1" /> Lost
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {getColumnOpps(column.id).length === 0 && (
                            <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400 font-medium">
                                No opportunities
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
