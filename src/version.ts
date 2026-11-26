export type Bump = 'patch' | 'minor' | 'major'

export interface Version {
    major: number
    minor: number
    patch: number
}

export const BUMPS: readonly Bump[] = ['patch', 'minor', 'major']
export const ZERO: Version = { major: 0, minor: 0, patch: 0 }

const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/
const HEADER_RE = /^\w+(\([^)]*\))?(!)?:/
const BREAKING_RE = /^BREAKING[ -]CHANGE:/m

export function parseTag(tag: string): Version | null {
    const match = TAG_RE.exec(tag.trim())
    if (!match) return null
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function compare(a: Version, b: Version): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function latestVersion(tags: string[]): { tag: string; version: Version } | null {
    let latest: { tag: string; version: Version } | null = null
    for (const tag of tags) {
        const version = parseTag(tag)
        if (version && (!latest || compare(version, latest.version) > 0)) latest = { tag, version }
    }
    return latest
}

export function commitBump(message: string): Bump {
    const header = HEADER_RE.exec(message.trim())
    if (header?.[2] || BREAKING_RE.test(message)) return 'major'
    if (header && /^feat[(!:]/.test(message.trim())) return 'minor'
    return 'patch'
}

export function determineBump(messages: string[], minimum: Bump, maximum: Bump = 'major'): Bump {
    const floor = BUMPS.indexOf(minimum)
    const ceiling = BUMPS.indexOf(maximum)
    if (floor > ceiling) throw new Error(`minimum-bump "${minimum}" is higher than maximum-bump "${maximum}"`)
    let rank = floor
    for (const message of messages) rank = Math.max(rank, BUMPS.indexOf(commitBump(message)))
    return BUMPS[Math.min(rank, ceiling)]!
}

export function bumpVersion(version: Version, bump: Bump): Version {
    if (bump === 'major') return { major: version.major + 1, minor: 0, patch: 0 }
    if (bump === 'minor') return { major: version.major, minor: version.minor + 1, patch: 0 }
    return { ...version, patch: version.patch + 1 }
}

export function formatVersion(version: Version): string {
    return `${version.major}.${version.minor}.${version.patch}`
}

export interface TemplateVars {
    version: Version
    count: number
    sha: string
}

export function renderTemplate(template: string, vars: TemplateVars): string {
    const values: Record<string, string> = {
        VERSION: formatVersion(vars.version),
        MAJOR: String(vars.version.major),
        MINOR: String(vars.version.minor),
        PATCH: String(vars.version.patch),
        COUNT: String(vars.count),
        SHA: vars.sha.slice(0, 7)
    }
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        const value = values[key]
        if (value === undefined) throw new Error(`Unknown placeholder {{${key}}} in "${template}"`)
        return value
    })
}

export type Alias = 'major' | 'minor' | 'latest'

export const ALIASES: readonly Alias[] = ['major', 'minor', 'latest']

export function aliasTag(alias: Alias, version: Version): string {
    if (alias === 'major') return `v${version.major}`
    if (alias === 'minor') return `v${version.major}.${version.minor}`
    return 'latest'
}
