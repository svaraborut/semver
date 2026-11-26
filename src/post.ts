import * as core from '@actions/core'
import * as git from './git'
import { loadPendingRelease } from './state'

// Runs after the job only if every step succeeded (`post-if: success()` in action.yml).
async function run(): Promise<void> {
    const release = loadPendingRelease()
    if (!release) return
    await git.pushTags(release.tag, release.aliases)
    core.info(`Pushed ${release.tag}`)
}

run().catch(error => core.setFailed(error instanceof Error ? error.message : String(error)))
