import { createSupabaseServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProjectDetailPage({
    params
}: {
    params: { id: string }
}) {
    const supabase = createSupabaseServerClient()

    const { data: project, error } = await supabase
        .from('projects')
        .select(`
            *,
            clients(id, name),
            repositories(id, name, visibility)
        `)
        .eq('id', params.id)
        .single()

    if (error || !project) {
        return (
            <div className="p-8">
                <div className="bg-white border rounded-lg p-8 text-center text-gray-500 shadow-sm">
                    Project not found.
                </div>
            </div>
        )
    }

    const repositories = (project.repositories as any[]) || []

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link href="/dashboard/projects" className="text-sm text-gray-500 hover:text-primary transition-colors">
                    ← Back to Projects
                </Link>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
                <div className="p-6">
                    <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
                    <div className="text-sm text-gray-500">
                        Client: {project.clients ? (
                            <span className="font-medium text-gray-700">{(project.clients as any).name}</span>
                        ) : (
                            <span className="italic text-gray-400">Unassigned</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-4 flex justify-between items-end">
                <h2 className="text-xl font-bold">Associated Repositories</h2>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {repositories.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-4 font-medium text-gray-500">Repository Name</th>
                                <th className="p-4 font-medium text-gray-500">Visibility</th>
                            </tr>
                        </thead>
                        <tbody>
                            {repositories.map((repo) => (
                                <tr key={repo.id} className="border-b last:border-0 hover:bg-gray-50 transition group">
                                    <td className="p-4">
                                        <Link
                                            href={`/dashboard/repositories/${repo.id}`}
                                            className="font-medium text-gray-900 group-hover:text-primary transition-colors"
                                        >
                                            {repo.name}
                                        </Link>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${repo.visibility === 'public'
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-200 text-gray-700 border border-gray-300'
                                            }`}>
                                            {repo.visibility || 'private'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-gray-500 bg-gray-50/50">
                        No repositories belong to this project.
                    </div>
                )}
            </div>
        </div>
    )
}
