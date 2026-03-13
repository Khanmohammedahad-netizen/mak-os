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
    city: string
    categories: string[]
    isGeneric: boolean
    rawInput: string
}

export function parseTaskInput(input: string): ParsedTask {
    const lower = input.toLowerCase().trim()

    // ── Extract city ──
    // Match: "in [city]" optionally followed by "without", "with", "that", "no"
    const cityPatterns = [
        /\bin\s+([a-zA-Z\s]+?)(?:\s+without|\s+with\s+no|\s+that\s+have|\s+no\s+website|,|\.|$)/i,
        /\bin\s+([a-zA-Z\s]+?)$/i,
    ]

    let city = 'chicago' // absolute fallback
    for (const pattern of cityPatterns) {
        const match = lower.match(pattern)
        if (match?.[1]?.trim()) {
            city = match[1].trim()
            break
        }
    }

    // Clean city: remove trailing words that aren't part of city name
    city = city.replace(/\b(without|with|that|no|website|websites)\b.*$/i, '').trim()

    // ── Check for generic input ──
    const isGeneric = GENERIC_TERMS.some(term => lower.includes(term))
    if (isGeneric) {
        return {
            city,
            categories: DEFAULT_CATEGORIES,
            isGeneric: true,
            rawInput: input
        }
    }

    // ── Extract specific category ──
    let foundCategory: string | null = null

    // Check multi-word phrases first (longer matches take priority)
    const sortedEntries = Object.entries(CATEGORY_MAP)
        .sort((a, b) => b[0].length - a[0].length)

    for (const [keyword, mapped] of sortedEntries) {
        if (lower.includes(keyword)) {
            foundCategory = mapped
            break
        }
    }

    // If nothing matched, default to restaurant but LOG a warning
    if (!foundCategory) {
        console.warn(`[TaskParser] No category matched for input: "${input}" — defaulting to restaurant`)
        foundCategory = 'restaurant'
    }

    return {
        city,
        categories: [foundCategory],
        isGeneric: false,
        rawInput: input
    }
}

// Backwards compatibility for the old parseTask name if used elsewhere
export function parseTask(input: string) {
    return parseTaskInput(input)
}
