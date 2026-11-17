export interface Commit {
    sha: string
    message: string
}

// Both variables are always set on GitHub Actions runners, including GitHub Enterprise Server.
export function repoUrl(env: Record<string, string | undefined>): string | null {
    const server = env.GITHUB_SERVER_URL
    const repository = env.GITHUB_REPOSITORY
    return server && repository ? `${server}/${repository}` : null
}

function changelogLine(commit: Commit, url: string | null): string {
    const subject = commit.message.split('\n')[0]!.trim()
    const short = commit.sha.slice(0, 7)
    const ref = url ? `[${short}](${url}/commit/${commit.sha})` : short
    return `- ${subject} (${ref})`
}

export function formatChangelog(commits: Commit[], url: string | null): string {
    return commits.map(commit => changelogLine(commit, url)).join('\n')
}
