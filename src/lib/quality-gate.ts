export type EmailTone = 'professional' | 'conversational' | 'curiosity'
export type VariantId = 'A' | 'B' | 'C'

export interface EmailVariant {
    variant_id: VariantId
    subject: string
    body: string
    word_count: number
    tone: EmailTone
}

export interface GateResult {
    business_name: string
    selected_variant: VariantId | null
    selected_subject: string | null
    selected_body: string | null
    gate_result: 'pass' | 'conditional' | 'fail'
    scores: Record<VariantId, GateScores>
    follow_up_variant: VariantId | null
    follow_up_subject: string | null
    follow_up_body: string | null
    regeneration_reasons: string[]
}

export interface GateScores {
    specificity: number
    spam: number
    readability: number
    length: number
    subject: number
    average: number
}

const SPAM_TRIGGERS = [
    'free', 'guarantee', 'guaranteed', 'risk-free', 'no obligation',
    'act now', 'limited time', 'click here', 'make money', 'earn money',
    "you've been selected", 'congratulations', 'urgent', 'important notice',
    'winner', 'prize', '!!!', '$$$'
]

const SUBJECT_SPAM_TRIGGERS = [
    'free', 'guaranteed', 'no obligation', 'act now',
    'limited time', 'click here', '!!!', '$$$',
    'you have been selected', 'congratulations',
    'make money', 'earn money', 'risk free'
]

const FORBIDDEN_PHRASES = [
    'i came across', 'i stumbled upon', 'just reaching out',
    'hope this finds you well', 'quick question', 'touching base'
]

// Rough Flesch-Kincaid Grade Level approximation
function estimateGradeLevel(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1
    const words = text.split(/\s+/).filter(w => w.trim().length > 0).length || 1
    const syllables = text.split(/\s+/).reduce((acc, word) => {
        const count = word.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]{1,2}/g)?.length || 0
        return acc + (count === 0 ? 1 : count)
    }, 0)

    const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
    return grade
}

function scoreSpecificity(body: string, businessName: string, city: string): number {
    let count = 0
    if (body.toLowerCase().includes(businessName.toLowerCase())) count++
    if (body.toLowerCase().includes(city.toLowerCase())) count++
    // We assume the generator included the issue, we just check if it's not generic
    if (body.length > 50) count++

    if (count === 3) return 10
    if (count === 2) return 7
    return 4
}

function scoreSpam(body: string, subject: string): number {
    const text = (body + ' ' + subject).toLowerCase()
    let triggers = 0

    SPAM_TRIGGERS.forEach(t => { if (text.includes(t)) triggers++ })
    FORBIDDEN_PHRASES.forEach(t => { if (text.includes(t)) triggers++ })

    // Check for ALL CAPS words > 4 chars
    const words = text.split(/\s+/)
    words.forEach(w => {
        if (w.length > 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) triggers++
    })

    if (triggers === 0) return 10
    if (triggers <= 2) return 7
    return 3
}

function scoreReadability(body: string): number {
    const grade = estimateGradeLevel(body)
    if (grade >= 6 && grade <= 8.5) return 10
    if (grade >= 5 && grade <= 10) return 8
    return 4
}

function scoreLength(words: number, tone: EmailTone): number {
    let min = 0, max = 0
    if (tone === 'professional') { min = 150; max = 180 }
    else if (tone === 'conversational') { min = 120; max = 150 }
    else { min = 100; max = 130 }

    if (words >= min && words <= max) return 10
    if (words >= min - 20 && words <= max + 20) return 7
    return 4
}

function scoreSubject(subject: string, businessName: string, city: string): number {
    const words = subject.trim().split(/\s+/).length
    const lower = subject.toLowerCase()
    let score = 10

    if (words < 4 || words > 9) score -= 4
    if (lower.includes('website')) score -= 5
    if (SUBJECT_SPAM_TRIGGERS.some(t => lower.includes(t)) || lower.includes('urgent')) score -= 8
    if (subject !== subject.toLowerCase() && subject === subject.toUpperCase()) score -= 5
    if (subject.includes('!')) score -= 4

    // mustBeSpecific: must contain business name or city
    const hasBusiness = lower.includes(businessName.toLowerCase())
    const hasCity = lower.includes(city.toLowerCase())
    if (!hasBusiness && !hasCity) score -= 5

    return Math.max(1, score)
}

export function evaluateVariants(
    businessName: string,
    city: string,
    variants: EmailVariant[]
): GateResult {
    const scores: Record<VariantId, GateScores> = {} as any
    const reasons: string[] = []

    variants.forEach(v => {
        const spec = scoreSpecificity(v.body, businessName, city)
        const spam = scoreSpam(v.body, v.subject)
        const read = scoreReadability(v.body)
        const len = scoreLength(v.word_count, v.tone)
        const sub = scoreSubject(v.subject, businessName, city)

        const avg = Number(((spec + spam + read + len + sub) / 5).toFixed(1))

        scores[v.variant_id] = {
            specificity: spec,
            spam,
            readability: read,
            length: len,
            subject: sub,
            average: avg
        }

        if (avg < 7.0) {
            reasons.push(`Variant ${v.variant_id} failed: Average score ${avg} is below 7.0`)
        }
    })

    // Sort variants by highest average
    const sorted = [...variants].sort((a, b) => scores[b.variant_id].average - scores[a.variant_id].average)

    const bestVariant = sorted[0]
    const runnerUp = sorted[1]

    const bestScore = scores[bestVariant.variant_id].average

    let resultStatus: 'pass' | 'conditional' | 'fail' = 'fail'
    if (bestScore >= 8.0) resultStatus = 'pass'
    else if (bestScore >= 7.0) resultStatus = 'conditional'

    if (resultStatus === 'fail') {
        return {
            business_name: businessName,
            selected_variant: null,
            selected_subject: null,
            selected_body: null,
            gate_result: 'fail',
            scores,
            follow_up_variant: null,
            follow_up_subject: null,
            follow_up_body: null,
            regeneration_reasons: reasons
        }
    }

    return {
        business_name: businessName,
        selected_variant: bestVariant.variant_id,
        selected_subject: bestVariant.subject,
        selected_body: bestVariant.body,
        gate_result: resultStatus,
        scores,
        follow_up_variant: runnerUp ? runnerUp.variant_id : null,
        follow_up_subject: runnerUp ? runnerUp.subject : null,
        follow_up_body: runnerUp ? runnerUp.body : null,
        regeneration_reasons: reasons
    }
}
