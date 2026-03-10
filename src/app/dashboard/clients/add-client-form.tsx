'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddClientForm() {
    const [name, setName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return
        setIsSubmitting(true)

        try {
            console.log('Submitting client:', { name })
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name }),
            })

            if (response.ok) {
                setName('')
                router.refresh()
            } else {
                const errorData = await response.json()
                console.error('Failed to create client:', errorData.error)
            }
        } catch (error) {
            console.error('Error creating client:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                placeholder="Client Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
            />
            <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition text-sm disabled:opacity-70"
            >
                {isSubmitting ? 'Adding...' : 'Add Client'}
            </button>
        </form>
    )
}
