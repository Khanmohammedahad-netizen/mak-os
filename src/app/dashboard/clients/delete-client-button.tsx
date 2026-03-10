'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteClientButton({ id }: { id: string }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this client?')) return
        setIsDeleting(true)

        try {
            const res = await fetch('/api/clients', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to delete client')
            }

            router.refresh()
        } catch (error: any) {
            alert(error.message)
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-medium transition"
        >
            {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
    )
}
