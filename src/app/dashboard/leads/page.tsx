import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RealtimeLeads } from '@/components/realtime-leads'

export default async function LeadsPage() {
    const supabase = createSupabaseServerClient()

    // Initial server-side fetch for SEO and fast first render
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, company, email, phone, city, priority_score, status, email_sent_at, email_status, whatsapp_sent_at, whatsapp_status, contacted_at, website_category, whatsapp_message_sid, whatsapp_message_body')
        .order('created_at', { ascending: false })

    if (error) {
        return <div className="p-8 text-red-500">Error loading leads: {error.message}</div>
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Leads Pipeline</h1>
            </div>

            <RealtimeLeads
                initialLeads={leads || []}
                operatorName={process.env.OPERATOR_NAME || 'Mohammed'}
            />
        </div>
    )
}
