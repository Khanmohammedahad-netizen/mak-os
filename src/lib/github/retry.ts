export class GithubApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public response?: any
    ) {
        super(message)
        this.name = 'GithubApiError'
    }
}

export async function withGithubRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let attempt = 0

    while (attempt < maxRetries) {
        try {
            return await operation()
        } catch (error: any) {
            attempt++

            if (attempt >= maxRetries) {
                throw new GithubApiError(
                    error.message || 'GitHub API operation failed after maximum retries.',
                    error.status,
                    error.response
                )
            }

            const status = error.status || error.response?.status

            // Handle Rate Limit (403 or 429)
            if (status === 403 || status === 429) {
                const headers = error.response?.headers || {}
                const getHeader = (key: string) => {
                    const foundKey = Object.keys(headers).find(k => k.toLowerCase() === key.toLowerCase())
                    return foundKey ? headers[foundKey] : undefined
                }
                const resetTimeStr = getHeader('x-ratelimit-reset')
                if (resetTimeStr) {
                    const resetTime = parseInt(resetTimeStr, 10)
                    if (!isNaN(resetTime)) {
                        const delayMs = Math.max(0, (resetTime * 1000) - Date.now())
                        if (delayMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, delayMs + 1000))
                            continue
                        }
                    }
                }
            }

            // Exponential backoff for 5xx server errors or unhandled rate limits
            if (status >= 500 || status === 403 || status === 429) {
                const backoffDelay = Math.pow(2, attempt) * 1000
                await new Promise(resolve => setTimeout(resolve, backoffDelay))
                continue
            }

            // Throw immediately on client errors (400, 401, 404, etc.)
            throw new GithubApiError(
                error.message || 'GitHub API error.',
                error.status,
                error.response
            )
        }
    }

    throw new GithubApiError('GitHub API operation failed unexpectedly.')
}
