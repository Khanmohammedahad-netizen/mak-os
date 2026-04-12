interface CallScriptInput {
    businessName: string
    city: string
    websiteCategory: 'A' | 'B' | 'C' | 'D'
    opportunitySummary?: string
    operatorName?: string
}

export function generateCallScript(input: CallScriptInput): string {
    const operator = input.operatorName || 'Mohammed'

    return `
Hi, is this ${input.businessName}?

Great — my name is ${operator}, I'm a web developer based in the area. I was actually looking up local businesses online and I noticed something I thought was worth a quick call about.

${getIssueStatement(input.websiteCategory, input.businessName, input.city)}

I'm specialized in helping businesses in ${input.city} capture more customers by optimizing their digital footprint. I'm not trying to sell you anything right now, I just want to know if you'd be open to a quick 5-minute chat about how we can help.

Is that something you'd be interested in?

[IF YES]: Perfect, I'll send you an email with some more details and we can go from there. Have a great day!

[IF NO]: Totally understand. I'll leave you to it — have a great day either way!

[VOICEMAIL]: Hi, this is ${operator}, I'm a local web developer. I was checking out ${input.businessName}'s online presence and noticed a few ways you could be getting more traffic. No strings attached — I just wanted to reach out. Feel free to call me back if you're interested. Thanks!
`
}

function getIssueStatement(category: string, name: string, city: string): string {
    switch (category) {
        case 'A':
            return `I noticed that ${name} doesn't currently rely on a dedicated website, which means when people in ${city} search for your specific services online, they might be missing out on finding you directly.`
        case 'B':
            return `I was looking at ${name}'s website and noticed it doesn't display optimally on mobile phones, which is how most people search for businesses these days.`
        case 'C':
            return `I saw ${name} has some great information up online, but without a dedicated central website, you might be missing out on direct Google search traffic in ${city}.`
        default:
            return `I noticed a few things about ${name}'s online presence in ${city} that you might want to look into just to maximize your digital footprint.`
    }
}

export async function initiateAICall(
    phoneNumber: string,
    script: string,
    leadId: string,
    voice: string = 'maya'
): Promise<{ success: boolean; callId?: string; disabled?: boolean }> {

    if (process.env.BLAND_AI_ENABLED !== 'true') {
        console.log('[AICallAgent] Calls disabled — set BLAND_AI_ENABLED=true to enable')
        return { success: false, disabled: true }
    }

    if (!process.env.BLAND_AI_API_KEY) {
        console.error('[AICallAgent] BLAND_AI_API_KEY is not set')
        return { success: false }
    }

    try {
        const response = await fetch('https://api.bland.ai/v1/calls', {
            method: 'POST',
            headers: {
                'Authorization': process.env.BLAND_AI_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone_number: phoneNumber,
                task: script,
                voice: voice,
                reduce_latency: true,
                max_duration: 2, // Hard limit to 2 minutes to conserve balance
                record: false,
                webhook: `${process.env.NEXT_PUBLIC_APP_URL || 'https://maksoftware.io'}/api/webhooks/call-outcome`,
                metadata: { lead_id: leadId, business_name: extractBusinessName(script) }
            })
        })

        const data = await response.json()

        return {
            success: !!data.call_id,
            callId: data.call_id
        }
    } catch (e) {
        console.error('[AICallAgent] Trigger failed:', e)
        return { success: false }
    }
}

function extractBusinessName(script: string): string {
    const match = script.match(/is this (.+)\?/)
    return match ? match[1] : 'the business'
}
