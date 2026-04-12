/**
 * Outreach Engine — Fully autonomous 7-stage pipeline.
 *
 * Stage 1: ResearchAgent      → Scrape businesses via Apify Google Maps
 * Stage 2: LeadFinderAgent    → Filter chains, validate, compute priority
 * Stage 3: WebsiteAuditAgent  → Check website existence
 * Stage 4: ContactEnrichment  → Find emails via Apify contact scraper
 * Stage 5: MarketingAgent     → Generate personalized outreach message
 * Stage 6: AutomationAgent    → Send email via Brevo API (or flag for phone)
 * Stage 7: CRM Update         → Update Supabase lead status + log activity
 */

import { scrapeGoogleMaps, enrichContacts, verifyLeadWebsite, type GoogleMapsLead } from './apify'
import { buildOutreachVariants } from './zoho-mail'
import { sendOutreachEmail } from './email/service'
import { getDailyLimit, getDelayBetweenEmails } from './email/warmup-schedule'
import { isSuppressed } from './email/bounce-handler'
import { evaluateVariants } from './quality-gate'
import { checkDailyBudgetCap } from './cost-tracker'
import { validateGCCPhone } from './utils/phone-validation'

// ─── Types ────────────────────────────────────────────────────────

export interface OutreachResult {
    discovered: number
    qualified: number
    enriched: number
    emailsSent: number
    whatsappSent?: number
    phoneRequired: number
    queued?: number
    errors: number
    logs: string[]
    onLog?: (msg: string) => void
}

export type AuditCategory = 'A - Needs Website' | 'B - Outdated' | 'C - Facebook Only' | 'D - Good Website'

export type PriorityLane = 'hot' | 'warm' | 'cold' | 'rejected'

interface QualifiedLead extends GoogleMapsLead {
    priorityScore: number
    priorityLane: PriorityLane
    auditCategory?: AuditCategory
    opportunitySummary?: string
    country?: string
    status?: string
}

// ─── Chain Blacklist ──────────────────────────────────────────────

const CHAIN_BLACKLIST = [
    'starbucks', 'mcdonalds', 'subway', 'burger king', 'kfc',
    'pizza_hut', 'dominos', 'chipotle', 'dunkin', 'wendys',
    'taco bell', 'popeyes', 'chick-fil-a', 'panda express',
    'five guys', 'jack in the box', 'sonic', 'arbys', 'ihop',
    'applebees', 'olive garden', 'red lobster', 'outback',
    'panera', 'jimmy johns', 'jersey mikes', 'dairy queen',
    'papa johns', 'little caesars', 'buffalo wild wings',
    'texas roadhouse', 'chilis', 'dennys', 'waffle house',
    'carls jr', 'hardees', 'in-n-out', 'whataburger', 'shake shack',
    'smashburger', 'baskin robbins', 'cold stone', 'smoothie king',
    'jamba juice', 'planet fitness', 'crunch fitness', 'la fitness',
    'anytime fitness', 'gold\'s gym', 'equinox', 'orange theory',
    'supercuts', 'great clips', 'sport clips', 'regis', 'cost cutters',
    'f45', 'pure barre', 'club pilates', 'massage envy', 'european wax',
    'pep boys', 'jiffy lube', 'valvoline', 'midas', 'firestone'
]

const PLACEHOLDER_PATTERNS = [
    'example.com', 'test.com', 'demo.com', 'sample', 'mock', 'fallback',
]

function isFranchise(name: string): boolean {
    const lowerName = name.toLowerCase()
    if (CHAIN_BLACKLIST.some(chain => lowerName.includes(chain))) return true
    if (lowerName.includes('nationwide') || lowerName.includes('franchise') || lowerName.includes('chain')) return true
    if (lowerName.includes('locations across') || /\d+\s*locations/.test(lowerName)) return true
    return false
}

// ─── Stage 2: Priority Scoring (Weighted out of 10) ───────────────

function computePriority(lead: GoogleMapsLead, filter?: string): number {
    // Component 1 - Rating (max 3.0)
    let ratingScore = 0.5
    if (lead.rating) {
        if (lead.rating >= 4.5) ratingScore = 3.0
        else if (lead.rating >= 4.0) ratingScore = 2.5
        else if (lead.rating >= 3.5) ratingScore = 2.0
        else if (lead.rating >= 3.0) ratingScore = 1.5
    }

    // Component 2 - Review Count (max 2.0)
    let reviewScore = 0.0
    const rc = lead.reviewCount || 0
    if (rc >= 100) reviewScore = 2.0
    else if (rc >= 50) reviewScore = 1.75
    else if (rc >= 20) reviewScore = 1.5
    else if (rc >= 10) reviewScore = 1.0
    else if (rc >= 5) reviewScore = 0.5

    // Component 3 - Recency (max 1.5) -> approximated since Apify doesn't reliably return date
    let recencyScore = 0.0
    if (rc >= 50) recencyScore = 1.5 // Active business proxy
    else if (rc >= 10) recencyScore = 1.0
    else if (rc > 0) recencyScore = 0.5

    // Component 4 - Digital Presence Gap (max 2.0)
    let gapScore = 0.0
    const hasWeb = !!lead.website
    const socialWeb = hasWeb && (lead.website!.includes('facebook.com') || lead.website!.includes('instagram.com'))

    if (lead.noWebsiteConfirmed && !hasWeb) gapScore = 2.0
    else if (!hasWeb) gapScore = 1.75
    else if (socialWeb) gapScore = 1.75
    else gapScore = 1.0 // Base score for having a site before audit

    // --- Dynamic Filter Priority ---
    if (filter?.toLowerCase().includes('without a website')) {
        if (!hasWeb || socialWeb) {
            gapScore += 2.0 // Boost for matching user's specific constraint
        } else {
            gapScore -= 5.0 // Heavily deprioritize if they have a website but user wanted those without
        }
    }

    // Component 5 - Category Multiplier (max 1.0)
    let catScore = 0.5
    if (lead.category) {
        const cat = lead.category.toLowerCase()
        if (cat.includes('clinic') || cat.includes('law') || cat.includes('contractor') || cat.includes('dentist')) catScore = 1.0
        else if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('salon') || cat.includes('barber')) catScore = 0.85
        else if (cat.includes('gym') || cat.includes('retail') || cat.includes('repair')) catScore = 0.75
    }

    // Component 6 - Google Maps Claimed Bonus (max 0.5)
    const claimedScore = 0.5 // Default to unclaimed bonus for this version

    return Number((ratingScore + reviewScore + recencyScore + gapScore + catScore + claimedScore).toFixed(1))
}


function getPriorityLane(score: number, noWebConfirmed: boolean): PriorityLane {
    if (score < 7.0) return 'rejected'
    if (score >= 9.0 && noWebConfirmed) return 'hot'
    if (score >= 8.0) return 'warm'
    return 'cold'
}

// ─── Stage 3: Website Audit Classification ────────────────────────

function auditWebsite(lead: GoogleMapsLead): { category: AuditCategory; summary: string } {
    const businessName = lead.name
    const city = lead.city || 'your area'

    if (!lead.website || lead.noWebsiteConfirmed) {
        return {
            category: 'A - Needs Website',
            summary: `Needs Website - Potential Client: ${businessName} doesn't currently have a verified website – they're losing foot traffic to competitors who show up in search results in ${city}.`
        }
    }

    const url = lead.website.toLowerCase()

    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('tiktok.com')) {
        return {
            category: 'C - Facebook Only',
            summary: `${businessName} is currently using social media instead of a dedicated website. While social media is great for updates, customers in ${city} rely on professional websites to find menus, services, and booking options easily.`
        }
    }

    // Basic heuristic: builder sub-domain, lacks https
    if (url.includes('.wixsite.com') || url.includes('.weebly.com') || url.includes('.wordpress.com') || url.startsWith('http://')) {
        return {
            category: 'B - Outdated',
            summary: `The current ${businessName} website is running on an outdated platform, which means it likely loads slowly on mobile devices and drops your ranking in ${city} local search results.`
        }
    }

    // Otherwise assume it's a "Good" website
    return {
        category: 'D - Good Website',
        summary: `Website appears modern and functional.`
    }
}

// ─── Stage 4: Contact Enrichment Waterfall ──────────────────────────

async function enrichContactWaterfall(lead: QualifiedLead, supabase: any, fastLog: (msg: string) => void): Promise<string | null> {
    // Stage 4.1: Directory Check
    if (lead.email) {
        fastLog(`[Stage 4] ${lead.name}: Email already available via Directory (${lead.email})`)
        return lead.email
    }

    let domain: string | null = null
    if (lead.website && lead.website.startsWith('http')) {
        try {
            domain = new URL(lead.website).hostname.replace('www.', '')
        } catch { /* ignore malformed urls */ }
    }

    // Stage 4.2: Cache Check
    if (domain && supabase) {
        try {
            const { data: cached } = await supabase.from('email_cache').select('email').eq('domain', domain).single()
            if (cached?.email) {
                fastLog(`[Stage 4] ${lead.name}: Found email in Cache (${cached.email})`)
                return cached.email
            }
        } catch (e) {
            // No cache hit or error
        }
    }

    // Stage 4.3: Website / Social Scrape Check
    if (lead.website) {
        try {
            const contacts = await enrichContacts([lead.website])
            if (contacts.length > 0 && contacts[0].emails && contacts[0].emails.length > 0) {
                const foundEmail = contacts[0].emails[0]
                fastLog(`[Stage 4] ${lead.name}: Found email via Website Scraper (${foundEmail})`)

                if (domain && supabase) {
                    await supabase.from('email_cache').upsert({
                        domain, email: foundEmail, confidence: 'verified', source: 'website'
                    })
                }
                return foundEmail
            }
        } catch (e) {
            fastLog(`[Stage 4] ${lead.name}: Website scraper fallback failed`)
        }
    }

    // Stage 4.4: Removed Pattern Guessing (v1.2 Policy: No placeholder fabrication)
    fastLog(`[Stage 4] ${lead.name}: No verified email found -> website search required`)
    return null
}

// ─── Get Owner ID ─────────────────────────────────────────────────

async function getOwnerId(supabase: any): Promise<string | null> {
    try {
        const { data } = await supabase.auth.admin.listUsers()
        return data?.users?.[0]?.id || null
    } catch {
        return null
    }
}

// ─── Main Pipeline ────────────────────────────────────────────────

export async function runOutreachPipeline(
    categoryOrCategories: string | string[],
    city: string,
    supabase: any,
    options: { maxResults?: number; dryRun?: boolean; queuedMode?: boolean; filter?: string; onLog?: (msg: string) => void } = {}
): Promise<OutreachResult> {
    const { maxResults = 20, dryRun = false, queuedMode = false, filter, onLog } = options

    const categories = Array.isArray(categoryOrCategories) ? categoryOrCategories : [categoryOrCategories]
    const logs: string[] = []

    const fastLog = (msg: string) => {
        logs.push(msg)
        if (onLog) {
            try { onLog(msg); } catch (e) { console.error('onLog error:', e); }
        }
    }

    const result: OutreachResult = {
        discovered: 0, qualified: 0, enriched: 0,
        emailsSent: 0, phoneRequired: 0, errors: 0, logs,
    }

    try {
        // Get owner_id for DB inserts (required NOT NULL field)
        const ownerId = await getOwnerId(supabase)
        if (!ownerId) {
            fastLog(`[Pipeline] Warning: Could not find owner_id, inserts may fail`)
        }

        // ─── Stage 0: Budget Cap Check ──────────────
        const budgetCap = parseFloat(process.env.DAILY_BUDGET_CAP || '1.00')
        const { overBudget, currentSpend } = await checkDailyBudgetCap(supabase, budgetCap)
        if (overBudget) {
            fastLog(`[Budget] CRITICAL: Daily cap of $${budgetCap.toFixed(2)} reached. Spend: $${currentSpend.toFixed(2)}. Halting pipeline.`)
            result.errors++
            return result
        }

        // ─── Stage 1: ResearchAgent — Scrape ──────────────
        const rawLeads: GoogleMapsLead[] = []
        const MAX_TOTAL_LEADS = categories.length > 1 ? 100 : maxResults

        if (categories.length > 1) {
            fastLog(`[Stage 1] ResearchAgent: Searching ${categories.length} categories in ${city}...`)

            for (const cat of categories) {
                try {
                    // For multi-category, we fetch a smaller number per category but cap the total
                    const catLeads = await scrapeGoogleMaps(cat, city, 100, supabase, fastLog as any)
                    rawLeads.push(...catLeads)
                    fastLog(`[Stage 1] ${cat} → ${catLeads.length} found`)

                    if (rawLeads.length >= MAX_TOTAL_LEADS) break
                } catch (e: any) {
                    fastLog(`[Stage 1] Error searching for ${cat}: ${e.message}`)
                }
            }
        } else {
            fastLog(`[Stage 1] ResearchAgent: Scraping "${categories[0]}" in "${city}"`)
            const singleCatLeads = await scrapeGoogleMaps(categories[0], city, maxResults, supabase, fastLog as any)
            rawLeads.push(...singleCatLeads)
        }

        // De-duplicate by URL or Name+Phone
        const uniqueLeads = Array.from(new Map(
            rawLeads.map(item => [item.website || `${item.name}-${item.phone}`, item])
        ).values()).slice(0, MAX_TOTAL_LEADS)

        result.discovered = uniqueLeads.length
        fastLog(`[Stage 1] Total: ${uniqueLeads.length} businesses discovered`)

        // ─── Stage 2: LeadFinderAgent — Qualify ───────────
        fastLog(`[Stage 2] LeadFinderAgent: Qualifying leads...`)
        const qualified: QualifiedLead[] = []
        let discardedCount = 0

        for (const lead of uniqueLeads) {
            // Chain filter
            if (isFranchise(lead.name)) {
                fastLog(`[Stage 2] Filtered chain/franchise: ${lead.name}`)
                discardedCount++
                continue
            }

            // Data validation
            if (!lead.name || !lead.city) {
                discardedCount++
                continue
            }

            // Placeholder rejection
            const hasPlaceholder = [lead.name, lead.email || '', lead.website || '', lead.phone || '']
                .some(v => PLACEHOLDER_PATTERNS.some(p => v.toLowerCase().includes(p)))
            if (hasPlaceholder) {
                discardedCount++
                continue
            }

            const priorityScore = computePriority(lead, filter)

            const priorityLane = getPriorityLane(priorityScore, !!lead.noWebsiteConfirmed)

            if (priorityLane === 'rejected') {
                discardedCount++
                continue
            }

            qualified.push({ ...lead, priorityScore, priorityLane })
        }

        // Sort by priority (highest first)
        qualified.sort((a, b) => b.priorityScore - a.priorityScore)

        // Process up to 50 qualified leads per category
        const MAX_TO_ENRICH = categories.length * 50;
        const topQualified = qualified.slice(0, MAX_TO_ENRICH);

        result.qualified = topQualified.length
        fastLog(`[Stage 2] ${topQualified.length} qualified leads kept (cost-optimization limit) - Discarded raw: ${discardedCount + (qualified.length - topQualified.length)}`)

        if (topQualified.length === 0) {
            fastLog(`[Stage 2] No qualified leads found. Pipeline complete.`)
            return result
        }

        // ─── Stage 3: WebsiteAuditAgent — Check websites ─
        fastLog(`[Stage 3] WebsiteAuditAgent: Auditing websites...`)
        const websiteQualified: typeof qualified = []

        for (const lead of topQualified) {
            // Stage 3.1: Active Website Verification (v1.2)
            if (!lead.website || lead.noWebsiteConfirmed) {
                const verifiedUrl = await verifyLeadWebsite(lead.name, lead.city || city)
                if (verifiedUrl) {
                    lead.website = verifiedUrl
                    lead.noWebsiteConfirmed = false
                    fastLog(`[Stage 3] ${lead.name}: Website found via active verification → ${verifiedUrl}`)
                }
            }

            // Stage 3.2: Perform Website Audit
            const audit = auditWebsite(lead)

            if (audit.category === 'D - Good Website') {
                fastLog(`[Stage 3] ${lead.name}: Has good website → Skipping`)
                continue
            }

            fastLog(`[Stage 3] ${lead.name}: ${audit.category}`)

            websiteQualified.push({
                ...lead,
                auditCategory: audit.category,
                opportunitySummary: audit.summary
            } as any) // Type handled in next step
        }

        // ─── Stage 4: ContactEnrichmentAgent ──────────────
        fastLog(`[Stage 4] ContactEnrichmentAgent: Enriching contacts...`)

        // Get rate limit status based on Warm-up schedule
        const startDate = new Date(process.env.EMAIL_ACCOUNT_START_DATE || '2026-03-01')
        const ageDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        // Let Render override if specified, otherwise default to 50
        let DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '50', 10)
        if (process.env.DAILY_EMAIL_LIMIT === '0' || !process.env.DAILY_EMAIL_LIMIT) {
            DAILY_LIMIT = getDailyLimit(ageDays)
        }
        console.log(`[EmailBudget] Daily limit: ${DAILY_LIMIT} emails (DAILY_EMAIL_LIMIT env: ${process.env.DAILY_EMAIL_LIMIT || 'not set, using warmup schedule'})`)
        const delayMinutes = getDelayBetweenEmails(ageDays)

        const dailySent = await getDailySentCount(supabase)
        const remaining = Math.max(0, DAILY_LIMIT - dailySent)
        fastLog(`[Stage 4] Daily email budget: ${remaining}/${DAILY_LIMIT} remaining (Age: ${ageDays} days)`)

        // Only enrich leads we can actually contact today
        const leadsToProcess = websiteQualified.slice(0, remaining || websiteQualified.length)

        for (const lead of leadsToProcess) {
            const foundEmail = await enrichContactWaterfall(lead, supabase, fastLog)
            if (foundEmail) {
                lead.email = foundEmail
                result.enriched++
                lead.status = 'enriched'
            } else {
                // --- Enrichment Failure Transition ---
                const validation = validateGCCPhone(lead.phone, lead.city || city)
                
                if (validation.status === 'bad_data') {
                    fastLog(`[Stage 4] ${lead.name}: Bad phone format for ${lead.city || city} → Resetting phone`)
                    lead.phone = null
                    lead.status = 'bad_data'
                } else if (validation.status === 'wa_ready') {
                    fastLog(`[Stage 4] ${lead.name}: No email but valid GCC phone → Marked for WhatsApp`)
                    lead.status = 'wa_pending' // Custom internal state before final send
                } else {
                    fastLog(`[Stage 4] ${lead.name}: Unreachable (No email, no valid phone)`)
                    lead.status = 'unreachable'
                }
                
                result.phoneRequired++
            }
        }

        // ─── Stages 5-7: Generate, Send, Log ─────────────
        // ─── Stages 5-7: Generate, Send, Log ─────────────
        for (let i = 0; i < leadsToProcess.length; i++) {
            const lead = leadsToProcess[i]

            // ─── Duplicate Detection ─────────────────────
            const { data: existing } = await supabase
                .from('leads')
                .select('id')
                .eq('company', lead.name)
                .eq('city', lead.city || city)
                .limit(1)
                .single()

            if (existing) {
                fastLog(`[CRM] Skipped duplicate: ${lead.name} (${lead.city || city})`)
                continue
            }

            // Insert lead into Supabase
            const leadRecord: Record<string, any> = {
                company: lead.name,
                email: lead.email || null,
                phone: lead.phone || null,
                city: lead.city || city,
                category: lead.category || categories[0],
                website: lead.website || null,
                source: 'Google Maps',
                priority_score: Math.round(lead.priorityScore),
                contact_method: lead.email ? (queuedMode ? 'queued' : 'email') : 'website search required',
                website_category: lead.auditCategory,
                opportunity_summary: lead.opportunitySummary,
            }

            if (ownerId) leadRecord.owner_id = ownerId

            const { data: inserted, error: insertErr } = await supabase
                .from('leads')
                .insert(leadRecord)
                .select('id')
                .single()

            if (insertErr || !inserted) {
                fastLog(`[CRM] Insert error for ${lead.name}: ${insertErr?.message || 'Unknown'}`)
                result.errors++
                continue
            }

            const leadId = inserted.id

            if (queuedMode && lead.email) {
                fastLog(`[Pipeline] Queued email outreach for ${lead.name} (${lead.email})`)
                result.queued = (result.queued || 0) + 1
                continue
            }

            // --- DEPRECATED: Synchronous Sending below is now only used for Dry Runs or force-direct ---
            if (lead.email && !dryRun && !queuedMode) {
                // Check rate limit dynamically
                const currentCount = await getDailySentCount(supabase)
                if (currentCount >= DAILY_LIMIT) {
                    fastLog(`[Stage 6] Warm-up Limit reached (${DAILY_LIMIT}). Queued email for ${lead.name}.`)
                    result.queued = (result.queued || 0) + 1
                    continue
                }

                // Stage 5 & 6: MarketingAgent & Quality Gate
                const variants = buildOutreachVariants({
                    company: lead.name,
                    city: lead.city || city,
                    category: lead.category,
                    auditCategory: lead.auditCategory,
                    opportunitySummary: lead.opportunitySummary,
                })

                const gate = evaluateVariants(lead.name, lead.city || city, variants)

                if (gate.gate_result === 'fail' || !gate.selected_variant) {
                    fastLog(`[Stage 6] QualityGate failed for ${lead.name} - blocked send`)
                    result.errors++
                    continue
                }

                if (gate.gate_result === 'conditional') {
                    fastLog(`[Stage 6] QualityGate flagged conditional for ${lead.name} - skipped auto-send`)
                    continue
                }

                fastLog(`[Stage 5] MarketingAgent: Generated outreach for ${lead.name} (${gate.selected_variant} passed gate)`)

                try {
                    const resultMail = await sendOutreachEmail({
                        to: lead.email,
                        subject: gate.selected_subject!,
                        body: gate.selected_body!,
                        fromEmail: process.env.OUTREACH_FROM_EMAIL
                    })

                    if (!resultMail.success) {
                        throw new Error(resultMail.error || 'Failed sending via Unified Service')
                    }

                    fastLog(`[Automation] Email sent to ${lead.name} via ${resultMail.provider.toUpperCase()}`)
                    result.emailsSent++

                    await supabase.from('leads').update({
                        status: 'contacted',
                        contacted_at: new Date().toISOString(),
                        email_sent_at: new Date().toISOString(),
                        email_status: 'sent',
                        message_id: resultMail.messageId,
                        outreach_message: gate.selected_body!.substring(0, 500),
                        contact_method: 'emailed',
                    }).eq('id', leadId)

                    // Logs...
                    await supabase.from('outreach_log').insert({
                        lead_id: leadId,
                        business_name: lead.name,
                        email_address: lead.email,
                        touch_number: 1,
                        subject: gate.selected_subject,
                        body: gate.selected_body,
                        send_status: 'sent',
                        sent_at: new Date().toISOString(),
                        sequence_status: 'active',
                        variant_used: gate.selected_variant,
                        gate_score: (gate.scores as any)[gate.selected_variant!].average
                    }).catch(() => { })

                } catch (sendErr: any) {
                    fastLog(`[Stage 7] Email failed for ${lead.name}: ${sendErr.message}`)
                    result.errors++
                    await supabase.from('leads').update({ contact_method: 'email_failed' }).eq('id', leadId)
                }
            } else if ((!lead.email && lead.phone && !dryRun) || lead.status === 'wa_pending') {
                // WhatsApp Fallback
                fastLog(`[Outreach] Found phone but no email for ${lead.name} — routing to WhatsApp...`)
                
                try {
                    const { triggerWhatsAppOutreach } = await import('./actions/whatsapp-outreach')
                    const waResult = await triggerWhatsAppOutreach({
                        id: leadId,
                        name: lead.name,
                        city: lead.city || city,
                        country: lead.country || undefined,
                        phone: lead.phone!,
                        business_type: lead.category || undefined,
                        pain_point: lead.opportunitySummary
                    })

                    if (waResult.success) {
                        fastLog(`[WhatsApp] Outreach sent to ${lead.name} (${lead.phone})`)
                        result.whatsappSent = (result.whatsappSent || 0) + 1
                    } else {
                        fastLog(`[WhatsApp] Outreach failed or pending (Sender Offline/Error): ${waResult.error}`)
                        result.phoneRequired++
                    }
                } catch (waErr: any) {
                    fastLog(`[WhatsApp] Integration error: ${waErr.message}`)
                    result.phoneRequired++
                }
            } else if (dryRun) {
                fastLog(`[Stage 5] [DRY RUN] Would email ${lead.name} at ${lead.email || 'N/A'}`)
            }
        } // End of leadsToProcess loop

        fastLog(``)
        fastLog(`Workflow completed`)
        fastLog(`Qualified leads discovered: ${result.qualified}`)
        if (result.whatsappSent && result.whatsappSent > 0) {
            fastLog(`WhatsApp outreach sent: ${result.whatsappSent}`)
        }
        if (queuedMode) {
            fastLog(`Outreach queued: ${result.queued || 0} leads`)
            fastLog(`Background worker will process one email every 10 minutes to protect domain reputation.`)
        } else {
            fastLog(`Outreach emails sent: ${result.emailsSent}`)
        }
        fastLog(`Phone outreach required: ${result.phoneRequired}`)
        if (result.errors > 0) fastLog(`Errors: ${result.errors}`)

        return result
    } catch (err: any) {
        fastLog(`[Pipeline] Fatal error: ${err.message}`)
        result.errors++
        return result
    }
}

// ─── Daily Rate Limit Helper ──────────────────────────────────────

async function getDailySentCount(supabase: any): Promise<number> {
    try {
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)

        const { count, error } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('contact_method', 'emailed')
            .gte('contacted_at', todayStart.toISOString())

        if (error) {
            const { count: fallbackCount } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('contact_method', 'emailed')
            return fallbackCount || 0
        }

        return count || 0
    } catch {
        return 0
    }
}
