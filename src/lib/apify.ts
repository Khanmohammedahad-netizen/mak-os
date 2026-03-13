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

const CITY_MAP: Record<string, string> = {
    'chicago': 'Chicago, IL, USA',
    'houston': 'Houston, TX, USA',
    'dallas': 'Dallas, TX, USA',
    'miami': 'Miami, FL, USA',
    'new york': 'New York, NY, USA',
    'nyc': 'New York, NY, USA',
    'los angeles': 'Los Angeles, CA, USA',
    'la': 'Los Angeles, CA, USA',
    'phoenix': 'Phoenix, AZ, USA',
    'denver': 'Denver, CO, USA',
    'seattle': 'Seattle, WA, USA',
    'atlanta': 'Atlanta, GA, USA',
    'boston': 'Boston, MA, USA',
    'dubai': 'Dubai, United Arab Emirates',
    'mumbai': 'Mumbai, India',
    'london': 'London, United Kingdom',
    'toronto': 'Toronto, Canada',
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

        const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${TOKEN}`)
        const statusData = await statusRes.json()
        const status = statusData?.data?.status

        console.log(`[Apify] Poll ${i + 1}/${maxPolls} — Status: ${status}`)

        if (status === 'SUCCEEDED') {
            const resultsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${TOKEN}&clean=true`)
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
    maxResults = 15,
    supabase?: any
): Promise<GoogleMapsLead[]> {
    const TOKEN_VAR = process.env.APIFY_API_TOKEN
    if (!TOKEN_VAR) {
        console.error('[Apify] ERROR: APIFY_API_TOKEN env var is missing')
        return []
    }

    // Debug mode — returns fake data to test pipeline without Apify
    if (process.env.APIFY_DEBUG === 'true') {
        console.log('[Apify] DEBUG MODE ON — returning mock data')
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

    const resolvedCity = CITY_MAP[city.toLowerCase()] || `${city}, USA`
    const searchString = `${category} in ${resolvedCity}`
    const cacheKey = `${city.toLowerCase()}_${category.toLowerCase()}_${getWeekKey()}`

    // ── STEP 0: Check cache first ──
    if (supabase) {
        try {
            const { data: cached } = await supabase
                .from('research_cache')
                .select('raw_data')
                .eq('cache_key', cacheKey)
                .single()

            if (cached?.raw_data) {
                console.log(`[Cache] HIT for ${category} in ${city} — no Apify call needed`)
                return cached.raw_data as GoogleMapsLead[]
            }
        } catch (e) {
            // cache miss or table missing, proceed
        }
    }

    console.log(`[Cache] MISS for ${category} in ${city} — Launching scrape for: "${searchString}"`)

    // ── STEP 1: Start the actor run ──
    const startRes = await fetch(
        `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${TOKEN_VAR}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: [searchString],
                maxCrawledPlacesPerSearch: 15, // Hard limit to 15
                language: 'en',
                maxImages: 0,
                maxReviews: 0,
                scrapeReviewerInfo: false,
            }),
        }
    )

    if (!startRes.ok) {
        const errText = await startRes.text()
        console.error(`[Apify] Failed to start run. Status: ${startRes.status}`)
        console.error(`[Apify] Error: ${errText}`)
        return []
    }

    const startData = await startRes.json()
    const runId = startData?.data?.id
    const datasetId = startData?.data?.defaultDatasetId

    if (!runId) {
        console.error('[Apify] No runId returned:', JSON.stringify(startData))
        return []
    }

    console.log(`[Apify] Run started — ID: ${runId}`)

    // ── STEP 2: Poll until the run finishes ──
    // Poll every 3 seconds for up to 3 minutes (60 attempts)
    for (let attempt = 1; attempt <= 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000))

        const pollRes = await fetch(
            `${APIFY_BASE}/actor-runs/${runId}?token=${TOKEN_VAR}`
        )
        const pollData = await pollRes.json()
        const status = pollData?.data?.status

        console.log(`[Apify] Poll ${attempt}/60 — Status: ${status}`)

        if (status === 'SUCCEEDED') {
            // ── STEP 3: Fetch the results from the dataset ──
            const dataRes = await fetch(
                `${APIFY_BASE}/datasets/${datasetId}/items?token=${TOKEN_VAR}&limit=${maxResults}&clean=true`
            )

            if (!dataRes.ok) {
                console.error(`[Apify] Dataset fetch failed: ${dataRes.status}`)
                return []
            }

            const items = await dataRes.json()
            console.log(`[Apify] SUCCESS — ${items.length} businesses found`)

            if (items.length === 0) {
                console.warn(`[Apify] Run succeeded but returned 0 items for "${searchString}"`)
                console.warn('[Apify] This may mean no results exist or the search query needs adjustment')
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
            console.error(`[Apify] Run ended with status: ${status}`)
            console.error('[Apify] Run details:', JSON.stringify(pollData?.data))
            return []
        }

        // Still RUNNING or READY — keep polling
    }

    console.error('[Apify] Polling timed out after 3 minutes')
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
