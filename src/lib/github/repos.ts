import { getInstallationOctokit } from './app'
import { withGithubRetry, GithubApiError } from './retry'
import sodium from 'libsodium-wrappers'

export interface CreateRepoParams {
    templateOwner: string
    templateRepo: string
    newName: string
    description?: string
    isPrivate?: boolean
}

export interface SetRepoTopicsParams {
    repo: string
    names: string[]
}

export interface SetRepoSecretParams {
    repo: string
    secretName: string
    secretValue: string
}

function getOrg(): string {
    const org = process.env.GITHUB_ORG
    if (!org) {
        throw new Error('Missing required environment variable: GITHUB_ORG')
    }
    return org
}

export async function listOrgRepos() {
    const octokit = await getInstallationOctokit()
    const org = getOrg()

    return withGithubRetry(async () => {
        const response = await octokit.rest.repos.listForOrg({
            org,
            type: 'all',
            per_page: 100,
        })
        return response.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            html_url: repo.html_url,
            description: repo.description,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            clone_url: repo.clone_url,
            topics: repo.topics || [],
            is_template: repo.is_template || false,
        }))
    })
}

export async function createRepoFromTemplate(params: CreateRepoParams) {
    const octokit = await getInstallationOctokit()
    const org = getOrg()

    return withGithubRetry(async () => {
        const response = await octokit.rest.repos.createUsingTemplate({
            template_owner: params.templateOwner,
            template_repo: params.templateRepo,
            owner: org,
            name: params.newName,
            description: params.description,
            private: params.isPrivate ?? true,
        })
        return response.data
    })
}

export async function setRepoTopics(params: SetRepoTopicsParams) {
    const octokit = await getInstallationOctokit()
    const org = getOrg()

    return withGithubRetry(async () => {
        const response = await octokit.rest.repos.replaceAllTopics({
            owner: org,
            repo: params.repo,
            names: params.names,
        })
        return response.data
    })
}

export async function getRepoPublicKey(repo: string) {
    const octokit = await getInstallationOctokit()
    const org = getOrg()

    return withGithubRetry(async () => {
        const response = await octokit.rest.actions.getRepoPublicKey({
            owner: org,
            repo,
        })
        return response.data
    })
}

export async function encryptSecret(secret: string, publicKey: string): Promise<string> {
    await sodium.ready
    const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL)
    const binsec = sodium.from_string(secret)
    const encBytes = sodium.crypto_box_seal(binsec, binkey)
    return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)
}

export async function setRepoSecrets(params: SetRepoSecretParams) {
    const octokit = await getInstallationOctokit()
    const org = getOrg()

    const publicKeyData = await getRepoPublicKey(params.repo)
    if (!publicKeyData || !publicKeyData.key || !publicKeyData.key_id) {
        throw new GithubApiError('Failed to retrieve repository public key.')
    }

    const encryptedValue = await encryptSecret(params.secretValue, publicKeyData.key)

    return withGithubRetry(async () => {
        const response = await octokit.rest.actions.createOrUpdateRepoSecret({
            owner: org,
            repo: params.repo,
            secret_name: params.secretName,
            encrypted_value: encryptedValue,
            key_id: publicKeyData.key_id,
        })
        return response.data
    })
}
