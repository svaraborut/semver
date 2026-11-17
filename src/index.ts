import * as core from '@actions/core'
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

async function finalize(files: string[], version: string, tag: string, prerelease: boolean): Promise<void> {
    for (const file of files) await updateVersionFile(file, version)
    core.info(`Version ${version}, updated ${files.length} files`)
    core.setOutput('version', version)
    core.setOutput('tag', tag)
    core.setOutput('prerelease', prerelease)
}

async function run(): Promise<void> {
    const inputs = {
        preview: core.getBooleanInput('preview'),
        files: getListInput('files'),
        previewFormat: core.getInput('preview-format') || '{{VERSION}}-rc{{COUNT}}',
        aliases: getEnumListInput<Alias>('aliases', ALIASES),
        minimumBump: getEnumInput<Bump>('minimum-bump', BUMPS, 'patch')
    }

    // Ensure git history is present
    await git.ensureHistory()

    // A tagged HEAD means a re-run, so reuse its version instead of bumping again.
    const current = latestVersion(await git.headTags())
    if (current) {
        const version = formatVersion(current.version)
        core.info(`HEAD is already tagged ${current.tag}, reusing it`)
        await finalize(inputs.files, version, current.tag, false)
        return
    }

    const previous = latestVersion(await git.mergedTags())
    const messages = await git.commitMessages(previous?.tag ?? null)
    const bump = determineBump(messages, inputs.minimumBump)
    const next = bumpVersion(previous?.version ?? ZERO, bump)
    core.info(`Previous ${previous?.tag ?? 'none'}, ${messages.length} commits, ${bump} bump`)

    if (inputs.preview) {
        const version = renderTemplate(inputs.previewFormat, {
            version: next,
            count: messages.length,
            sha: await git.headSha()
        })
        await finalize(inputs.files, version, `v${version}`, true)
        return
    }

    const version = formatVersion(next)
    const tag = `v${version}`
    await finalize(inputs.files, version, tag, false)
    await git.pushRelease(
        tag,
        inputs.aliases.map(alias => aliasTag(alias, next))
    )
    core.info(`Pushed ${tag}`)
}

run().catch(error => core.setFailed(error instanceof Error ? error.message : String(error)))
