'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddProjectForm({ clients }: { clients: any[] }) {
    const [name, setName] = useState('')
    const [clientId, setClientId] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !clientId) return
        setIsSubmitting(true)

        try {
            console.log('Submitting project:', { name, client_id: clientId })
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, client_id: clientId }),
            })

            if (response.ok) {
                setName('')
                setClientId('')
                router.refresh()
            } else {
                const errorData = await response.json()
                console.error('Failed to create project:', errorData.error)
            }
        } catch (error) {
            console.error('Error creating project:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                placeholder="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
            />
            <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                required
            >
                <option value="" disabled>Select Client</option>
                {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                ))}
            </select>
            <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition text-sm disabled:opacity-70"
            >
                {isSubmitting ? 'Adding...' : 'Add Project'}
            </button>
        </form>
    )
}
