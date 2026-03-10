import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AddClientForm } from './add-client-form'
import { DeleteClientButton } from './delete-client-button'

export default async function ClientsPage() {
    const supabase = createSupabaseServerClient()
    const { data: clients, error } = await supabase.from('clients').select('*')

    if (error) {
        return <div className="p-8 text-red-500">Error loading clients: {error.message}</div>
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Clients</h1>
                <AddClientForm />
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="p-4 font-medium text-gray-500">ID</th>
                            <th className="p-4 font-medium text-gray-500">Name</th>
                            <th className="p-4 font-medium text-gray-500">Created At</th>
                            <th className="p-4 font-medium text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients?.map((client) => (
                            <tr key={client.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                                <td className="p-4 text-sm text-gray-500">{client.id.slice(0, 8)}...</td>
                                <td className="p-4 font-medium">{client.name}</td>
                                <td className="p-4 text-sm text-gray-500">{new Date(client.created_at).toLocaleDateString()}</td>
                                <td className="p-4 text-right">
                                    <DeleteClientButton id={client.id} />
                                </td>
                            </tr>
                        ))}
                        {clients?.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500">
                                    No clients found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
