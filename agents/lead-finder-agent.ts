import { BaseAgent, type TaskInput, type AgentResult } from './base-agent'

export class LeadFinderAgent extends BaseAgent {
    constructor() {
        super(
            'LeadFinderAgent',
            ['research', 'marketing'],
            `You are a Lead Generation Specialist for MAK Software Solutions.
Your mission is to identify, qualify, and score potential business leads.

Core capabilities:
- Market research and competitor analysis
- Google Maps scraping strategy (via Apify)
- Contact enrichment (via Apollo/Hunter)
- ICP (Ideal Customer Profile) matching
- Lead scoring based on firmographic data
- Outbound sequence planning

You operate with precision. Every lead must be validated before entering the pipeline.
Never fabricate contact information. Always verify enrichment data.`
        )
    }

    /**
     * Specialized entry point with lead-specific parameters.
     */
    public findLeads(query: string, region?: string, industry?: string): AgentResult {
        return this.execute({
            description: `Find and qualify leads matching: "${query}"`,
            parameters: { region, industry, source: 'google_maps_apify' },
        })
    }
}

export const leadFinderAgent = new LeadFinderAgent()
