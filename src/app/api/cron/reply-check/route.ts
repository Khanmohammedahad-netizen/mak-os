import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret, cronUnauthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return cronUnauthorized()
    }

    // Since MAK OS v1 uses a live Zoho Webhook (api/webhooks/zoho/route.ts) 
    // for instant reply detection, this cron job serves as a health check 
    // and fallback. True polling requires IMAP which is slower than webhooks.

    return NextResponse.json({
        status: 'complete',
        mode: 'webhook_driven',
        message: 'Reply detection is handled instantly via Zoho Webhook.'
    })
}
