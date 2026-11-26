import { describe, expect, test } from 'bun:test'
import { setVersion } from './files'

describe('package.json', () => {
    test('replaces the top-level version and keeps formatting', () => {
        const input = '{\n    "name": "x",\n    "version": "0.0.0",\n    "deps": { "a": "1" }\n}\n'
        expect(setVersion('pkg/package.json', input, '3.4.1')).toBe(input.replace('0.0.0', '3.4.1'))
    })

    test('fails without a version', () => {
        expect(() => setVersion('package.json', '{"name":"x"}', '1.0.0')).toThrow('missing')
    })
})

describe('pyproject.toml', () => {
    test('replaces version in [project] only', () => {
        const input = '[tool.other]\nversion = "9"\n\n[project]\nname = "x"\nversion = "0.0.0" # keep\n'
        const output = setVersion('pyproject.toml', input, '3.4.1')
        expect(output).toBe('[tool.other]\nversion = "9"\n\n[project]\nname = "x"\nversion = "3.4.1" # keep\n')
    })

    test('supports [tool.poetry]', () => {
        expect(setVersion('pyproject.toml', "[tool.poetry]\nversion = '1.0.0'\n", '2.0.0')).toBe(
            "[tool.poetry]\nversion = '2.0.0'\n"
        )
    })

    test('fails without a version', () => {
        expect(() => setVersion('pyproject.toml', '[project]\nname = "x"\n', '1.0.0')).toThrow('missing')
    })
})

describe('python module', () => {
    test('replaces __version__', () => {
        expect(setVersion('pkg/__init__.py', "import x\n__version__ = '0.0.0'\n", '3.4.1-rc5')).toBe(
            "import x\n__version__ = '3.4.1-rc5'\n"
        )
        expect(setVersion('v.py', '__version__: str = "0"\n', '1.0.0')).toBe('__version__: str = "1.0.0"\n')
    })

    test('fails without __version__', () => {
        expect(() => setVersion('v.py', 'x = 1\n', '1.0.0')).toThrow('missing')
    })
})

describe('placeholder', () => {
    test('replaces quoted 0.0.0 in strings', () => {
        expect(setVersion('src/version.ts', "export const VERSION = '0.0.0'\n", '3.4.1')).toBe(
            "export const VERSION = '3.4.1'\n"
        )
    })

    test('replaces every match and keeps the quotes', () => {
        const input = 'Install `0.0.0` or "0.0.0".\n'
        expect(setVersion('README.md', input, '1.2.3')).toBe('Install `1.2.3` or "1.2.3".\n')
    })

    test('ignores mismatched quotes and unquoted occurrences', () => {
        const input = `a = '0.0.0"\nb = pkg@0.0.0\nc = "10.0.0.0"\nd = "0.0.0"\n`
        expect(setVersion('Cargo.toml', input, '1.0.0')).toBe(input.replace('d = "0.0.0"', 'd = "1.0.0"'))
    })

    test('fails without a placeholder', () => {
        expect(() => setVersion('README.md', 'version 0.0.0\n', '1.0.0')).toThrow('missing')
    })
})
