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

/**
 * Common City Resolver for International Support
 */
function resolveCityName(city: string): string {
    const cityMap: Record<string, string> = {
        'chicago': 'Chicago, IL, USA',
        'houston': 'Houston, TX, USA',
        'dallas': 'Dallas, TX, USA',
        'miami': 'Miami, FL, USA',
        'new york': 'New York, NY, USA',
        'nyc': 'New York, NY, USA',
        'la': 'Los Angeles, CA, USA',
        'los angeles': 'Los Angeles, CA, USA',
        'phoenix': 'Phoenix, AZ, USA',
        'denver': 'Denver, CO, USA',
        'seattle': 'Seattle, WA, USA',
        'atlanta': 'Atlanta, GA, USA',
        'boston': 'Boston, MA, USA',
        'dubai': 'Dubai, United Arab Emirates',
        'abu dhabi': 'Abu Dhabi, United Arab Emirates',
        'mumbai': 'Mumbai, Maharashtra, India',
        'delhi': 'New Delhi, India',
        'london': 'London, United Kingdom',
        'toronto': 'Toronto, Ontario, Canada',
    }

    return cityMap[city.toLowerCase()] || `${city}, USA`
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

/**
 * Reliable Google Maps Scraper
 */
export async function scrapeGoogleMaps(
    category: string,
    city: string,
    maxResults = 20,
    supabase?: any
): Promise<GoogleMapsLead[]> {
    // Debug Mode (Save Credits)
    if (process.env.APIFY_DEBUG === 'true') {
        console.log('[Apify] DEBUG MODE — returning mock data')
        return [
            {
                name: `Test ${category} in ${city}`,
                address: '123 Main St',
                city: city,
                rating: 4.3,
                reviewCount: 45,
                website: null,
                phone: '+17135550100',
                email: null,
                category: category,
                noWebsiteConfirmed: true
            }
        ]
    }

    const cityResolved = resolveCityName(city)
    const searchString = `${category} in ${cityResolved}`

    try {
        const items = await runActorAndGetResults<any>(ACTOR_ID, {
            searchStringsArray: [searchString],
            maxCrawledPlacesPerSearch: maxResults,
            language: 'en',
            maxImages: 0,
            maxReviews: 0,
            scrapeReviewerInfo: false,
            scrapeTableReservationProvider: false,
            skipClosedPlaces: false,
        })

        await trackApiCost({ service: 'apify', action: 'google_maps_scrape', estimated_cost_usd: 0.05 })

        return items
            .filter(item => !item.permanentlyClosed)
            .map(item => ({
                name: item.title || item.name || 'Unknown',
                address: item.address || item.street || null,
                phone: item.phone || item.phoneNumber || null,
                email: item.email || null,
                website: item.website || null,
                rating: item.totalScore || item.rating || null,
                reviewCount: item.reviewsCount || item.reviews || null,
                category: item.categoryName || item.category || category,
                city: city,
                noWebsiteConfirmed: !item.website
            }))
    } catch (err: any) {
        console.error(`[Apify] Scrape failed: ${err.message}`)
        return []
    }
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
