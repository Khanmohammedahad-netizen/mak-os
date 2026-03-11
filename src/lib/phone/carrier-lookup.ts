export interface CarrierResult {
    carrier: string | null
    gateway: string | null
    lineType: 'mobile' | 'landline' | 'voip' | 'unknown'
    source: string
}

// Gateway map — Maps carrier names to their email-to-SMS domains
export const CARRIER_GATEWAYS: Record<string, string> = {
    'att': 'txt.att.net',
    'tmobile': 'tmomail.net',
    'verizon': 'vtext.com',
    'sprint': 'messaging.sprintpcs.com',
    'boost': 'sms.myboostmobile.com',
    'cricket': 'sms.cricketwireless.net',
    'uscellular': 'email.uscc.net',
    'metropcs': 'mymetropcs.com',
    'republic': 'text.republicwireless.com',
    'googlefi': 'msg.fi.google.com',
    'straighttalk': 'vtext.com', // runs on Verizon network
    'tracfone': 'mmst5.tracfone.com',
}

export async function lookupCarrier(phoneNumber: string): Promise<CarrierResult> {
    const formattedPhone = formatPhoneDigits(phoneNumber)

    // Step 1: Check Supabase cache first
    const cached = await getCachedCarrier(formattedPhone)
    if (cached) return cached

    // Step 2: Since true free carrier lookup APIs without keys are mostly non-existent or heavily rate-limited,
    // we use a Pattern/Heuristic fallback immediately in the free architecture, 
    // relying on the 4-way multi-send strategy designed in Step 4 for unknown carriers.

    // In a paid production environment, this is where you would call Twilio Lookup API or similar.
    const result = detectCarrierByPattern(formattedPhone)

    // Cache the result to avoid repeating the logic
    await cacheCarrierResult(formattedPhone, result)

    return result
}

async function getCachedCarrier(formattedPhone: string): Promise<CarrierResult | null> {
    try {
        const { supabaseAdmin: supabase } = await import('../supabase-admin')
        const { data, error } = await supabase
            .from('carrier_cache')
            .select('*')
            .eq('phone_number', formattedPhone)
            .single()

        if (error || !data) return null

        return {
            carrier: data.carrier,
            gateway: data.carrier_gateway,
            lineType: data.line_type as any,
            source: 'cache'
        }
    } catch {
        return null
    }
}

async function cacheCarrierResult(formattedPhone: string, result: CarrierResult) {
    try {
        const { supabaseAdmin: supabase } = await import('../supabase-admin')
        await supabase
            .from('carrier_cache')
            .upsert({
                phone_number: formattedPhone,
                carrier: result.carrier,
                carrier_gateway: result.gateway,
                line_type: result.lineType,
                lookup_source: result.source
            })
    } catch (err) {
        console.error('[CarrierLookup] Failed to cache result:', err)
    }
}

function detectCarrierByPattern(_formattedPhone: string): CarrierResult {
    // Without a paid API, we cannot reliably detect the exact carrier.
    // We return 'unknown' which triggers the 'send to top 4 carriers simultaneously' fallback strategy.

    // We can confidently say it's not a landline for now for testing purposes.
    return {
        carrier: null,
        gateway: null,
        lineType: 'unknown',
        source: 'pattern_fallback'
    }
}

/**
 * If carrier is unknown, attempt all major carrier gateways
 * and let the successful delivery confirm the carrier.
 */
export function getAllGatewayEmails(phoneNumber: string): string[] {
    const digits = formatPhoneDigits(phoneNumber)
    return Object.values(CARRIER_GATEWAYS).map(gateway => `${digits}@${gateway}`)
}

/**
 * Format phone number to strictly 10 digits (US format)
 */
export function formatPhoneDigits(phone: string): string {
    // Strip everything but numbers
    let digits = phone.replace(/\D/g, '')

    // If it has a country code (e.g. 1 + 10 digits), strip the 1
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.substring(1)
    }

    return digits
}
