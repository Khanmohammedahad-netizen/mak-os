import { createSupabaseServerClient } from './supabase/server'

interface CostEntry {
    service: 'apify' | 'hunter' | 'apollo' | 'claude' | 'zoho'
    action: string
    estimated_cost_usd: number
    pipeline_run_id?: string
}

/**
 * Logs an API call's estimated cost to the database.
 * Does not block execution if the logging fails.
 */
export async function trackApiCost(entry: CostEntry): Promise<void> {
    try {
        // Fallback to anonymous service client if not in a request context
        let supabase;
        try {
            supabase = createSupabaseServerClient()
        } catch {
            return; // Can't log cost without a context here currently, though a service role client would be better
        }

        await supabase.from('api_cost_log').insert([{
            service: entry.service,
            action: entry.action,
            estimated_cost_usd: entry.estimated_cost_usd,
            pipeline_run_id: entry.pipeline_run_id || null
        }])

    } catch (error) {
        console.error('[CostTracker] Failed to record API cost:', error)
    }
}

/**
 * Calculates current day's estimated cost to prevent budget overruns.
 * Default budget cap is $10.00 as defined in Section 15.
 */
export async function checkDailyBudgetCap(supabase: any, budgetCap = 10.00): Promise<{ overBudget: boolean, currentSpend: number }> {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data, error } = await supabase
            .from('api_cost_log')
            .select('estimated_cost_usd')
            .gte('called_at', today.toISOString())

        if (error) {
            console.error('[CostTracker] Error fetching daily costs:', error)
            return { overBudget: false, currentSpend: 0 } // Fail open
        }

        const currentSpend = data.reduce((acc: number, log: any) => acc + (log.estimated_cost_usd || 0), 0)

        if (currentSpend >= budgetCap) {
            console.warn(`[CostTracker] CRITICAL: Daily budget cap ($${budgetCap}) reached! Current spend: $${currentSpend.toFixed(2)}`)
            return { overBudget: true, currentSpend }
        }

        if (currentSpend >= budgetCap * 0.8) {
            console.warn(`[CostTracker] WARNING: Approaching daily budget cap. Current spend: $${currentSpend.toFixed(2)}`)
        }

        return { overBudget: false, currentSpend }
    } catch (error) {
        console.error('[CostTracker] Failed to check budget cap:', error)
        return { overBudget: false, currentSpend: 0 }
    }
}
