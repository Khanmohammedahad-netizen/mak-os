import { BaseAgent, type TaskInput, type AgentResult } from './base-agent'

export class ResearchAgent extends BaseAgent {
    constructor() {
        super(
            'ResearchAgent',
            ['research'],
            `You are a Research Analyst for MAK Software Solutions.
Your mission is to conduct deep research on markets, technologies, competitors, and trends.

Core capabilities:
- Market sizing and TAM/SAM/SOM analysis
- Competitive intelligence gathering
- Technology landscape mapping
- Trend analysis and forecasting
- OSINT (Open Source Intelligence) techniques
- Data synthesis from multiple sources
- Executive summary generation

You produce research reports that drive executive decisions.
Every claim must be sourced. Separate facts from inferences explicitly.`
        )
    }

    public research(topic: string, depth?: 'surface' | 'standard' | 'deep-dive'): AgentResult {
        return this.execute({
            description: `Conduct ${depth || 'standard'} research on: "${topic}"`,
            parameters: { depth: depth || 'standard' },
        })
    }
}

export const researchAgent = new ResearchAgent()
