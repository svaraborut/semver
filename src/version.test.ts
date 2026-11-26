import { describe, expect, test } from 'bun:test'
import { aliasTag, bumpVersion, commitBump, determineBump, latestVersion, parseTag, renderTemplate } from './version'

describe('parseTag', () => {
    test('accepts full tags only', () => {
        expect(parseTag('v3.49.13')).toEqual({ major: 3, minor: 49, patch: 13 })
        expect(parseTag('v3')).toBeNull()
        expect(parseTag('v3.8')).toBeNull()
        expect(parseTag('3.4.1')).toBeNull()
        expect(parseTag('v3.4.1-rc1')).toBeNull()
    })
})

describe('latestVersion', () => {
    test('picks the highest version, ignoring aliases', () => {
        expect(latestVersion(['v1.9.0', 'v1.10.0', 'v2', 'latest'])?.tag).toBe('v1.10.0')
        expect(latestVersion(['v2', 'latest'])).toBeNull()
    })
})

describe('commitBump', () => {
    test.each([
        ['feat: add x', 'minor'],
        ['feat(api): add x', 'minor'],
        ['fix: y', 'patch'],
        ['chore: z', 'patch'],
        ['update stuff', 'patch'],
        ['refactor!: drop z', 'major'],
        ['feat(api)!: drop z', 'major'],
        ['fix: y\n\nBREAKING CHANGE: removed z', 'major'],
        ['feature without colon', 'patch']
    ])('%p -> %p', (message, bump) => {
        expect(commitBump(message)).toBe(bump as never)
    })
})

describe('determineBump', () => {
    test('takes the highest bump, floored by minimum', () => {
        expect(determineBump(['fix: a', 'feat: b'], 'patch')).toBe('minor')
        expect(determineBump(['fix: a'], 'minor')).toBe('minor')
        expect(determineBump([], 'patch')).toBe('patch')
    })

    test('caps the bump at maximum', () => {
        expect(determineBump(['feat!: a'], 'patch', 'minor')).toBe('minor')
        expect(determineBump(['fix: a\n\nBREAKING CHANGE: b', 'feat: c'], 'patch', 'patch')).toBe('patch')
        expect(determineBump(['feat!: a'], 'patch', 'major')).toBe('major')
    })

    test('fails when minimum is higher than maximum', () => {
        expect(() => determineBump([], 'major', 'minor')).toThrow('higher than maximum-bump')
    })
})

describe('bumpVersion', () => {
    test('resets lower components', () => {
        const v = { major: 3, minor: 4, patch: 1 }
        expect(bumpVersion(v, 'patch')).toEqual({ major: 3, minor: 4, patch: 2 })
        expect(bumpVersion(v, 'minor')).toEqual({ major: 3, minor: 5, patch: 0 })
        expect(bumpVersion(v, 'major')).toEqual({ major: 4, minor: 0, patch: 0 })
    })
})

describe('renderTemplate', () => {
    const vars = { version: { major: 3, minor: 4, patch: 1 }, count: 5, sha: 'abc1234def' }

    test('fills all placeholders', () => {
        expect(renderTemplate('{{VERSION}}-rc{{COUNT}}', vars)).toBe('3.4.1-rc5')
        expect(renderTemplate('{{MAJOR}}.{{MINOR}}.{{PATCH}}-pre-{{SHA}}', vars)).toBe('3.4.1-pre-abc1234')
    })

    test('rejects unknown placeholders', () => {
        expect(() => renderTemplate('{{NOPE}}', vars)).toThrow('Unknown placeholder')
    })
})

describe('aliasTag', () => {
    test('maps keywords to tags', () => {
        const v = { major: 3, minor: 4, patch: 1 }
        expect(aliasTag('major', v)).toBe('v3')
        expect(aliasTag('minor', v)).toBe('v3.4')
        expect(aliasTag('latest', v)).toBe('latest')
    })
})
