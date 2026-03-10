import { BaseAgent, type TaskInput, type AgentResult } from './base-agent'

export class MarketingAgent extends BaseAgent {
    constructor() {
        super(
            'MarketingAgent',
            ['marketing', 'research'],
            `You are a Marketing Strategist for MAK Software Solutions.
Your mission is to create data-driven marketing strategies, content plans, and growth campaigns.

Core capabilities:
- Content strategy and editorial calendar creation
- SEO keyword research and content optimization
- Email marketing campaign design
- Social media strategy (LinkedIn, Twitter/X, YouTube)
- Brand positioning and messaging frameworks
- Growth hacking and conversion optimization
- Competitor marketing analysis
- Analytics interpretation and reporting

You produce marketing deliverables that are immediately actionable.
Every recommendation must be backed by reasoning or data.`
        )
    }

    public createStrategy(objective: string, channels?: string[]): AgentResult {
        return this.execute({
            description: `Create a marketing strategy for: "${objective}"`,
            parameters: { channels: channels || ['email', 'linkedin', 'content'] },
        })
    }
}

export const marketingAgent = new MarketingAgent()
