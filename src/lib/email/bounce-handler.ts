import { SupabaseClient } from '@supabase/supabase-js'

export async function handleBounce(
    supabase: SupabaseClient,
    emailAddress: string,
    bounceType: 'hard' | 'soft',
    errorCode: string
): Promise<void> {
    console.log(`[Email] Bounce: ${emailAddress} — ${bounceType} — ${errorCode}`)

    if (bounceType === 'hard') {
        // Permanent failure — add to suppression list forever
        await supabase.from('email_suppression_list').upsert({
            email: emailAddress,
            reason: `hard_bounce_${errorCode}`,
            added_at: new Date().toISOString()
        })

        // Update lead status
        await supabase
            .from('leads')
            .update({ status: 'invalid_email' }) // ensure 'invalid_email' is valid ENUM value or adjust
            .eq('email', emailAddress)

        console.log(`[Email] ${emailAddress} added to suppression list`)
    }
}

export async function isSuppressed(
    supabase: SupabaseClient,
    recipientEmail: string
): Promise<boolean> {
    const { data: suppressed } = await supabase
        .from('email_suppression_list')
        .select('email')
        .eq('email', recipientEmail)
        .single()
    return !!suppressed
}
