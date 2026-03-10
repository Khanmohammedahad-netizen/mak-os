'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResyncButtonProps {
    repoId: string
    githubRepoId: number | null
}

export function ResyncButton({ repoId, githubRepoId }: ResyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const router = useRouter()

    if (!githubRepoId) return null

    const handleResync = async () => {
        setIsSyncing(true)
        setErrorMsg(null)

        try {
            const res = await fetch(`/api/github/repositories/${repoId}/resync`, {
                method: 'POST',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to resync repository')
            }

            router.refresh()
        } catch (err: any) {
            console.error('Resync error:', err)
            setErrorMsg(err.message)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleResync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
                {isSyncing ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resyncing...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M2.13 15.57a9 9 0 0 0 15.34 5.34l4.03-4.03M2.5 22v-6h6M21.87 8.43a9 9 0 0 0-15.34-5.34L2.5 7" />
                        </svg>
                        Resync From GitHub
                    </>
                )}
            </button>
            {errorMsg && (
                <span className="text-red-500 text-xs text-right max-w-[200px] block">{errorMsg}</span>
            )}
        </div>
    )
}
