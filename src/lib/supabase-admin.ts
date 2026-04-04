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
    if (process.env.NODE_ENV === 'production') {
        console.warn('[supabase-admin] Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail')
    }
}

// Export a proxy or getter if you want, but for now we just make sure it doesn't crash createClient
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder-url.supabase.co', 
    serviceRoleKey || 'placeholder-key', 
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
)
