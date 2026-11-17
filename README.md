# 🏷️ Automated SemVer GitHub Action

GitHub Action for agile version bumping on any code repository. Versions are tracked with git tags only, and nothing is ever committed back to the repository.

On each run the action:

1. Finds the last version, the highest `vX.Y.Z` tag reachable from the current commit (or `0.0.0` if there is none).
2. Determines the bump (`patch`, `minor`, `major`) from the commit messages since that version.
3. Writes the new version into the configured version files (`package.json`, `pyproject.toml`, Python `__version__`) in the workspace, so the following build and publish steps use it.
4. Tags the current commit as `vX.Y.Z`, updates the alias tags (like `v3`, `v3.4`, `latest`), and pushes them.

The action is used in one of two modes: automated, where it releases versions by itself, or manual, where you release by pushing tags and the action only reads them.

## Automated Versioning Mode

Whenever `preview` is `false` (the default), every run releases: the action computes the next SemVer, pushes the `vX.Y.Z` tag and moves the aliases. Drive `preview` from the branch to release from `main` only, while other branches get preview versions without pushing anything.

```yaml
on:
  push:
    branches: ['main', 'stage']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: semver
        uses: svaraborut/semver@v1
        with:
          preview: ${{ github.ref != 'refs/heads/main' }}
          files: package.json
      - run: npm publish
      - run: echo "Released ${{ steps.semver.outputs.tag }}"
```

- On `main`, a `feat:` commit after `v3.4.0` releases `3.5.0`, and pushes `v3.5.0`, `v3`, `v3.5` and `latest`.
- On any other branch, the same commit outputs `3.5.0-rc1` and pushes nothing.

The action needs `contents: write` to push tags. Shallow checkouts are fine, because the action fetches the full history and tags by itself.

Tags pushed with the default `GITHUB_TOKEN` do not trigger other workflows, so build and publish in the same job, right after this action.

## Manual Versioning Mode

With `preview` always `true`, the action never pushes a tag. You decide when to release by pushing a `vX.Y.Z` tag yourself, and the action only reads tags to output the version:

- On a commit tagged `vX.Y.Z`, it outputs that version as is (e.g. `1.2.0`).
- On any other commit, it outputs a preview of the next version (e.g. `1.2.1-rc3`).

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: semver
        uses: svaraborut/semver@v1
        with:
          preview: true
          files: package.json
      - run: echo "Building ${{ steps.semver.outputs.version }}"
```

Release by tagging the commit, which triggers the workflow again with the release version:

```sh
git tag v1.2.0 && git push origin v1.2.0
```

Alias tags are never moved in this mode, and `contents: read` is enough.

## Previews

When `preview` is `true`, the next version is rendered with `preview-format` and no tag is pushed, unless the current commit is already tagged (see [Re-runs](#re-runs)). Previews are ephemeral: every preview carries the next SemVer until the next release.

The template supports these placeholders:

| Placeholder   | Description                                             | Example   |
| ------------- | ------------------------------------------------------- | --------- |
| `{{VERSION}}` | Next version                                            | `3.4.1`   |
| `{{MAJOR}}`   | Next major                                              | `3`       |
| `{{MINOR}}`   | Next minor                                              | `4`       |
| `{{PATCH}}`   | Next patch                                              | `1`       |
| `{{COUNT}}`   | Commits since the last version                          | `5`       |
| `{{SHA}}`     | Short commit hash (7 characters)                        | `abc1234` |

For example, `{{VERSION}}-rc{{COUNT}}` renders `3.4.1-rc5`, and `{{VERSION}}-pre-{{SHA}}` renders `3.4.1-pre-abc1234`.

## Configurations

| Input            | Description                                                      | Default                   |
| ---------------- | ---------------------------------------------------------------- | ------------------------- |
| `files`          | Version files to update, comma or newline separated              |                           |
| `preview`        | Produce a preview version, without pushing any tag               | `false`                   |
| `preview-format` | Template of the preview version                                  | `{{VERSION}}-rc{{COUNT}}` |
| `aliases`        | Alias tags to move on release, any of `major`, `minor`, `latest` | `major,minor,latest`      |
| `minimum-bump`   | The smallest bump to apply, one of `patch`, `minor`, `major`     | `patch`                   |

| Output    | Description                          | Example  |
| --------- | ------------------------------------ | -------- |
| `version` | The version, without the `v` prefix  | `3.4.1`  |
| `tag`     | The tag, the version prefixed by `v` | `v3.4.1` |

## Bump rules

The bump follows [Conventional Commits](https://www.conventionalcommits.org). The highest bump across all commits since the last version wins, and it is never lower than `minimum-bump`.

| Commit                                      | Bump    |
| ------------------------------------------- | ------- |
| `feat!: ...`, `fix(api)!: ...`              | `major` |
| A `BREAKING CHANGE:` footer                 | `major` |
| `feat: ...`, `feat(api): ...`               | `minor` |
| Anything else (`fix:`, `chore:`, free text) | `patch` |

There is no special handling below `1.0.0`: a breaking change on `0.4.2` releases `1.0.0`. To start from a different version, push the tag manually (e.g. `git tag v1.0.0 && git push origin v1.0.0`).

## Version files

Files are detected by name and edited in place, keeping formatting and comments. A file without a version field fails the run.

| File             | Updated field                                  |
| ---------------- | ---------------------------------------------- |
| `package.json`   | Top-level `"version"`                          |
| `pyproject.toml` | `version` under `[project]` or `[tool.poetry]` |
| `*.py`           | `__version__ = "..."`                          |

Since the files are never committed, the repository can keep a placeholder such as `0.0.0`.

## Aliases

On release, each alias is force-pushed to point at the new version:

- `major`: `v3`
- `minor`: `v3.4`
- `latest`: `latest`

Aliases are ignored when looking for the last version; only full `vX.Y.Z` tags count.

## Re-runs

If the current commit already has a `vX.Y.Z` tag, the action reuses that version, updates the files, and pushes nothing, so re-running a job is safe. If another run pushed the same tag on a different commit first, the action fails.

The same applies to manually tagged commits, and it takes precedence over `preview`: a preview run on a commit tagged `v1.0.0` outputs `1.0.0`, not a rendered `preview-format` version. Avoid publishing from preview runs on tagged commits, or the release version is published early.
