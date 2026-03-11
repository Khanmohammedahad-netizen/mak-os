'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import {
    Phone,
    Play,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const VOICES = [
    { id: 'maya', name: 'Maya (Natural Female)' },
    { id: 'june', name: 'June (Warm Female)' },
    { id: 'brady', name: 'Brady (Confident Male)' },
    { id: 'paige', name: 'Paige (Friendly Female)' },
    { id: 'karl', name: 'Karl (Professional Male)' },
]

export default function CallsPage() {
    const { supabase } = useSupabase()
    const [phone, setPhone] = useState('')
    const [selectedVoice, setSelectedVoice] = useState('maya')
    const [script, setScript] = useState(`Hi, is this the owner of {{business_name}}?\n\nMy name is Mohammed. I'm a web designer and I was looking up local businesses in {{city}} — I noticed you don't have a website yet.\n\nI put together a free preview of what a new site could look like for you. Want me to text you the link?`)
    const [status, setStatus] = useState<string | null>(null)
    const [isCalling, setIsCalling] = useState(false)
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)

    useEffect(() => {
        fetchLogs()
        const channel = supabase
            .channel('phone_logs_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'phone_outreach_log' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setLogs(prev => [payload.new, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setLogs(prev => prev.map(log => log.id === payload.new.id ? payload.new : log))
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    const fetchLogs = async () => {
        setLoadingLogs(true)
        const { data } = await supabase
            .from('phone_outreach_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        setLogs(data || [])
        setLoadingLogs(false)
    }

    const handleTestCall = async () => {
        if (!phone || isCalling) return

        setIsCalling(true)
        setStatus('Dialing...')

        try {
            const res = await fetch('/api/mobile/test-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    voice: selectedVoice,
                    script
                })
            })

            const data = await res.json()
            if (data.success) {
                setStatus('Connected')
            } else {
                setStatus('Failed: ' + (data.error || 'Unknown error'))
            }
        } catch (err) {
            setStatus('Error initiating call')
        } finally {
            setIsCalling(false)
        }
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto pb-24 md:pb-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Call Control Center</h1>
                <p className="text-slate-500">Manage AI voice outreach and manual test calls directly from your browser.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* 1. Test Call Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-800">
                        <div className="bg-slate-900 p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Phone className="h-5 w-5 text-emerald-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider text-sm">Test Call Panel</h2>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Target Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="+1 555 000 0000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Voice Selection</label>
                                <select
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-900 appearance-none focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                                >
                                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Call Script</label>
                                <textarea
                                    rows={6}
                                    value={script}
                                    onChange={(e) => setScript(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                                <p className="text-[10px] text-slate-400 italic">Variables like business name and city will be injected from lead data.</p>
                            </div>

                            <button
                                onClick={handleTestCall}
                                disabled={!phone || isCalling}
                                className={cn(
                                    "w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg transition-all active:scale-95 shadow-lg",
                                    isCalling ? "bg-slate-100 text-slate-400" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200"
                                )}
                            >
                                {isCalling ? <Clock className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6" />}
                                {isCalling ? 'Dialing...' : 'Initiate Call Now'}
                            </button>

                            {status && (
                                <div className={cn(
                                    "p-3 rounded-xl border text-center text-sm font-medium animate-in fade-in slide-in-from-top-2",
                                    status.includes('Failed') ? "bg-red-50 border-red-100 text-red-600" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                                )}>
                                    {status}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Live Call Log Feed */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Live Call Activity</h2>
                        </div>
                        <button onClick={fetchLogs} className="text-xs font-bold text-sky-500 hover:text-sky-600">Refresh</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 min-h-[400px] overflow-hidden flex flex-col">
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                            {loadingLogs ? (
                                <div className="p-12 text-center text-slate-400">Loading call logs...</div>
                            ) : logs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                                    <Phone className="h-12 w-12 opacity-20" />
                                    <span>No calls logged yet. Start a test call!</span>
                                </div>
                            ) : logs.map(log => (
                                <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm",
                                                log.call_outcome === 'answered_interested' ? "bg-emerald-50 border-emerald-100" :
                                                    log.send_status === 'failed' ? "bg-red-50 border-red-100" :
                                                        "bg-white border-slate-200"
                                            )}>
                                                {log.send_status === 'failed' ? <XCircle className="h-6 w-6 text-red-500" /> :
                                                    log.call_outcome ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> :
                                                        <Clock className="h-6 w-6 text-sky-500 animate-pulse" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-900 leading-tight">{log.business_name}</h3>
                                                    {log.channel === 'ai_call' && <span className="bg-sky-100 text-sky-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">AI Call</span>}
                                                </div>
                                                <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono">{log.phone_number?.slice(0, 10)}****</span>
                                                    <span>•</span>
                                                    <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className={cn(
                                                "px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border",
                                                log.call_outcome === 'voicemail' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                    log.call_outcome === 'answered_interested' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                        log.call_outcome === 'no_answer' ? "bg-slate-100 text-slate-600 border-slate-200" :
                                                            log.send_status === 'sent' ? "bg-sky-100 text-sky-700 border-sky-200" :
                                                                "bg-slate-100 text-slate-500 border-slate-200"
                                            )}>
                                                {log.call_outcome?.replace('_', ' ') || log.send_status}
                                            </div>
                                            {log.call_duration_seconds && (
                                                <span className="text-[10px] font-bold text-slate-400">{log.call_duration_seconds}s call</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100/50 hidden group-hover:block animate-in fade-in slide-in-from-top-2">
                                        <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">
                                            "{log.message_body}"
                                        </p>
                                        <div className="flex justify-between items-center mt-3">
                                            <span className="text-[10px] text-slate-400 font-medium">Recorded at {new Date(log.created_at).toLocaleDateString()}</span>
                                            <button className="text-sky-500 font-bold text-xs flex items-center gap-1">Details <ChevronRight className="h-3 w-3" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
