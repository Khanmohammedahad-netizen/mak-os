/**
 * Apify Client — Fully Rebuilt for Reliability (v1.2)
 *
 * Core functions:
 *   - scrapeGoogleMaps()  → Reliable Google Maps Scraper (compass/crawler-google-places)
 *   - enrichContacts()    → Contact Info Scraper (vdrmota/contact-info-scraper)
 *   - verifyLeadWebsite() → Google Search Verification for "Needs Website" leads
 */

import { trackApiCost } from './cost-tracker'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'compass~crawler-google-places'
const TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN

export interface GoogleMapsLead {
    name: string
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    rating: number | null
    reviewCount: number | null
    category: string | null
    city: string | null
    noWebsiteConfirmed?: boolean
}

export interface EnrichedContact {
    url: string
    emails: string[]
    phones: string[]
    socials: string[]
}

// Smart country resolver — maps known cities to their correct country
const CITY_COUNTRY_MAP: Record<string, string> = {
    // USA
    'chicago': 'USA',
    'houston': 'USA',
    'dallas': 'USA',
    'miami': 'USA',
    'new york': 'USA',
    'nyc': 'USA',
    'los angeles': 'USA',
    'la': 'USA',
    'phoenix': 'USA',
    'denver': 'USA',
    'seattle': 'USA',
    'atlanta': 'USA',
    'boston': 'USA',
    'san francisco': 'USA',
    'san diego': 'USA',
    'austin': 'USA',
    'portland': 'USA',
    'nashville': 'USA',
    'charlotte': 'USA',
    'minneapolis': 'USA',
    // Australia
    'sydney': 'Australia',
    'melbourne': 'Australia',
    'brisbane': 'Australia',
    'perth': 'Australia',
    'adelaide': 'Australia',
    'gold coast': 'Australia',
    // United Kingdom
    'london': 'United Kingdom',
    'manchester': 'United Kingdom',
    'birmingham': 'United Kingdom',
    'leeds': 'United Kingdom',
    'edinburgh': 'United Kingdom',
    'glasgow': 'United Kingdom',
    'bristol': 'United Kingdom',
    'liverpool': 'United Kingdom',
    // UAE
    'dubai': 'UAE',
    'abu dhabi': 'UAE',
    'sharjah': 'UAE',
    // India
    'mumbai': 'India',
    'delhi': 'India',
    'new delhi': 'India',
    'bangalore': 'India',
    'bengaluru': 'India',
    'hyderabad': 'India',
    'chennai': 'India',
    'pune': 'India',
    'kolkata': 'India',
    'ahmedabad': 'India',
    // Canada
    'toronto': 'Canada',
    'vancouver': 'Canada',
    'montreal': 'Canada',
    'calgary': 'Canada',
    'ottawa': 'Canada',
    // Japan
    'tokyo': 'Japan',
    'osaka': 'Japan',
    'kyoto': 'Japan',
    // Europe
    'paris': 'France',
    'berlin': 'Germany',
    'munich': 'Germany',
    'amsterdam': 'Netherlands',
    'madrid': 'Spain',
    'barcelona': 'Spain',
    'rome': 'Italy',
    'milan': 'Italy',
    'lisbon': 'Portugal',
    'zurich': 'Switzerland',
    // Southeast Asia
    'singapore': 'Singapore',
    'bangkok': 'Thailand',
    'kuala lumpur': 'Malaysia',
    'jakarta': 'Indonesia',
}

function resolveCountry(city: string): string {
    return CITY_COUNTRY_MAP[city.toLowerCase()] || ''
}

/**
 * Generic Actor Runner with Polling & Logging
 */
async function runActorAndGetResults<T>(
    actorId: string,
    input: Record<string, unknown>,
    timeoutMs = 120_000
): Promise<T[]> {
    if (!TOKEN) throw new Error('APIFY_API_TOKEN is not set')

    console.log(`[Apify] Starting actor: ${actorId}`)
    console.log(`[Apify] Input: ${JSON.stringify(input, null, 2)}`)

    // 1. Start the actor run
    const startRes = await fetch(
        `${APIFY_BASE}/acts/${actorId}/runs?token=${TOKEN}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store', // Bypass Next.js default caching on Vercel
            body: JSON.stringify(input),
        }
    )

    if (!startRes.ok) {
        const err = await startRes.text()
        console.error('[Apify] Failed to start run:', startRes.status, err)
        throw new Error(`Apify start failed: ${err}`)
    }

    const startData = await startRes.json()
    const runId = startData?.data?.id
    const datasetId = startData?.data?.defaultDatasetId

    if (!runId) throw new Error('No run ID returned')

    console.log(`[Apify] Run started: ${runId}`)

    // 2. Poll until finished
    const maxPolls = 45
    const pollInterval = 2000

    for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, pollInterval))

        const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${TOKEN}`, { cache: 'no-store' })
        const statusData = await statusRes.json()
        const status = statusData?.data?.status

        console.log(`[Apify] Poll ${i + 1}/${maxPolls} — Status: ${status}`)

        if (status === 'SUCCEEDED') {
            const resultsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${TOKEN}&clean=true`, { cache: 'no-store' })
            if (!resultsRes.ok) throw new Error(`Dataset fetch failed: ${resultsRes.status}`)
            return await resultsRes.json() as T[]
        }

        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
            throw new Error(`Apify run ${status}: ${JSON.stringify(statusData?.data)}`)
        }
    }

    throw new Error('Apify polling timeout')
}

function getWeekKey(): string {
    const now = new Date()
    const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
    return `week_${weekNum}`
}

/**
 * Reliable Google Maps Scraper (User-provided polling implementation + Caching)
 */
export async function scrapeGoogleMaps(
    category: string,
    city: string,
    maxResults = 100,
    supabase?: any,
    logs?: string[] | ((msg: string) => void)
): Promise<GoogleMapsLead[]> {
    const log = (msg: string) => {
        console.log(msg)
        if (!logs) return
        if (typeof logs === 'function') {
            try { logs(msg) } catch (e) { }
        } else if (Array.isArray(logs)) {
            logs.push(msg)
        }
    }

    const TOKEN_VAR = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN
    if (!TOKEN_VAR) {
        log('[Apify] ERROR: Neither APIFY_API_TOKEN nor APIFY_TOKEN env var is set')
        return []
    }

    // Debug mode — returns fake data to test pipeline without Apify
    if (process.env.APIFY_DEBUG === 'true') {
        log('[Apify] DEBUG MODE ON — returning mock data')
        return Array.from({ length: 5 }, (_, i) => ({
            name: `Test ${category} ${i + 1} - ${city}`,
            address: `${100 + i} Main St, ${city}`,
            city,
            rating: 4.2 + (i * 0.1),
            reviewCount: 30 + (i * 10),
            website: null,
            phone: `+1214555010${i}`,
            email: null,
            category: category,
            noWebsiteConfirmed: true,
        }))
    }

    const country = resolveCountry(city)
    const searchString = country
        ? `${category} in ${city}, ${country}`
        : `${category} in ${city}`
    const cacheKey = `${city.toLowerCase()}_${category.toLowerCase()}_${getWeekKey()}`

    // ── STEP 0: Check cache first ──
    if (supabase) {
        try {
            const { data: cached } = await supabase
                .from('research_cache')
                .select('raw_data')
                .eq('cache_key', cacheKey)
                .single()

            if (cached?.raw_data && Array.isArray(cached.raw_data) && cached.raw_data.length > 0) {
                log(`[Cache] HIT for ${category} in ${city} — ${cached.raw_data.length} businesses found in database`)
                return cached.raw_data as GoogleMapsLead[]
            } else if (cached?.raw_data && Array.isArray(cached.raw_data) && cached.raw_data.length === 0) {
                log(`[Cache] Found empty result set for ${category} in ${city} — bypassing cache to force fresh scrape`)
                // Do not return, proceed to scrape
            }
        } catch (e) {
            // cache miss or table missing, proceed
        }
    }

    log(`[Cache] MISS for ${category} in ${city} — Launching scrape for: "${searchString}"`)

    // ── STEP 1: Start the actor run ──
    const startRes = await fetch(
        `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${TOKEN_VAR}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store', // Bypass Next.js default caching on Vercel
            body: JSON.stringify({
                searchStringsArray: [searchString],
                maxCrawledPlacesPerSearch: 100, // Scrape up to 100 businesses
                language: 'en',
                maxImages: 0,
                maxReviews: 0,
                scrapeReviewerInfo: false,
            }),
        }
    )

    if (!startRes.ok) {
        const errText = await startRes.text()
        let msg = `[Apify] Failed to start run. Status: ${startRes.status} — ${errText}`
        
        if (startRes.status === 402) {
            msg = `[Apify] ❌ Payment Required (402): Usage limit exceeded. Please upgrade your Apify plan or enable APIFY_DEBUG="true" in .env.local to test the pipeline with mock data.`
        }
        
        log(msg)
        return []
    }

    const startData = await startRes.json()
    const runId = startData?.data?.id
    const datasetId = startData?.data?.defaultDatasetId

    if (!runId) {
        log(`[Apify] No runId returned: ${JSON.stringify(startData)}`)
        return []
    }

    log(`[Apify] Run started — ID: ${runId}`)

    // ── STEP 2: Poll until the run finishes ──
    // Poll every 3 seconds for up to 3 minutes (60 attempts)
    for (let attempt = 1; attempt <= 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000))

        const pollRes = await fetch(
            `${APIFY_BASE}/actor-runs/${runId}?token=${TOKEN_VAR}`,
            { cache: 'no-store' }
        )
        const pollData = await pollRes.json()
        const status = pollData?.data?.status

        log(`[Apify] Poll ${attempt}/60 — Status: ${status}`)

        if (status === 'SUCCEEDED') {
            // ── STEP 3: Fetch the results from the dataset ──
            const dataRes = await fetch(
                `${APIFY_BASE}/datasets/${datasetId}/items?token=${TOKEN_VAR}&clean=true`,
                { cache: 'no-store' }
            )

            if (!dataRes.ok) {
                console.error(`[Apify] Dataset fetch failed: ${dataRes.status}`)
                return []
            }

            const items = await dataRes.json()
            log(`[Apify] SUCCESS — ${items.length} businesses found`)

            if (items.length === 0) {
                log(`[Apify] Warning: Run succeeded but returned 0 items for "${searchString}". This may mean no results exist or the search query needs adjustment.`)
            }

            await trackApiCost({ service: 'apify', action: 'google_maps_scrape', estimated_cost_usd: 0.05 })

            const formattedItems = items
                .filter((item: any) => !item.permanentlyClosed)
                .map((item: any) => ({
                    name: item.title || item.name || '',
                    address: item.address || item.street || '',
                    city: city,
                    rating: item.totalScore || null,
                    reviewCount: item.reviewsCount || null,
                    website: item.website || null,
                    phone: item.phone || null,
                    email: item.email || null,
                    category: item.categoryName || category,
                    noWebsiteConfirmed: !item.website,
                }))

            // Store in cache
            if (supabase) {
                try {
                    await supabase.from('research_cache').upsert({
                        cache_key: cacheKey,
                        raw_data: formattedItems,
                        city,
                        category,
                        created_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    })
                } catch (e) {
                    console.error('[Cache] Failed to store results', e)
                }
            }

            return formattedItems
        }

        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
            log(`[Apify] Run ended with status: ${status} — Details: ${JSON.stringify(pollData?.data)}`)
            return []
        }

        // Still RUNNING or READY — keep polling
    }

    log('[Apify] Polling timed out after 3 minutes')
    return []
}


/**
 * Contact Info Scraper
 */
export async function enrichContacts(urls: string[]): Promise<EnrichedContact[]> {
    if (urls.length === 0) return []
    try {
        const results = await runActorAndGetResults<any>('vdrmota~contact-info-scraper', {
            startUrls: urls.map(url => ({ url })),
            maxRequestsPerStartUrl: 3,
            maxDepth: 1,
        })

        return results.map(item => ({
            url: item.url || '',
            emails: item.emails || [],
            phones: item.phones || item.phoneNumbers || [],
            socials: [item.facebook, item.twitter, item.instagram, item.linkedin].filter(Boolean) as string[],
        }))
    } catch (err: any) {
        console.error(`[Apify] Enrichment failed: ${err.message}`)
        return []
    }
}

/**
 * Active Website Verification via Google Search
 */
export async function verifyLeadWebsite(businessName: string, city: string): Promise<string | null> {
    try {
        const results = await runActorAndGetResults<any>('apify/google-search-scraper', {
            queries: [`${businessName} official website ${city}`],
            maxPagesPerQuery: 1,
            resultsPerPage: 3,
            mobileResults: false,
            includeUnfilteredResults: false,
            saveHtml: false,
            saveHtmlToKeyValueStore: false,
        })

        if (results.length > 0 && results[0].organicResults) {
            const organic = results[0].organicResults as any[]
            const excludes = ['yelp.com', 'tripadvisor.com', 'facebook.com', 'instagram.com', 'yellowpages.com', 'grubhub.com', 'ubereats.com', 'door-dash.com']
            for (const res of organic) {
                const url = res.url.toLowerCase()
                if (!excludes.some(domain => url.includes(domain))) {
                    return res.url
                }
            }
        }
        return null
    } catch (err: any) {
        console.error(`[Apify] Verification failed: ${err.message}`)
        return null
    }
}
