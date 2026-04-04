import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function migrate() {
    console.log('[Migration] Adding WhatsApp columns to outreach_log...')
    
    // Check if channel column exists
    const { data: cols, error: colErr } = await supabase.rpc('get_table_columns', { table_name: 'outreach_log' })
    
    // Since we don't have get_table_columns rpc easily, we'll try to add and catch error
    const queries = [
        `ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';`,
        `ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS message_sid TEXT;`,
        `ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS wa_status TEXT;`
    ]

    console.log('[Migration] Note: You should run these queries manually in Supabase SQL Editor if this script fails to execute schema changes.')
    console.log(queries.join('\n'))

    // Supabase JS doesn't support ALTER TABLE directly, so we either use a pre-existing RPC or 
    // tell the user to run it.
    
    console.log('[Migration] Finished prep. Please run the SQL above in your Supabase Dashboard.')
}

migrate()
