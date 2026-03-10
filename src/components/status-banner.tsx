'use client'

import { useEffect, useState } from 'react'
import { Activity, Clock } from 'lucide-react'

interface SchedulerStatus {
    running: boolean
    isExecuting: boolean
    nextCity: string
    lastRunAt: string | null
}

export function StatusBanner() {
    const [status, setStatus] = useState<SchedulerStatus | null>(null)

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/mobile/auto-run')
            const data = await res.json()
            setStatus(data)
        } catch (err) {
            console.error('[StatusBanner] Error fetching status:', err)
        }
    }

    useEffect(() => {
        fetchStatus()
        // Poll every 60 seconds (strictly read-only)
        const intervalId = setInterval(fetchStatus, 60000)
        return () => clearInterval(intervalId)
    }, [])

    if (!status) return null

    if (status.isExecuting) {
        return (
            <div className="w-full bg-blue-500 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 animate-in fade-in sticky top-0 z-50">
                <Activity className="h-4 w-4 animate-pulse" />
                Pipeline Running — {status.nextCity} — System Online
            </div>
        )
    }

    if (status.running) {
        return (
            <div className="w-full bg-emerald-500 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 animate-in fade-in sticky top-0 z-50">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                System Online — Auto-run ACTIVE — Next run: Tomorrow 7:00 AM CST
            </div>
        )
    }

    return (
        <div className="w-full bg-red-500 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 animate-in fade-in sticky top-0 z-50">
            <Clock className="h-4 w-4" />
            System Online — Auto-run PAUSED — Toggle to resume
        </div>
    )
}
