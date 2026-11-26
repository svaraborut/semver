import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface Processor {
    name: string
    match: RegExp
    update: (content: string, version: string) => string
}

export const PROCESSORS: Processor[] = [
    {
        name: 'package.json',
        match: /^package\.json$/,
        update: (content, version) => {
            const current = JSON.parse(content)?.version
            if (typeof current !== 'string') throw new Error('missing top-level "version" field')
            const re = new RegExp(`("version"\\s*:\\s*)"${escapeRegex(current)}"`)
            return content.replace(re, (_, prefix: string) => `${prefix}"${version}"`)
        }
    },
    {
        name: 'pyproject.toml',
        match: /^pyproject\.toml$/,
        update: (content, version) => {
            const lines = content.split('\n')
            let section = ''
            for (let i = 0; i < lines.length; i++) {
                const header = /^\s*\[([^\]]+)\]/.exec(lines[i]!)
                if (header) {
                    section = header[1]!.trim()
                    continue
                }
                if (section !== 'project' && section !== 'tool.poetry') continue
                const match = /^(\s*version\s*=\s*)(["'])[^"']*\2/.exec(lines[i]!)
                if (match) {
                    lines[i] = lines[i]!.replace(match[0], `${match[1]}${match[2]}${version}${match[2]}`)
                    return lines.join('\n')
                }
            }
            throw new Error('missing "version" in [project] or [tool.poetry]')
        }
    },
    {
        name: 'python module',
        match: /\.py$/,
        update: (content, version) => {
            const re = /^(__version__\s*(?::\s*str\s*)?=\s*)(["'])[^"']*\2/m
            if (!re.test(content)) throw new Error('missing __version__ assignment')
            return content.replace(re, (_, prefix: string, quote: string) => `${prefix}${quote}${version}${quote}`)
        }
    },
    {
        // Catch-all, must stay last: replaces every `0.0.0`, '0.0.0' or "0.0.0" with the same quote on both sides
        name: 'placeholder',
        match: /./,
        update: (content, version) => {
            const re = /([`'"])0\.0\.0\1/g
            if (!re.test(content)) throw new Error('missing quoted 0.0.0 placeholder')
            return content.replace(re, (_, quote: string) => `${quote}${version}${quote}`)
        }
    }
]

export function setVersion(file: string, content: string, version: string): string {
    return PROCESSORS.find(p => p.match.test(basename(file)))!.update(content, version)
}

export async function updateVersionFile(file: string, version: string): Promise<void> {
    const content = await readFile(file, 'utf8')
    try {
        await writeFile(file, setVersion(file, content, version))
    } catch (error) {
        throw new Error(`${file}: ${(error as Error).message}`)
    }
}
