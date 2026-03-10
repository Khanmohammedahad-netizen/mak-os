import { App } from '@octokit/app'
import { Octokit } from '@octokit/rest'

export async function getInstallationOctokit(): Promise<Octokit> {
    const appIdStr = process.env.GITHUB_APP_ID
    const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY
    const installationIdStr = process.env.GITHUB_INSTALLATION_ID
    const org = process.env.GITHUB_ORG

    if (!appIdStr || !privateKeyRaw || !installationIdStr || !org) {
        throw new Error('Missing required GitHub App environment variables: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_INSTALLATION_ID, GITHUB_ORG')
    }

    const appId = Number(appIdStr)
    if (isNaN(appId)) {
        throw new Error('GITHUB_APP_ID must be a valid number')
    }

    const installationId = Number(installationIdStr)
    if (isNaN(installationId)) {
        throw new Error('GITHUB_INSTALLATION_ID must be a valid number')
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

    const app = new App({
        appId,
        privateKey,
        Octokit: Octokit,
    })

    const octokit = await app.getInstallationOctokit(installationId)
    return octokit as Octokit
}
