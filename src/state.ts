import * as core from '@actions/core'

// Tags created by the main step and pushed by the post step when `push` is `job`.
export interface PendingRelease {
    tag: string
    aliases: string[]
}

const KEY = 'release'

export function savePendingRelease(release: PendingRelease): void {
    core.saveState(KEY, JSON.stringify(release))
}

export function loadPendingRelease(): PendingRelease | null {
    const raw = core.getState(KEY)
    return raw ? (JSON.parse(raw) as PendingRelease) : null
}
