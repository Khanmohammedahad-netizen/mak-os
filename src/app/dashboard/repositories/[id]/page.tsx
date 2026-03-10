import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ResyncButton } from './resync-button'

interface Repository {
    id: string
    name: string
    visibility: 'public' | 'private'
    owner_id: string
    github_repo_id: number | null
    github_full_name: string | null
    clone_url: string | null
    is_template: boolean | null
    synced_at: string | null
    created_at: string
    updated_at: string
    project_id: string | null
    projects?: {
        id: string
        name: string
    } | null
}

export default async function RepositoryDetailPage({
    params
}: {
    params: { id: string }
}) {
    const supabase = createSupabaseServerClient()

    // 1. Single query fetching repository and joined project
    const { data, error } = await supabase
        .from('repositories')
        .select(`
            id,
            name,
            visibility,
            owner_id,
            github_repo_id,
            github_full_name,
            clone_url,
            is_template,
            synced_at,
            created_at,
            updated_at,
            project_id,
            projects ( id, name )
        `)
        .eq('id', params.id)
        .single()

    // 2. Strict error and null handling
    if (error || !data) {
        notFound()
    }

    const repo = data as unknown as Repository
    const project = repo.projects

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link href="/dashboard/repositories" className="text-sm text-gray-500 hover:text-primary transition-colors">
                    ← Back to Repositories
                </Link>
            </div>

            {/* Main Content Container */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden mb-6">

                {/* Header Section */}
                <div className="border-b p-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {repo.name}
                            {repo.github_repo_id ? (
                                <span className="text-xs uppercase tracking-wider font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                                    GitHub Synced
                                </span>
                            ) : (
                                <span className="text-xs uppercase tracking-wider font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200">
                                    Local
                                </span>
                            )}
                        </h1>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex items-start gap-4 flex-col md:flex-row md:items-center">
                        <ResyncButton repoId={repo.id} githubRepoId={repo.github_repo_id} />
                        {repo.clone_url && (
                            <a
                                href={repo.clone_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                                    <path d="M9 18c-4.51 2-5-2-7-2" />
                                </svg>
                                Open on GitHub
                            </a>
                        )}
                    </div>
                </div>

                {/* Metadata Grid */}
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-4 text-gray-900">Repository Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                        {/* 1. Linked Project */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">Linked Project</div>
                            <div>
                                {project?.id ? (
                                    <Link
                                        href={`/dashboard/projects/${project.id}`}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        {project.name}
                                    </Link>
                                ) : (
                                    <span className="text-gray-400 italic">No assigned project</span>
                                )}
                            </div>
                        </div>

                        {/* 2. Visibility */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">Visibility</div>
                            <div>
                                <span className="capitalize font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                                    {repo.visibility || 'Unknown'}
                                </span>
                            </div>
                        </div>

                        {/* 3. GitHub Full Name */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">GitHub Full Name</div>
                            <div>
                                {repo.github_full_name ? (
                                    <span className="text-gray-900 font-medium">
                                        {repo.github_full_name}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 italic">N/A</span>
                                )}
                            </div>
                        </div>

                        {/* 4. Clone URL */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">Clone URL</div>
                            <div>
                                {repo.clone_url ? (
                                    <a
                                        href={repo.clone_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline font-mono text-sm max-w-full block truncate"
                                        title={repo.clone_url}
                                    >
                                        {repo.clone_url}
                                    </a>
                                ) : (
                                    <span className="text-gray-400 italic">N/A</span>
                                )}
                            </div>
                        </div>

                        {/* 5. Created At */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">Created At</div>
                            <div className="text-gray-900">
                                {repo.created_at
                                    ? new Date(repo.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                                    : <span className="text-gray-400 italic">Unknown</span>}
                            </div>
                        </div>

                        {/* 6. Last Synced */}
                        <div>
                            <div className="text-sm font-medium text-gray-500 mb-1">Last Synced</div>
                            <div className="text-gray-900 font-mono text-sm bg-gray-50 px-2 py-1 rounded border w-max">
                                {repo.synced_at
                                    ? new Date(repo.synced_at).toLocaleString()
                                    : <span className="text-gray-400 italic">Never</span>}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}
