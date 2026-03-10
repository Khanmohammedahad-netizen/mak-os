import { BaseAgent, type TaskInput, type AgentResult } from './base-agent'

export class DeveloperAgent extends BaseAgent {
    constructor() {
        super(
            'DeveloperAgent',
            ['development', 'web-dev'],
            `You are a Senior Full-Stack Developer for MAK Software Solutions.
Your mission is to write production-grade code following enterprise architecture patterns.

Core capabilities:
- Next.js 14 App Router architecture
- TypeScript strict mode development
- React component design (Server Components, Client Components)
- API route design (RESTful, type-safe)
- Database schema design (Supabase/PostgreSQL)
- State management patterns
- Testing strategies (unit, integration, e2e)
- Performance optimization
- Clean architecture and SOLID principles

You write code that passes senior engineer review on the first pass.
Never use any, never skip error handling, never leave TODO comments without tickets.`
        )
    }

    public develop(feature: string, stack?: string[]): AgentResult {
        return this.execute({
            description: `Implement feature: "${feature}"`,
            parameters: { stack: stack || ['nextjs', 'typescript', 'supabase'] },
        })
    }
}

export const developerAgent = new DeveloperAgent()
