import { Opportunity } from '@/app/dashboard/pipeline/kanban-board'

/**
 * Basic sentiment classification for inbound replies.
 * In a real implementation, this could call an LLM.
 */
function classifyReplySentiment(replyBody: string): 'positive' | 'question' | 'negative' | 'neutral' {
    const lower = replyBody.toLowerCase()
    if (lower.match(/interested|yes|sure|tell me more|how much|let's talk|call me/)) return 'positive'
    if (lower.match(/\?|how|what|why|when/)) return 'question'
    if (lower.match(/no|not interested|stop|unsubscribe|remove/)) return 'negative'
    return 'neutral'
}

function getFirstName(fullName: string | null): string | null {
    if (!fullName) return null
    return fullName.split(' ')[0]
}

function generateAnswerToQuestion(replyBody: string, opp: Opportunity): string {
    // Placeholder for AI answering logic based on the specific question.
    return `We specialize in ${opp.city || 'local'} businesses, providing everything from design to hosting and Google Maps optimization.`
}

/**
 * Generates a draft email response when moving a lead from NEW REPLY to FOLLOW UP.
 */
export async function draftFollowUpResponse(
    opp: Opportunity,
    replyBody: string
): Promise<string> {
    const sentiment = classifyReplySentiment(replyBody)

    // Using opp.business_name as fallback if contact_name isn't in Opportunity yet
    const name = getFirstName(opp.business_name) || 'there'

    if (sentiment === 'positive') {
        return `Hi ${name},

Thanks for getting back to me — really glad to hear from you.

I'd love to show you a few examples of websites I've built for similar businesses in ${opp.city || 'your area'}. Would you be open to a quick 15-minute call this week so I can understand what you're looking for?

I have availability Tuesday and Thursday afternoon — does either work for you?

Best,
Mohammed Ahad
MAK Software Solutions
maksoftwaresolutions.com`
    }

    if (sentiment === 'question' || sentiment === 'neutral') {
        return `Hi ${name},

Great question — happy to explain.

${generateAnswerToQuestion(replyBody, opp)}

Would it make sense to jump on a quick call so I can show you some examples? Takes 15 minutes and you'd have a much clearer picture of what's possible.

Best,
Mohammed Ahad
MAK Software Solutions
maksoftwaresolutions.com`
    }

    return '' // No automatic draft for negative replies
}

/**
 * Generates a simple one-page text proposal template.
 */
export function generateProposal(opp: Opportunity, callNotes: string = ''): string {
    return `
WEBSITE PROPOSAL
For: ${opp.business_name}${opp.city ? `, ${opp.city}` : ''}
From: MAK Software Solutions
Date: ${new Date().toLocaleDateString()}

────────────────────────────────────────

WHAT WE'LL BUILD

${callNotes ? `Based on our call: \n${callNotes}\n` : ''}
A professional, mobile-first website for ${opp.business_name} that:
- Appears in Google search when customers look for your services${opp.city ? ` in ${opp.city}` : ''}
- Loads in under 2 seconds on any device
- Includes: Homepage, About, Services, Contact form, Google Maps embed
- SSL secured, mobile responsive, SEO optimized

TIMELINE
Week 1: Project kickoff and initial design layout
Week 2: Build and revise
Week 3: Launch + Google indexing

INVESTMENT
Starter Website:    $500 one-time
Business Website:   $1,200 one-time
Premium Website:    $2,500 one-time

All packages include: 1 month free support after launch
Optional: Monthly maintenance from $99/month

────────────────────────────────────────

To proceed, simply reply to this email with the package you'd like and I'll send a simple contract and invoice.

Mohammed Ahad
MAK Software Solutions
maksoftwaresolutions.com
`
}
