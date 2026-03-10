import { skillLoader, type SkillMetadata } from './skill-loader'

export interface AgentContext {
    taskDescription: string
    currentMode: 'PLANNING' | 'EXECUTION' | 'VERIFICATION'
}

export interface ActivatedSkill {
    metadata: SkillMetadata
    content: string
}

export class SkillRouter {
    /**
     * Automatically inspects the agent context and routes the most relevant skills.
     * Provides the raw markdown content to inject into the LLM system prompt.
     */
    public static activateSkillsForTask(context: AgentContext, limit: number = 3): ActivatedSkill[] {
        const query = context.taskDescription

        // 1. Find the best matching skills
        const matches = skillLoader.search(query, limit)

        // 2. Load the content for the matches
        const activated: ActivatedSkill[] = []

        for (const match of matches) {
            const content = skillLoader.loadSkillContent(match)
            activated.push({
                metadata: match,
                content
            })
        }

        return activated
    }

    /**
     * Generates a context injection string for the AI agent.
     */
    public static generateAgentPromptInjection(context: AgentContext): string {
        const skills = this.activateSkillsForTask(context)

        if (skills.length === 0) {
            return `<!-- No specific skills activated for this task -->`
        }

        let injection = `\n<activated_skills>\n`
        injection += `You have access to the following specialized skills to help you complete your task. Follow their instructions optimally:\n\n`

        for (const skill of skills) {
            injection += `<skill name="${skill.metadata.skill_name}" category="${skill.metadata.category}">\n`
            injection += skill.content
            injection += `\n</skill>\n\n`
        }

        injection += `</activated_skills>\n`
        return injection
    }
}
