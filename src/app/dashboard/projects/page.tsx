import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AddProjectForm } from './add-project-form'
import Link from 'next/link'

export default async function ProjectsPage() {
    const supabase = createSupabaseServerClient()
    const { data: projects, error } = await supabase.from('projects').select('*, clients(name)')
    const { data: clients } = await supabase.from('clients').select('id, name')

    if (error) {
        return <div className="p-8 text-red-500">Error loading projects: {error.message}</div>
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Projects</h1>
                <AddProjectForm clients={clients || []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects?.map((project) => (
                    <div key={project.id} className="p-6 bg-white rounded-xl border shadow-sm hover:shadow-md transition">
                        <h3 className="font-bold text-lg mb-2">
                            <Link href={`/dashboard/projects/${project.id}`} className="hover:text-primary transition-colors">
                                {project.name}
                            </Link>
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Client: {(project.clients as any)?.name || 'N/A'}</p>
                        <div className="flex justify-end">
                            <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-primary hover:underline font-medium">
                                View Details
                            </Link>
                        </div>
                    </div>
                ))}
                {projects?.length === 0 && (
                    <div className="col-span-3 p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed">
                        No projects found.
                    </div>
                )}
            </div>
        </div>
    )
}
