/**
 * Apify Client — Lightweight wrapper around Apify REST API.
 *
 * Two main functions:
 *   - scrapeGoogleMaps()  → Google Maps Scraper (compass/crawler-google-places)
 *   - enrichContacts()    → Contact Info Scraper (vdrmota/contact-info-scraper)
 */

const APIFY_BASE = 'https://api.apify.com/v2'

function getToken(): string {
    const token = process.env.APIFY_TOKEN
    if (!token) throw new Error('APIFY_TOKEN is not set in environment variables.')
    return token
}

// ─── Types ────────────────────────────────────────────────────────

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

// ─── Run Actor & Wait for Dataset ─────────────────────────────────

async function runActorAndGetResults<T>(
    actorId: string,
    input: Record<string, unknown>,
    timeoutMs = 120_000
): Promise<T[]> {
    const token = getToken()

    // 1. Start the actor run
    const runRes = await fetch(
        `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }
    )

    if (!runRes.ok) {
        const err = await runRes.text()
        throw new Error(`Apify actor start failed (${runRes.status}): ${err}`)
    }

    const runData = await runRes.json()
    const runId: string = runData.data.id

    // 2. Poll until finished
    const deadline = Date.now() + timeoutMs
    let status = runData.data.status

    while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
        if (Date.now() > deadline) {
            throw new Error(`Apify run ${runId} timed out after ${timeoutMs / 1000}s`)
        }
        await new Promise((r) => setTimeout(r, 3000))

        const pollRes = await fetch(
            `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
        )
        const pollData = await pollRes.json()
        status = pollData.data.status
    }

    if (status !== 'SUCCEEDED') {
        throw new Error(`Apify run ${runId} ended with status: ${status}`)
    }

    // 3. Fetch dataset items
    const datasetId = runData.data.defaultDatasetId
    const itemsRes = await fetch(
        `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`
    )

    if (!itemsRes.ok) {
        throw new Error(`Failed to fetch dataset: ${itemsRes.status}`)
    }

    return itemsRes.json() as Promise<T[]>
}

import { trackApiCost } from './cost-tracker'

export async function scrapeGoogleMaps(
    query: string,
    location: string,
    maxResults = 20,
    supabase?: any
): Promise<GoogleMapsLead[]> {
    const MAX_RETRIES = 3
    const dateStr = new Date().toISOString().split('T')[0]
    const cacheKey = `${location.toLowerCase()}_${query.toLowerCase()}_${dateStr}`

    // 1. Check Cache
    if (supabase) {
        try {
            const { data: cacheRow } = await supabase
                .from('research_cache')
                .select('raw_data')
                .eq('city', location.toLowerCase())
                .eq('category', query.toLowerCase())
                .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (cacheRow && cacheRow.raw_data) {
                console.log(`[Apify] Cache hit for ${query} in ${location}. Skipping scrape.`)
                return cacheRow.raw_data as GoogleMapsLead[]
            }
        } catch (e) {
            console.warn(`[Apify] Cache check failed, proceeding to scrape.`)
        }
    }

    // 2. Perform Discovery Passes
    let finalLeads: GoogleMapsLead[] = []

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Apify] Pass 1 (General): "${query}" in "${location}" (attempt ${attempt}/${MAX_RETRIES})`)
            const inputGeneral = {
                searchStringsArray: [query],
                locationQuery: location,
                maxCrawledPlacesPerSearch: maxResults,
                language: 'en',
                deeperCityScrape: false,
                skipClosedPlaces: true,
            }
            const rawGeneral = await runActorAndGetResults<Record<string, any>>('compass~crawler-google-places', inputGeneral)
            await trackApiCost({ service: 'apify', action: 'google_maps_scrape_general', estimated_cost_usd: 0.05 })

            console.log(`[Apify] Pass 2 (No Website): "${query} complete" in "${location}"`)
            const inputNoWeb = {
                searchStringsArray: [`${query} no website`],
                locationQuery: location,
                maxCrawledPlacesPerSearch: Math.max(10, Math.floor(maxResults / 2)),
                language: 'en',
                deeperCityScrape: false,
                skipClosedPlaces: true,
            }
            const rawNoWeb = await runActorAndGetResults<Record<string, any>>('compass~crawler-google-places', inputNoWeb)
            await trackApiCost({ service: 'apify', action: 'google_maps_scrape_noweb', estimated_cost_usd: 0.03 })

            // Process No Web leads
            const noWebSet = new Set<string>()
            const noWebLeads = rawNoWeb.map((item) => {
                const name = item.title || item.name || 'Unknown'
                noWebSet.add(name.toLowerCase())
                return {
                    name,
                    address: item.address || item.street || null,
                    phone: item.phone || item.phoneUnformatted || null,
                    email: item.email || null,
                    website: item.website || null,
                    rating: item.totalScore ?? item.rating ?? null,
                    reviewCount: item.reviewsCount ?? item.reviews ?? null,
                    category: item.categoryName || item.category || null,
                    city: location,
                    noWebsiteConfirmed: true,
                }
            })

            // Process General leads
            const generalLeads = rawGeneral.map((item) => {
                const name = item.title || item.name || 'Unknown'
                const isNoWeb = noWebSet.has(name.toLowerCase()) || (!item.website)
                return {
                    name,
                    address: item.address || item.street || null,
                    phone: item.phone || item.phoneUnformatted || null,
                    email: item.email || null,
                    website: item.website || null,
                    rating: item.totalScore ?? item.rating ?? null,
                    reviewCount: item.reviewsCount ?? item.reviews ?? null,
                    category: item.categoryName || item.category || null,
                    city: location,
                    noWebsiteConfirmed: isNoWeb,
                }
            })

            // Merge deduplicate
            const allLeads = [...noWebLeads, ...generalLeads]
            const uniqueMap = new Map<string, GoogleMapsLead>()
            allLeads.forEach(l => {
                if (!uniqueMap.has(l.name.toLowerCase())) {
                    uniqueMap.set(l.name.toLowerCase(), l)
                }
            })

            finalLeads = Array.from(uniqueMap.values())

            // 3. Save to Cache
            if (supabase) {
                try {
                    await supabase.from('research_cache').upsert({
                        cache_key: cacheKey,
                        city: location.toLowerCase(),
                        category: query.toLowerCase(),
                        raw_data: finalLeads,
                        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                    })
                } catch (e) {
                    console.warn(`[Apify] Failed to save to cache.`)
                }
            }
            return finalLeads

        } catch (err: any) {
            console.error(`[Apify] Scrape attempt ${attempt} failed: ${err.message}`)
            if (attempt === MAX_RETRIES) {
                console.error(`[Apify] All ${MAX_RETRIES} attempts failed. Returning empty.`)
                return []
            }
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)))
        }
    }
    return []
}

// ─── Contact Info Enrichment ──────────────────────────────────────

export async function enrichContacts(
    urls: string[]
): Promise<EnrichedContact[]> {
    const MAX_RETRIES = 3

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Apify] Enriching ${urls.length} URLs (attempt ${attempt}/${MAX_RETRIES})`)

            const input = {
                startUrls: urls.map((url) => ({ url })),
                maxRequestsPerStartUrl: 3,
                maxDepth: 1,
            }

            const raw = await runActorAndGetResults<Record<string, any>>(
                'vdrmota~contact-info-scraper',
                input
            )

            return raw.map((item) => ({
                url: item.url || '',
                emails: item.emails || [],
                phones: item.phones || item.phoneNumbers || [],
                socials: [
                    item.facebook,
                    item.twitter,
                    item.instagram,
                    item.linkedin,
                ].filter(Boolean) as string[],
            }))
        } catch (err: any) {
            console.error(`[Apify] Enrich attempt ${attempt} failed: ${err.message}`)
            if (attempt === MAX_RETRIES) return []
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)))
        }
    }
    return []
}
