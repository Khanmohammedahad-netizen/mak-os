'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddRepositoryForm({ projects }: { projects: any[] }) {
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [name, setName] = useState('')
    const [projectId, setProjectId] = useState('')
    const [templateOwner, setTemplateOwner] = useState('')
    const [templateRepo, setTemplateRepo] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrorMsg(null)
        console.log('[UI] Submitting Repo Payload:', { name, project_id: projectId, templateOwner, templateRepo })

        try {
            const res = await fetch('/api/repos/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    project_id: projectId || undefined,
                    templateOwner: templateOwner || undefined,
                    templateRepo: templateRepo || undefined
                })
            })

            const data = await res.json()

            if (!res.ok) {
                console.error('[UI] Repo Creation Error', data)
                throw new Error(data.error || 'Failed to create repository')
            }

            console.log('[UI] Repo Creation Success', data)

            // Success
            setName('')
            setProjectId('')
            setTemplateOwner('')
            setTemplateRepo('')
            setShowCreateForm(false)
            router.refresh()
        } catch (error: any) {
            setErrorMsg(error.message)
            console.error('[UI] Repo Creation Error', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const triggerClick = () => {
        console.log('[UI] Add Repo Clicked')
        setShowCreateForm(true)
    }

    if (!showCreateForm) {
        return (
            <button
                onClick={triggerClick}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition"
            >
                Add Repository
            </button>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-4 border rounded-md shadow-sm flex flex-col gap-3 min-w-[300px]">
            <h3 className="font-semibold mb-2">Create Repository</h3>

            {errorMsg && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">
                    {errorMsg}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">Repository Name *</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. my-new-repo"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Project Selector</label>
                <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="">-- No Project --</option>
                    {projects?.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Template Owner (Optional)</label>
                <input
                    type="text"
                    value={templateOwner}
                    onChange={(e) => setTemplateOwner(e.target.value)}
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. vercel"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Template Repo (Optional)</label>
                <input
                    type="text"
                    value={templateRepo}
                    onChange={(e) => setTemplateRepo(e.target.value)}
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. next.js"
                />
            </div>

            <div className="flex justify-end gap-2 mt-2">
                <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || !name}
                    className="bg-primary text-white px-3 py-1.5 text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                    {isSubmitting ? 'Creating...' : 'Submit'}
                </button>
            </div>
        </form>
    )
}
