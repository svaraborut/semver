import * as core from '@actions/core'
import { formatChangelog, repoUrl } from './changelog'
import { updateVersionFile } from './files'
import * as git from './git'
import {
    ALIASES,
    BUMPS,
    ZERO,
    aliasTag,
    bumpVersion,
    determineBump,
    formatVersion,
    latestVersion,
    renderTemplate,
    type Alias,
    type Bump
} from './version'
import { getEnumInput, getEnumListInput, getListInput } from './input.ts'
import { savePendingRelease } from './state'

// `step` pushes tags inside this step, `job` defers the push to the post step after the job succeeds.
const PUSHES = ['step', 'job'] as const
type Push = (typeof PUSHES)[number]

interface Outputs {
    version: string
    tag: string
    prerelease: boolean
    changelog: string
}

async function finalize(files: string[], outputs: Outputs): Promise<void> {
    for (const file of files) await updateVersionFile(file, outputs.version)
    core.info(`Version ${outputs.version}, updated ${files.length} files`)
    core.setOutput('version', outputs.version)
    core.setOutput('tag', outputs.tag)
    core.setOutput('prerelease', outputs.prerelease)
    core.setOutput('changelog', outputs.changelog)
}

async function run(): Promise<void> {
    const inputs = {
        preview: core.getBooleanInput('preview'),
        files: getListInput('files'),
        previewFormat: core.getInput('preview-format') || '{{VERSION}}-rc{{COUNT}}',
        aliases: getEnumListInput<Alias>('aliases', ALIASES),
        minimumBump: getEnumInput<Bump>('minimum-bump', BUMPS, 'patch'),
        push: getEnumInput<Push>('push', PUSHES, 'step')
    }

    // Ensure git history is present
    await git.ensureHistory()

    // HEAD's own tags are excluded so a tagged HEAD still gets the changelog since the previous version.
    const headTags = await git.headTags()
    const previous = latestVersion((await git.mergedTags()).filter(tag => !headTags.includes(tag)))
    const commits = await git.commits(previous?.tag ?? null)
    const changelog = formatChangelog(commits, repoUrl(process.env))

    // A tagged HEAD means a re-run, so reuse its version instead of bumping again.
    const current = latestVersion(headTags)
    if (current) {
        const version = formatVersion(current.version)
        core.info(`HEAD is already tagged ${current.tag}, reusing it`)
        await finalize(inputs.files, { version, tag: current.tag, prerelease: false, changelog })
        return
    }

    const messages = commits.map(commit => commit.message)
    const bump = determineBump(messages, inputs.minimumBump)
    const next = bumpVersion(previous?.version ?? ZERO, bump)
    core.info(`Previous ${previous?.tag ?? 'none'}, ${messages.length} commits, ${bump} bump`)

    if (inputs.preview) {
        const version = renderTemplate(inputs.previewFormat, {
            version: next,
            count: messages.length,
            sha: await git.headSha()
        })
        await finalize(inputs.files, { version, tag: `v${version}`, prerelease: true, changelog })
        return
    }

    const version = formatVersion(next)
    const tag = `v${version}`
    const aliases = inputs.aliases.map(alias => aliasTag(alias, next))
    await git.createTags(tag, aliases)
    await finalize(inputs.files, { version, tag, prerelease: false, changelog })

    if (inputs.push === 'job') {
        savePendingRelease({ tag, aliases })
        core.info(`Tagged ${tag}, pushing after the job succeeds`)
        return
    }
    await git.pushTags(tag, aliases)
    core.info(`Pushed ${tag}`)
}

run().catch(error => core.setFailed(error instanceof Error ? error.message : String(error)))
