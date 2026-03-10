import fs from 'fs'
import path from 'path'
import registryData from './skill-registry.json'

export interface SkillMetadata {
    skill_name: string
    description: string
    category: string
    file_path: string
}

export class SkillLoader {
    private registry: SkillMetadata[]

    constructor() {
        this.registry = registryData as SkillMetadata[]
    }

    /**
     * Filter skills by category.
     */
    public getByCategory(category: string): SkillMetadata[] {
        return this.registry.filter(s => s.category.toLowerCase() === category.toLowerCase())
    }

    /**
     * Search skills based on keywords in name, description, or category.
     * Ranks results based on number of keyword matches.
     */
    public search(query: string, limit: number = 5): SkillMetadata[] {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

        if (terms.length === 0) return []

        const scored = this.registry.map(skill => {
            let score = 0
            const searchableText = `${skill.skill_name} ${skill.description} ${skill.category}`.toLowerCase()

            for (const term of terms) {
                if (skill.skill_name.toLowerCase().includes(term)) score += 3
                else if (skill.category.toLowerCase().includes(term)) score += 2
                else if (skill.description.toLowerCase().includes(term)) score += 1
            }

            return { skill, score }
        })

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.skill)
    }

    /**
     * Load the physical Markdown content of a skill.
     */
    public loadSkillContent(skill: SkillMetadata): string {
        // Determine absolute path from the project root mapping
        const projectRoot = process.cwd()
        const absolutePath = path.join(projectRoot, skill.file_path)

        try {
            if (fs.existsSync(absolutePath)) {
                return fs.readFileSync(absolutePath, 'utf8')
            }
            throw new Error(`File not found: ${absolutePath}`)
        } catch (e: unknown) {
            console.error(`Failed to load skill: ${skill.skill_name}`, e)
            return `Error loading skill ${skill.skill_name}`
        }
    }

    /**
     * Get all registered skill categories.
     */
    public getCategories(): string[] {
        const cats = new Set(this.registry.map(s => s.category))
        return Array.from(cats).sort()
    }
}

export const skillLoader = new SkillLoader()
