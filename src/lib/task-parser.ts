const CATEGORY_MAP: Record<string, string> = {
    // Gyms & Fitness
    'gym': 'gym',
    'gyms': 'gym',
    'fitness': 'gym',
    'fitness studio': 'gym',
    'crossfit': 'gym',
    'yoga': 'yoga studio',
    'pilates': 'pilates studio',
    'martial arts': 'martial arts school',
    'boxing': 'boxing gym',

    // Food & Drink
    'restaurant': 'restaurant',
    'restaurants': 'restaurant',
    'cafe': 'cafe',
    'cafes': 'cafe',
    'coffee': 'cafe',
    'coffee shop': 'cafe',
    'bakery': 'bakery',
    'bakeries': 'bakery',
    'bar': 'bar',
    'bars': 'bar',
    'food': 'restaurant',

    // Beauty & Grooming
    'barbershop': 'barbershop',
    'barbershops': 'barbershop',
    'barber': 'barbershop',
    'salon': 'hair salon',
    'salons': 'hair salon',
    'hair salon': 'hair salon',
    'nail salon': 'nail salon',
    'nails': 'nail salon',
    'spa': 'spa',
    'beauty': 'beauty salon',

    // Health & Medical
    'clinic': 'medical clinic',
    'clinics': 'medical clinic',
    'dental': 'dental clinic',
    'dentist': 'dental clinic',
    'dentists': 'dental clinic',
    'doctor': 'medical clinic',
    'vet': 'veterinary clinic',
    'veterinary': 'veterinary clinic',
    'chiropractor': 'chiropractic clinic',
    'pharmacy': 'pharmacy',
    'optometrist': 'optometrist',

    // Professional Services
    'lawyer': 'law office',
    'law': 'law office',
    'attorney': 'law office',
    'accountant': 'accounting firm',
    'accounting': 'accounting firm',
    'insurance': 'insurance agency',
    'real estate': 'real estate agency',

    // Trades & Home Services
    'contractor': 'contractor',
    'contractors': 'contractor',
    'plumber': 'plumber',
    'plumbing': 'plumber',
    'electrician': 'electrician',
    'hvac': 'hvac contractor',
    'landscaping': 'landscaping company',
    'cleaning': 'cleaning service',
    'roofing': 'roofing contractor',
    'painting': 'painting contractor',

    // Auto
    'auto repair': 'auto repair shop',
    'mechanic': 'auto repair shop',
    'car repair': 'auto repair shop',
    'auto': 'auto repair shop',
    'car wash': 'car wash',
    'tires': 'tire shop',
    'detailing': 'auto detailing',

    // Retail
    'retail': 'retail store',
    'boutique': 'boutique',
    'clothing': 'clothing store',
    'jewelry': 'jewelry store',
    'electronics': 'electronics store',
    'furniture': 'furniture store',
    'florist': 'florist',
    'pet store': 'pet store',

    // Creative & Education
    'photography': 'photography studio',
    'photographer': 'photography studio',
    'tutoring': 'tutoring center',
    'music': 'music school',
    'dance': 'dance studio',
    'art': 'art studio',

    // Hospitality
    'hotel': 'hotel',
    'motel': 'motel',
    'venue': 'event venue',
    'catering': 'catering company',
}

const GENERIC_TERMS = [
    'businesses', 'business', 'companies', 'shops',
    'places', 'stores', 'local businesses', 'any business', 'all'
]

const DEFAULT_CATEGORIES = [
    'restaurant', 'cafe', 'barbershop', 'hair salon', 'gym',
    'auto repair shop', 'dental clinic', 'retail store',
    'contractor', 'photography studio'
]

export interface ParsedTask {
    city: string | null
    categories: string[]
    filter?: string | null
    isGeneric: boolean
    rawInput: string
    error?: string
}

export function parseTaskInput(input: string): ParsedTask {
    const lower = input.toLowerCase().trim()

    // ── Check for generic input ──
    const GENERIC_TERMS = [
        'businesses', 'business', 'companies', 'shops',
        'places', 'stores', 'local businesses', 'any business', 'all'
    ]
    const DEFAULT_CATEGORIES = [
        'restaurant', 'cafe', 'barbershop', 'hair salon', 'gym',
        'auto repair shop', 'dental clinic', 'retail store',
        'contractor', 'photography studio'
    ]

    const isGeneric = GENERIC_TERMS.some(term => new RegExp(`\\b${term}\\b`, 'i').test(lower))
    
    // ── Dynamic Extraction (Attempt before generic fallback) ──
    const match = lower.match(/^(.+?)\s+in\s+([a-zA-Z\s]+?)(?:\s+(without.+))?$/i)
    let parsed: ParsedTask | null = null

    if (match) {
        const categoryRaw = match[1].trim()
        const city = match[2].trim()
        const filter = match[3]?.trim() || null
        
        // Clean generic terms from extracted category (e.g. "Real estate companies" -> "Real estate")
        let category = categoryRaw
        GENERIC_TERMS.forEach(term => {
            category = category.replace(new RegExp(`\\b${term}\\b`, 'gi'), '').trim()
        })

        parsed = {
            city,
            categories: [category || categoryRaw],
            filter,
            isGeneric: false, // It's specific enough if we have a category
            rawInput: input
        }
    } else if (isGeneric) {
        // Find city even in generic
        const cityMatch = lower.match(/\bin\s+([a-zA-Z\s]+?)(?:\s+|$)/i)
        parsed = {
            city: cityMatch?.[1]?.trim() || 'chicago',
            categories: DEFAULT_CATEGORIES,
            isGeneric: true,
            rawInput: input
        }
    }

    if (parsed) {
        console.log('[TaskParser] Raw result:', JSON.stringify(parsed))
        return parsed
    }

    // ── Backward Compatibility / Fallback ──
    // If "in" is not found, we signal that we need more info
    if (!lower.includes(' in ')) {
        return {
            city: null,
            categories: [],
            isGeneric: false,
            rawInput: input,
            error: 'Missing "in" keyword. Please use format: "[business type] in [city]"'
        }
    }

    // Last ditch: try to just get city if only one "in" exists
    const simpleMatch = lower.match(/(.+)\s+in\s+([a-zA-Z\s]+)$/i)
    if (simpleMatch) {
        return {
            city: simpleMatch[2].trim(),
            categories: [simpleMatch[1].trim()],
            isGeneric: false,
            rawInput: input
        }
    }

    return {
        city: null,
        categories: [],
        isGeneric: false,
        rawInput: input,
        error: 'Could not parse task. Please use format: "[business type] in [city]"'
    }
}

// Backwards compatibility for the old parseTask name if used elsewhere
export function parseTask(input: string) {
    return parseTaskInput(input)
}

