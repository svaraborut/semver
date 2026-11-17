import { describe, expect, test } from 'bun:test'
import { formatChangelog, repoUrl } from './changelog'

const SHA_A = '9c7464b0123456789abcdef0123456789abcdef0'
const SHA_B = 'e3380af0123456789abcdef0123456789abcdef0'

describe('repoUrl', () => {
    test('joins server and repository', () => {
        expect(repoUrl({ GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r' })).toBe(
            'https://github.com/o/r'
        )
    })

    test('is null outside actions', () => {
        expect(repoUrl({ GITHUB_SERVER_URL: 'https://github.com' })).toBeNull()
        expect(repoUrl({})).toBeNull()
    })
})

describe('formatChangelog', () => {
    test('lists subjects with commit links in order', () => {
        const commits = [
            { sha: SHA_A, message: 'feat: add x\n\nBREAKING CHANGE: y' },
            { sha: SHA_B, message: 'fix: z' }
        ]
        expect(formatChangelog(commits, 'https://github.com/o/r')).toBe(
            `- feat: add x ([9c7464b](https://github.com/o/r/commit/${SHA_A}))\n` +
                `- fix: z ([e3380af](https://github.com/o/r/commit/${SHA_B}))`
        )
    })

    test('falls back to the short sha without a url', () => {
        expect(formatChangelog([{ sha: SHA_A, message: 'fix: z' }], null)).toBe('- fix: z (9c7464b)')
    })

    test('is empty without commits', () => {
        expect(formatChangelog([], 'https://github.com/o/r')).toBe('')
    })
})
