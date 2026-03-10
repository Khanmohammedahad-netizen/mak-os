'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DatabaseRepository {
    id: string
    github_repo_id: number
    github_full_name: string
    clone_url: string
    visibility: 'public' | 'private'
    is_template: boolean
    topics: string[]
    owner_id: string
    synced_at: string
}

export default function RepositoriesClient() {
    const [repos, setRepos] = useState<DatabaseRepository[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [newRepoData, setNewRepoData] = useState({ newName: '', templateOwner: '', templateRepo: '' })

    const fetchRepos = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/repos')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch repositories')
            }

            setRepos(data.data || [])
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const syncGitHub = async () => {
        setIsSyncing(true)
        setError(null)

        try {
            const res = await fetch('/api/repos/sync', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to sync repositories')
            }

            await fetchRepos()
        } catch (err: any) {
            setError(err.message || 'Sync failed')
        } finally {
            setIsSyncing(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSyncing(true)
        setError(null)
        try {
            const res = await fetch('/api/repos/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRepoData)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create repository')
            setIsCreating(false)
            setNewRepoData({ newName: '', templateOwner: '', templateRepo: '' })
            await fetchRepos()
        } catch (err: any) {
            setError(err.message || 'Creation failed')
        } finally {
            setIsSyncing(false)
        }
    }

    useEffect(() => {
        fetchRepos()
    }, [fetchRepos])

    const SkeletonRow = () => (
        <tr className="animate-pulse">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-2">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-3 bg-gray-100 rounded w-64"></div>
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="h-5 bg-gray-200 rounded-full w-16"></div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="h-5 bg-gray-200 rounded-full w-10"></div>
            </td>
            <td className="px-6 py-4 w-1/3">
                <div className="flex gap-2">
                    <div className="h-5 bg-gray-200 rounded w-16 px-2"></div>
                    <div className="h-5 bg-gray-200 rounded w-20 px-2"></div>
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div>
            </td>
        </tr>
    )

    return (
        <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Repositories</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and sync your connected GitHub repositories.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={syncGitHub}
                        disabled={isSyncing || isLoading}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        {isSyncing ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Syncing...
                            </>
                        ) : (
                            'Sync GitHub'
                        )}
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-lg shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors duration-200"
                    >
                        Create Repository
                    </button>
                </div>
            </div>

            {isCreating && (
                <div className="mb-8 p-6 bg-white border rounded-xl shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Create Repository from Template</h3>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4 max-w-md">
                        <input
                            type="text"
                            placeholder="New Repository Name"
                            value={newRepoData.newName}
                            onChange={(e) => setNewRepoData({ ...newRepoData, newName: e.target.value })}
                            className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Template Owner (e.g. vercel)"
                            value={newRepoData.templateOwner}
                            onChange={(e) => setNewRepoData({ ...newRepoData, templateOwner: e.target.value })}
                            className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Template Repo (e.g. next.js)"
                            value={newRepoData.templateRepo}
                            onChange={(e) => setNewRepoData({ ...newRepoData, templateRepo: e.target.value })}
                            className="rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                            required
                        />
                        <div className="flex gap-2 justify-end mt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSyncing}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                            >
                                {isSyncing ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative max-h-[70vh] flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200 relative">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Repository</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Visibility</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Template</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Topics</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Last Synced</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading && repos.length === 0 ? (
                                <>
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                </>
                            ) : error && repos.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12">
                                        <div className="text-center">
                                            <div className="mx-auto h-12 w-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900">Failed to load repositories</h3>
                                            <p className="mt-1 text-sm text-gray-500">{error}</p>
                                            <div className="mt-6">
                                                <button onClick={fetchRepos} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50">
                                                    Try Again
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : repos.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12">
                                        <div className="text-center">
                                            <div className="mx-auto h-12 w-12 text-gray-400 mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                </svg>
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900">No repositories found</h3>
                                            <p className="mt-1 text-sm text-gray-500">Get started by syncing your GitHub organization.</p>
                                            <div className="mt-6">
                                                <button onClick={syncGitHub} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-lg shadow-sm hover:bg-gray-800">
                                                    Sync GitHub
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                repos.map(repo => (
                                    <tr key={repo.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col max-w-[300px]">
                                                <span title={repo.github_full_name} className="text-sm font-medium text-gray-900 truncate">
                                                    {repo.github_full_name}
                                                </span>
                                                <span title={repo.clone_url} className="text-sm text-gray-500 mt-0.5 truncate">
                                                    {repo.clone_url}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${repo.visibility === 'private' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                {repo.visibility === 'private' ? 'Private' : 'Public'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {repo.is_template ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 w-1/3">
                                            <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                                                {repo.topics && repo.topics.length > 0 ? repo.topics.map((topic, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                                        {topic}
                                                    </span>
                                                )) : <span className="text-gray-400 text-sm">—</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                            <time dateTime={repo.synced_at} title={new Date(repo.synced_at).toLocaleString()}>
                                                {new Date(repo.synced_at).toLocaleString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: 'numeric',
                                                })}
                                            </time>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
