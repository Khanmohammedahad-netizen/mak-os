import { NextRequest, NextResponse } from 'next/server'

export function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
        console.error('CRON_SECRET environment variable is not set')
        return false
    }

    return authHeader === `Bearer ${cronSecret}`
}

export function cronUnauthorized(): NextResponse {
    return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
    )
}
