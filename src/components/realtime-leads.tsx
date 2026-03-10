'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import type { Database } from '@/types/database.types'
import { X, Bot } from 'lucide-react'

type Lead = Database['public']['Tables']['leads']['Row']

export function RealtimeLeads({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
    const { supabase, session } = useSupabase()

    useEffect(() => {
        if (!session) return

        const channel = supabase
            .channel('realtime_leads')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leads',
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setLeads((prev) => [payload.new as Lead, ...prev])
                    } else if (payload.eventType === 'UPDATE') {
                        setLeads((prev) =>
                            prev.map((lead) =>
                                lead.id === payload.new.id ? (payload.new as Lead) : lead
                            )
                        )
                    } else if (payload.eventType === 'DELETE') {
                        setLeads((prev) =>
                            prev.filter((lead) => lead.id !== payload.old.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, session])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !email) return
        setIsSubmitting(true)

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            })

            if (response.ok) {
                setName('')
                setEmail('')
            } else {
                console.error('Failed to create lead')
            }
        } catch (error) {
            console.error('Error creating lead:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Enrich a lead ────────────────────────────────────────────
    const handleEnrich = async (leadId: string) => {
        setActionLoading((prev) => ({ ...prev, [leadId]: 'enriching' }))
        try {
            const res = await fetch('/api/leads/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId }),
            })
            const data = await res.json()
            if (data.success) {
                setLeads((prev) =>
                    prev.map((l) =>
                        l.id === leadId
                            ? { ...l, email: data.enriched.email, status: 'enriched' }
                            : l
                    )
                )
            } else {
                alert(data.message || data.error || 'Enrichment failed')
            }
        } catch (err) {
            console.error('Enrich error:', err)
            alert('Enrichment failed. Check console.')
        } finally {
            setActionLoading((prev) => {
                const next = { ...prev }
                delete next[leadId]
                return next
            })
        }
    }

    // ─── Send email to a lead ─────────────────────────────────────
    const handleSendEmail = async (leadId: string) => {
        setActionLoading((prev) => ({ ...prev, [leadId]: 'emailing' }))
        try {
            const res = await fetch('/api/leads/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId }),
            })
            const data = await res.json()
            if (data.success) {
                setLeads((prev) =>
                    prev.map((l) =>
                        l.id === leadId ? { ...l, status: 'contacted' } : l
                    )
                )
            } else {
                alert(data.error || 'Email sending failed')
            }
        } catch (err) {
            console.error('Email error:', err)
            alert('Email failed. Check console.')
        } finally {
            setActionLoading((prev) => {
                const next = { ...prev }
                delete next[leadId]
                return next
            })
        }
    }

    // ─── Status badge color helper ────────────────────────────────
    const statusStyle = (status: string) => {
        switch (status) {
            case 'qualified':
                return 'bg-indigo-100 text-indigo-800 border-indigo-200'
            case 'enriched':
                return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'contacted':
            case 'emailed':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'phone_required':
                return 'bg-orange-100 text-orange-800 border-orange-200'
            case 'email_failed':
                return 'bg-red-100 text-red-800 border-red-200'
            case 'queued':
                return 'bg-purple-100 text-purple-800 border-purple-200'
            case 'new':
            default:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
    }

    // ─── Outreach metrics ──────────────────────────────────────────
    const metrics = {
        total: leads.length,
        contacted: leads.filter(l => l.status === 'contacted' || l.status === 'emailed').length,
        phoneRequired: leads.filter(l => l.status === 'phone_required').length,
        queued: leads.filter(l => l.status === 'queued').length,
        qualified: leads.filter(l => l.status === 'qualified' || l.status === 'new').length,
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-xl font-bold mb-4">Add New Lead</h2>
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 rounded-md border py-3 px-4 md:py-2 md:px-3 focus:outline-none focus:ring-2 focus:ring-primary min-h-[48px] md:min-h-0"
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 rounded-md border py-3 px-4 md:py-2 md:px-3 focus:outline-none focus:ring-2 focus:ring-primary min-h-[48px] md:min-h-0"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="touch-target bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-70 font-medium"
                    >
                        {isSubmitting ? 'Adding...' : 'Add Lead'}
                    </button>
                </form>
            </div>

            {/* ─── Outreach Metrics Bar ────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Leads</div>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold text-indigo-600">{metrics.qualified}</div>
                    <div className="text-xs text-gray-500 mt-1">Qualified</div>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{metrics.contacted}</div>
                    <div className="text-xs text-gray-500 mt-1">Contacted</div>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{metrics.phoneRequired}</div>
                    <div className="text-xs text-gray-500 mt-1">Phone Outreach</div>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{metrics.queued}</div>
                    <div className="text-xs text-gray-500 mt-1">Queued</div>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Outreach Pipeline</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 hidden md:inline">{leads.length} leads</span>
                        <span className="text-sm px-2 py-1 bg-green-100 text-green-800 rounded-full animate-pulse border border-green-200">
                            ● Live
                        </span>
                    </div>
                </div>

                {/* ─── Mobile Swipe Review Deck ─── */}
                <div className="md:hidden mb-2 p-4 bg-slate-50 border-b">
                    <h2 className="text-[15px] font-semibold text-slate-800 mb-3 flex items-center justify-between">
                        Needs Review
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
                            {leads.filter(l => l.status === 'new' || l.status === 'qualified').length} Pending
                        </span>
                    </h2>

                    {(() => {
                        const reviewLeads = leads.filter(l => l.status === 'new' || l.status === 'qualified')
                        if (reviewLeads.length === 0) {
                            return (
                                <div className="bg-slate-100/50 border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <p className="text-slate-600 font-medium">Inbox Zero!</p>
                                    <p className="text-sm text-slate-400 mt-1">All leads have been processed.</p>
                                </div>
                            )
                        }

                        const topLead = reviewLeads[0]
                        const isProcessing = !!actionLoading[topLead.id]

                        return (
                            <div className="relative w-full bg-white rounded-2xl border shadow-sm p-5 transition-all">
                                <div className="absolute top-4 right-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {topLead.source || 'General'}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 pr-16 leading-tight mb-1">{topLead.company}</h3>
                                <p className="text-sm text-slate-500 mb-4">{topLead.city || 'Unknown Location'} • {topLead.category || 'Business'}</p>

                                <div className="space-y-2 mb-6 text-sm">
                                    {topLead.website && (
                                        <div className="flex items-center gap-2 text-sky-600 bg-sky-50 px-3 py-2 rounded-lg truncate">
                                            <span className="text-sky-400 font-bold truncate">{topLead.website}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                                        {topLead.email || <span className="text-slate-400 italic">No email found</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        onClick={async () => {
                                            setActionLoading(p => ({ ...p, [topLead.id]: 'rejecting' }))
                                            await supabase.from('leads').update({ status: 'rejected' }).eq('id', topLead.id)
                                            setActionLoading(p => { const n = { ...p }; delete n[topLead.id]; return n })
                                        }}
                                        disabled={isProcessing}
                                        className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold tracking-wide active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <X className="w-4 h-4" /> Reject
                                    </button>

                                    <button
                                        onClick={async () => {
                                            if (topLead.email) {
                                                handleSendEmail(topLead.id)
                                            } else {
                                                handleEnrich(topLead.id)
                                            }
                                        }}
                                        disabled={isProcessing}
                                        className="py-3 rounded-xl bg-slate-900 text-white font-bold tracking-wide active:scale-95 transition-all text-sm shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Bot className="w-4 h-4" />
                                        {isProcessing ? 'Working...' : (topLead.email ? 'Queue Email' : 'Auto Enrich')}
                                    </button>
                                </div>
                            </div>
                        )
                    })()}
                </div>

                {/* ─── Mobile View: Card List ─── */}
                <div className="md:hidden flex flex-col divide-y">
                    {leads.filter(l => l.status !== 'new' && l.status !== 'qualified').map((lead) => {
                        const loading = actionLoading[lead.id]
                        return (
                            <div key={lead.id} className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{lead.company}</h3>
                                        <p className="text-sm text-gray-500">{lead.city || 'Unknown City'}</p>
                                    </div>
                                    <span className={`px-2 py-1 flex-shrink-0 rounded-full text-xs font-medium border ${statusStyle(lead.status)}`}>
                                        {lead.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-1">
                                    <div className="truncate">📧 {lead.email || '—'}</div>
                                    <div className="truncate">📞 {lead.phone || '—'}</div>
                                    <div className="flex gap-2 items-center">
                                        Score:
                                        {lead.priority_score != null ? (
                                            <span className={`font-mono font-bold ${lead.priority_score >= 70 ? 'text-green-600' : lead.priority_score >= 40 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                                {lead.priority_score}
                                            </span>
                                        ) : '—'}
                                    </div>
                                    <div className="text-right text-xs text-gray-500">
                                        {lead.contacted_at ? new Date(lead.contacted_at).toLocaleDateString() : ''}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 pt-3 border-t">
                                    {!lead.email && !['contacted', 'emailed', 'phone_required'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleEnrich(lead.id)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50 text-sm"
                                        >
                                            {loading === 'enriching' ? '⏳ Enriching' : '🔍 Enrich'}
                                        </button>
                                    )}
                                    {lead.email && !['contacted', 'emailed'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleSendEmail(lead.id)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50 text-sm"
                                        >
                                            {loading === 'emailing' ? '⏳ Sending' : '📧 Send'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {leads.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No leads found. Run a generation task!
                        </div>
                    )}
                </div>

                {/* ─── Desktop View: Data Table ─── */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b text-sm">
                                <th className="p-4 font-medium text-gray-500">Name</th>
                                <th className="p-4 font-medium text-gray-500">Email</th>
                                <th className="p-4 font-medium text-gray-500">Phone</th>
                                <th className="p-4 font-medium text-gray-500">City</th>
                                <th className="p-4 font-medium text-gray-500">Priority</th>
                                <th className="p-4 font-medium text-gray-500">Status</th>
                                <th className="p-4 font-medium text-gray-500">Contacted</th>
                                <th className="p-4 font-medium text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map((lead) => {
                                const loading = actionLoading[lead.id]
                                return (
                                    <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                                        <td className="p-4 font-medium">{lead.company}</td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {lead.email || <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {lead.phone || <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {lead.city || <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="p-4 text-sm">
                                            {lead.priority_score != null ? (
                                                <span className={`font-mono font-bold ${lead.priority_score >= 70 ? 'text-green-600' :
                                                    lead.priority_score >= 40 ? 'text-yellow-600' : 'text-gray-400'
                                                    }`}>
                                                    {lead.priority_score}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusStyle(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {lead.contacted_at
                                                ? new Date(lead.contacted_at).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                {/* Enrich button */}
                                                {!lead.email && !['contacted', 'emailed', 'phone_required'].includes(lead.status) && (
                                                    <button
                                                        onClick={() => handleEnrich(lead.id)}
                                                        disabled={!!loading}
                                                        className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50"
                                                    >
                                                        {loading === 'enriching' ? '⏳ Enriching...' : '🔍 Enrich'}
                                                    </button>
                                                )}

                                                {/* Send Email button */}
                                                {lead.email && !['contacted', 'emailed'].includes(lead.status) && (
                                                    <button
                                                        onClick={() => handleSendEmail(lead.id)}
                                                        disabled={!!loading}
                                                        className="text-xs px-3 py-1.5 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
                                                    >
                                                        {loading === 'emailing' ? '⏳ Sending...' : '📧 Send Email'}
                                                    </button>
                                                )}

                                                {/* Contacted badge */}
                                                {(lead.status === 'contacted' || lead.status === 'emailed') && (
                                                    <span className="text-xs px-3 py-1.5 text-green-600">✅ Contacted</span>
                                                )}

                                                {/* Phone required badge */}
                                                {lead.status === 'phone_required' && (
                                                    <span className="text-xs px-3 py-1.5 text-orange-600">📞 Call Needed</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500">
                                        No leads found. Run a lead generation task to populate this pipeline!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
