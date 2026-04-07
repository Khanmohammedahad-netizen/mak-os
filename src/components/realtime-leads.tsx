'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import type { Database } from '@/types/database.types'
import { X, Bot, Phone, Play, Clock } from 'lucide-react'

type Lead = Database['public']['Tables']['leads']['Row']

export function RealtimeLeads({ initialLeads, operatorName }: { initialLeads: Lead[], operatorName: string }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
    const [selectedLeadForCall, setSelectedLeadForCall] = useState<Lead | null>(null)
    const [customScript, setCustomScript] = useState('')
    const [isInitiatingCall, setIsInitiatingCall] = useState(false)
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
                            ? { ...l, email: data.enriched?.email || l.email, status: data.status || 'enriched' }
                            : l
                    )
                )
            }
        } catch (err) {
            console.error('Enrich error:', err)
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

    // ─── Call Script Generation ──────────────────────────────────
    const generatePersonalizedScript = (lead: Lead) => {
        const currentLead = lead as any
        const issue = {
            'A': `${lead.company} doesn't have a website, so customers searching in ${lead.city || 'your area'} can't find you online`,
            'B': `${lead.company}'s website doesn't load correctly on phones, which is how most people search today`,
            'C': `${lead.company} has a great social presence but no website, so you're invisible on Google in ${lead.city || 'your area'}`
        }[currentLead.website_category as 'A' | 'B' | 'C'] || `${lead.company}'s online presence could be improved to capture more local traffic`

        return `Hi, is this the owner of ${lead.company}?\n\nMy name is ${operatorName}. I'm a web designer and I was looking up ${lead.category || 'local'} businesses in ${lead.city || 'your area'} — I noticed ${issue}.\n\nI put together a completely free preview of what a new site could look like for you. No pitch, just want to know if you'd like me to text you the link.\n\nWould that be alright?`
    }

    const handleOpenCallModal = (lead: Lead) => {
        setSelectedLeadForCall(lead)
        setCustomScript(generatePersonalizedScript(lead))
    }

    const handleInitiateCall = async () => {
        if (!selectedLeadForCall || isInitiatingCall) return
        setIsInitiatingCall(true)

        try {
            const res = await fetch('/api/mobile/test-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: selectedLeadForCall.phone,
                    script: customScript,
                    lead_id: selectedLeadForCall.id,
                    voice: 'maya'
                })
            })

            if (res.ok) {
                setLeads(prev => prev.map(l => l.id === selectedLeadForCall.id ? { ...l, status: 'contacted' } : l))
                setSelectedLeadForCall(null)
            } else {
                const err = await res.json()
                alert(err.error || 'Failed to initiate call')
            }
        } catch (err) {
            console.error('Call error:', err)
            alert('Call initiation failed')
        } finally {
            setIsInitiatingCall(false)
        }
    }

    // ─── Send WhatsApp to a lead ──────────────────────────────────
    const handleSendWhatsApp = async (leadId: string) => {
        setActionLoading((prev) => ({ ...prev, [leadId]: 'whatsapp' }))
        try {
            const res = await fetch('/api/leads/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId }),
            })
            const data = await res.json()
            if (data.success) {
                setLeads((prev) =>
                    prev.map((l) =>
                        l.id === leadId ? { ...l, status: 'wa_sent' } : l
                    )
                )
            } else {
                alert(data.error || 'WhatsApp failed')
            }
        } catch (err) {
            console.error('WhatsApp error:', err)
            alert('WhatsApp failed. Check console.')
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
            case 'wa_sent':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'phone_required':
                return 'bg-orange-100 text-orange-800 border-orange-200'
            case 'no_email':
            case 'bad_data':
                return 'bg-red-50 text-red-700 border-red-100'
            case 'unreachable':
                return 'bg-gray-100 text-gray-800 border-gray-200'
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
        contacted: leads.filter(l => l.status === 'contacted' || l.status === 'emailed' || l.status === 'wa_sent').length,
        phoneRequired: leads.filter(l => l.status === 'phone_required' || l.status === 'wa_sent').length,
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
                    <div className="text-xs text-gray-500 mt-1">Phone/WA Outreach</div>
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

                {/* ─── Mobile View: Card List ─── */}
                <div className="md:hidden flex flex-col divide-y">
                    {leads.map((lead) => {
                        const loading = actionLoading[lead.id]
                        return (
                            <div key={lead.id} className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{lead.company}</h3>
                                        <p className="text-sm text-gray-500">{lead.city || 'Unknown City'}</p>
                                    </div>
                                    <span className={`px-2 py-1 flex-shrink-0 rounded-full text-xs font-medium border ${statusStyle(lead.status)}`}>
                                        {lead.status === 'wa_sent' ? 'contacted (wa)' : lead.status}
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
                                    {!lead.email && !['contacted', 'emailed', 'wa_sent', 'bad_data', 'unreachable'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleEnrich(lead.id)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50 text-sm"
                                        >
                                            {loading === 'enriching' ? '⏳ Working' : '🔍 Enrich'}
                                        </button>
                                    )}
                                    {lead.phone && !lead.email && !['contacted', 'wa_sent'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleSendWhatsApp(lead.id)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                        >
                                            {loading === 'whatsapp' ? '⏳ Sending' : '📲 WhatsApp'}
                                        </button>
                                    )}
                                    {lead.phone && !['contacted', 'wa_sent'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleOpenCallModal(lead)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                        >
                                            <Phone className="w-4 h-4" /> Call
                                        </button>
                                    )}
                                    {lead.email && !['contacted', 'emailed'].includes(lead.status) && (
                                        <button
                                            onClick={() => handleSendEmail(lead.id)}
                                            disabled={!!loading}
                                            className="touch-target flex-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50 text-sm"
                                        >
                                            {loading === 'emailing' ? '⏳ Sending' : '📧 Email'}
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
                                                {lead.status === 'wa_sent' ? 'contacted (wa)' : lead.status}
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
                                                {!lead.email && !['contacted', 'emailed', 'wa_sent', 'bad_data', 'unreachable'].includes(lead.status) && (
                                                    <button
                                                        onClick={() => handleEnrich(lead.id)}
                                                        disabled={!!loading}
                                                        className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50"
                                                    >
                                                        {loading === 'enriching' ? '⏳ Working...' : '🔍 Enrich'}
                                                    </button>
                                                )}

                                                {/* Send WhatsApp button */}
                                                {lead.phone && !lead.email && !['contacted', 'wa_sent'].includes(lead.status) && (
                                                    <button
                                                        onClick={() => handleSendWhatsApp(lead.id)}
                                                        disabled={!!loading}
                                                        className="text-xs px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
                                                    >
                                                        {loading === 'whatsapp' ? '⏳ Sending...' : '📲 Send WhatsApp'}
                                                    </button>
                                                )}

                                                {lead.status === 'wa_sent' && (
                                                    <span className="text-xs px-3 py-1.5 text-emerald-600 font-semibold">✅ Contacted (WA)</span>
                                                )}
                                                
                                                {lead.status === 'bad_data' && (
                                                    <span className="text-xs px-3 py-1.5 text-red-400">⚠️ Bad Phone</span>
                                                )}
                                                
                                                {lead.status === 'unreachable' && (
                                                    <span className="text-xs px-3 py-1.5 text-gray-400">🔇 Unreachable</span>
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
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Call Preview Modal ─── */}
            {selectedLeadForCall && (
                <>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" onClick={() => setSelectedLeadForCall(null)} />
                    <div className="fixed left-0 right-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[101] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 md:w-[480px] animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <Phone className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900">Initiate AI Call</h3>
                                    <p className="text-sm text-slate-500 font-medium">To: {selectedLeadForCall.company}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedLeadForCall(null)} className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-700">
                                    Target Number: {selectedLeadForCall.phone?.replace(/(\d{3})(\d{3})(\d{4})/, '($1) ***-$4')}
                                </div>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Review Script</label>
                                <textarea
                                    rows={8}
                                    value={customScript}
                                    onChange={(e) => setCustomScript(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-700 text-[15px] leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-all shadow-inner"
                                />
                            </div>

                            <button
                                onClick={handleInitiateCall}
                                disabled={isInitiatingCall}
                                className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200 font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isInitiatingCall ? <Clock className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6" />}
                                {isInitiatingCall ? 'Connecting...' : 'Confirm & Call Now'}
                            </button>

                            <p className="text-center text-xs text-slate-400 font-medium px-4">
                                Once confirmed, Bland.ai will dial immediately. The call will be logged under {operatorName}'s session.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
