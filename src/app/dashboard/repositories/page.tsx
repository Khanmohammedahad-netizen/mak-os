import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AddRepositoryForm } from './add-repository-form'
import { SyncGithubButton } from './sync-button'
import Link from 'next/link'

export default async function RepositoriesPage() {
    const supabase = createSupabaseServerClient()

    // Parallel fetching for performance
    const [reposResponse, projectsResponse] = await Promise.all([
        supabase.from('repositories').select('*, projects(name)'),
        supabase.from('projects').select('id, name')
    ])

    const { data: repositories, error } = reposResponse
    const projects = projectsResponse.data || []

    if (error) {
        return <div className="p-8 text-red-500">Error loading repositories: {error.message}</div>
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold">Repositories</h1>
                <div className="flex items-center gap-4">
                    <SyncGithubButton />
                    <AddRepositoryForm projects={projects} />
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="p-4 font-medium text-gray-500">Name</th>
                            <th className="p-4 font-medium text-gray-500">Project</th>
                            <th className="p-4 font-medium text-gray-500">URL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {repositories?.map((repo) => (
                            <tr key={repo.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                                <td className="p-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <Link href={`/dashboard/repositories/${repo.id}`} className="hover:text-primary transition-colors hover:underline">
                                            {repo.name}
                                        </Link>
                                        {repo.github_repo_id ? (
                                            <span className="text-[10px] uppercase tracking-wider font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                                GitHub Synced
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-wider font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                                Local
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-sm">{(repo.projects as any)?.name || 'N/A'}</td>
                                <td className="p-4 text-sm text-gray-500">
                                    {repo.clone_url ? (
                                        <a href={repo.clone_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                                            {repo.clone_url}
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 italic">No URL</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {repositories?.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-gray-500">
                                    No repositories found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
