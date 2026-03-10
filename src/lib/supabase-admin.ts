/**
 * Supabase Admin Client — uses SERVICE_ROLE_KEY to bypass RLS.
 *
 * ONLY use this in server-side code (API routes, background jobs).
 * Never expose to the client.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[supabase-admin] Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
