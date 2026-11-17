import { getExecOutput } from '@actions/exec'
import type { Commit } from './changelog'

async function git(...args: string[]): Promise<string> {
    const { exitCode, stdout, stderr } = await getExecOutput('git', args, { silent: true, ignoreReturnCode: true })
    if (exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${stderr.trim() || stdout.trim()}`)
    return stdout.trim()
}

function lines(output: string): string[] {
    return output.split('\n').map(line => line.trim()).filter(Boolean)
}

// actions/checkout defaults to a depth 1 clone without tags.
export async function ensureHistory(): Promise<void> {
    const shallow = (await git('rev-parse', '--is-shallow-repository')) === 'true'
    if (shallow) await git('fetch', '--unshallow', '--tags', '--force', 'origin')
    else await git('fetch', '--tags', '--force', 'origin')
}

export async function headSha(): Promise<string> {
    return git('rev-parse', 'HEAD')
}

export async function mergedTags(): Promise<string[]> {
    return lines(await git('tag', '--merged', 'HEAD', '--list', 'v*'))
}

export async function headTags(): Promise<string[]> {
    return lines(await git('tag', '--points-at', 'HEAD', '--list', 'v*'))
}

// Newest first. Records are NUL separated, the sha and message are split by a unit separator.
export async function commits(since: string | null): Promise<Commit[]> {
    const range = since ? `${since}..HEAD` : 'HEAD'
    const output = await git('log', '--format=%H%x1f%B%x00', range)
    return output
        .split('\0')
        .map(record => record.trim())
        .filter(Boolean)
        .map(record => {
            const [sha = '', message = ''] = record.split('\x1f')
            return { sha, message: message.trim() }
        })
}

// Lightweight tags avoid requiring a configured git user identity on the runner.
export async function pushRelease(tag: string, aliases: string[]): Promise<void> {
    await git('tag', tag)
    try {
        await git('push', 'origin', `refs/tags/${tag}`)
    } catch (error) {
        throw new Error(`Could not push ${tag}, it may already exist on another commit. ${(error as Error).message}`)
    }
    if (aliases.length === 0) return
    for (const alias of aliases) await git('tag', '--force', alias)
    await git('push', '--force', 'origin', ...aliases.map(alias => `refs/tags/${alias}`))
}
