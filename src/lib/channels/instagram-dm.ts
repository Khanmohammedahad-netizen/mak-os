/**
 * Instagram DM Channel Helper
 *
 * Direct cold-DMs to unknown users from a business account are heavily rate-limited and often filtered by Meta.
 * The compliant, high-converting strategy is to leave a genuine comment on their most recent post
 * inviting them to DM the operator for the preview link.
 */

export function generateInstagramComment(
    businessName: string,
    websiteCategory: 'A' | 'B' | 'C' | 'D',
    _industryCategory?: string
): string {

    // Category C (Social Only) is the primary target for this channel
    if (websiteCategory === 'C') {
        const c_comments = [
            `Love this post! Have you thought about setting up a dedicated website for ${businessName}? I actually built a free preview of one for you, DM me if you want to see the link ✌️`,
            `Great feed! Your work definitely deserves its own website instead of just IG. I put together a quick mockup of what one could look like, shoot me a DM if you're curious!`,
            `Awesome content! Noticed you don't have a direct website linked yet—I made a free preview of one for ${businessName} that could bring in more bookings. DM me and I'll send you the link! 🔥`
        ]
        return c_comments[Math.floor(Math.random() * c_comments.length)]
    }

    // Category B (Outdated)
    if (websiteCategory === 'B') {
        const b_comments = [
            `Great post! Heads up, I was looking at your site and it isn't loading right on phones. I made a quick preview of a mobile-friendly upgrade, DM me if you want to see it!`,
            `Love your work! I noticed the ${businessName} website is a bit tough to navigate on mobile. Built a free preview of a modernized version, shoot me a DM if you want the link.`
        ]
        return b_comments[Math.floor(Math.random() * b_comments.length)]
    }

    // Category A (No Website, but somehow has Insta)
    const a_comments = [
        `Love what you're doing here — have you thought about having a site people can find you on Google? Would love to show you a preview I made, DM me!`,
        `Great profile! I noticed ${businessName} doesn't show up on a Google search with a website yet. I built a free preview of what one could look like, DM me to check it out.`
    ]
    return a_comments[Math.floor(Math.random() * a_comments.length)]
}

/**
 * Note: Actual execution of these comments via the Graph API requires an Instagram Business Account
 * linked to a Facebook Page, and approval for the 'instagram_manage_comments' permission.
 * In the MVP phase, this acts as a generator for the operator to manually copy/paste if desired,
 * or serves as the foundation for the automated Graph API integration.
 */
