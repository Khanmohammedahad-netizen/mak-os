import { SkillRouter, type AgentContext, type ActivatedSkill } from '../core/skill-router'
import { skillLoader, type SkillMetadata } from '../core/skill-loader'

export interface TaskInput {
    description: string
    parameters?: Record<string, unknown>
}

export interface AgentResult {
    agentName: string
    taskDescription: string
    activatedSkills: string[]
    systemPrompt: string
    reasoning: string[]
    status: 'ready' | 'error'
}

export abstract class BaseAgent {
    public readonly name: string
    public readonly categories: string[]
    protected readonly systemRole: string

    constructor(name: string, categories: string[], systemRole: string) {
        this.name = name
        this.categories = categories
        this.systemRole = systemRole
    }

    /**
     * Execute a task: activate skills, build system prompt, return agent result.
     */
    public execute(task: TaskInput): AgentResult {
        const reasoning: string[] = []

        // Step 1: Build agent context
        reasoning.push(`[${this.name}] Received task: "${task.description}"`)

        const context: AgentContext = {
            taskDescription: task.description,
            currentMode: 'EXECUTION',
        }

        // Step 2: Activate skills via router (semantic search across all categories)
        const routerSkills = SkillRouter.activateSkillsForTask(context, 3)
        reasoning.push(`[${this.name}] Router activated ${routerSkills.length} skills via semantic search`)

        // Step 3: Also pull category-specific skills for this agent's domain
        const categorySkills: SkillMetadata[] = []
        for (const cat of this.categories) {
            const catSkills = skillLoader.getByCategory(cat)
            categorySkills.push(...catSkills.slice(0, 2)) // Top 2 per category
        }
        reasoning.push(`[${this.name}] Loaded ${categorySkills.length} domain skills from categories: [${this.categories.join(', ')}]`)

        // Step 4: Merge and deduplicate
        const allSkillNames = new Set<string>()
        const finalSkills: ActivatedSkill[] = []

        for (const s of routerSkills) {
            if (!allSkillNames.has(s.metadata.skill_name)) {
                allSkillNames.add(s.metadata.skill_name)
                finalSkills.push(s)
            }
        }

        for (const s of categorySkills) {
            if (!allSkillNames.has(s.skill_name)) {
                allSkillNames.add(s.skill_name)
                finalSkills.push({
                    metadata: s,
                    content: skillLoader.loadSkillContent(s),
                })
            }
        }

        reasoning.push(`[${this.name}] Final activated skills (deduplicated): ${finalSkills.length}`)

        // Step 5: Build system prompt
        const systemPrompt = this.buildSystemPrompt(finalSkills, task)
        reasoning.push(`[${this.name}] System prompt assembled (${systemPrompt.length} chars)`)

        return {
            agentName: this.name,
            taskDescription: task.description,
            activatedSkills: finalSkills.map(s => s.metadata.skill_name),
            systemPrompt,
            reasoning,
            status: 'ready',
        }
    }

    /**
     * Assemble the full system prompt with role, skills, and task directive.
     */
    private buildSystemPrompt(skills: ActivatedSkill[], task: TaskInput): string {
        let prompt = `<system_role>\n${this.systemRole}\n</system_role>\n\n`

        if (skills.length > 0) {
            prompt += `<activated_skills>\n`
            prompt += `You have access to the following specialized skills. Follow their instructions:\n\n`
            for (const skill of skills) {
                prompt += `<skill name="${skill.metadata.skill_name}" category="${skill.metadata.category}">\n`
                prompt += skill.content
                prompt += `\n</skill>\n\n`
            }
            prompt += `</activated_skills>\n\n`
        }

        prompt += `<task>\n${task.description}\n`
        if (task.parameters) {
            prompt += `\nParameters:\n${JSON.stringify(task.parameters, null, 2)}\n`
        }
        prompt += `</task>\n`

        return prompt
    }
}
