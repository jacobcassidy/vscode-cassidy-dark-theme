# Development guide

Cassidy Dark is a declarative Visual Studio Code color theme. VS Code loads the theme directly from a JSON-with-comments file; there is no extension runtime, compilation step, bundler, or generated theme. The release build packages the source and extension metadata into a `.vsix` archive.

Run the commands in this guide from the repository root unless stated otherwise.

## Project structure

| Path                                                                                 | Purpose                                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [`package.json`](../../package.json)                                                 | Extension identity, Marketplace metadata, version, theme contribution, development dependencies, and npm scripts. |
| [`package-lock.json`](../../package-lock.json)                                       | Locked npm dependency tree for local development tools.                                                           |
| [`themes/cassidy-dark-color-theme.json`](../../themes/cassidy-dark-color-theme.json) | The theme shipped to users.                                                                                       |
| [`dev/themes/`](../../dev/themes/)                                                   | Experimental and historical themes available through the local development extension.                             |
| [`docs/references/`](../references/)                                                 | Palette, opacity, semantic token, and workbench color references. These are reference material, not build inputs. |
| [`previews/`](../../previews/)                                                       | Example source files for inspecting syntax highlighting, currently including PHP.                                 |
| [`images/`](../../images/)                                                           | Extension icons and the README screenshot.                                                                        |
| [`scripts/`](../../scripts/)                                                         | Local development setup, pipeline submission, changelog extraction, and GitHub release creation.                  |
| [`azure-pipelines.yml`](../../azure-pipelines.yml)                                   | Manual packaging and publication pipeline.                                                                        |
| [`.vscodeignore`](../../.vscodeignore)                                               | Exclusions from the published VSIX.                                                                               |
| [`CHANGELOG.md`](../../CHANGELOG.md)                                                 | Versioned release notes, also used to populate GitHub releases.                                                   |

The published extension ID is `jacobcassidy.cassidy-dark`, combining the manifest's `publisher` and `name`. Its theme picker label is **Cassidy Dark**, with `uiTheme: "vs-dark"`. The manifest declares VS Code compatibility as `^1.64.2`.

The shipped theme has three main sections:

- `colors`: workbench and editor UI colors.
- `semanticTokenColors`: colors for semantic tokens supplied by language tooling; `semanticHighlighting` is enabled.
- `tokenColors`: TextMate scope rules for syntax highlighting.

Although the theme filename ends in `.json`, it includes comments. Preserve this JSON-with-comments format when editing it.

## Local setup and preview

Use VS Code, Git, and Node.js with npm. Node.js 24 is a suitable development baseline: the lockfile's Markdown tooling requires Node.js 22 or newer, and ESLint requires `^20.19.0 || ^22.13.0 || >=24`. The repository does not pin Node.js through a version file or a `package.json` Node engine constraint.

Install the locked development dependencies:

```bash
npm ci
```

The repository uses ES modules (`"type": "module"`). Its npm dependencies support development tooling; the theme has no production npm dependencies.

### Create the local development extension

```bash
npm run setup:dev
```

[`scripts/setup-dev.js`](../../scripts/setup-dev.js) imports [`scripts/sync-dev.js`](../../scripts/sync-dev.js), which creates a separate extension directory at:

```text
~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/
```

The script writes a generated `package.json` there with the name `cassidy-dark-dev` and display name **Cassidy Dark Dev**, and removes the published manifest's `__metadata`. It links the checkout's `themes/`, `dev/`, and `images/` directories into that extension directory. The source manifest stays in the checkout; the generated development manifest is a separate file.

The development manifest registers:

- The production theme as **Cassidy Dark Dev**.
- Every `.json` file directly inside `dev/themes/`, with labels derived from filenames, such as **Cassidy Dark Dev (Test)** and **Cassidy Dark Dev (V1.2.0 Official)**.

Run **Developer: Reload Window** in VS Code, then open **Preferences: Color Theme** and select a Cassidy Dark Dev theme. The development identity allows it to coexist with the Marketplace extension.

Edits to linked theme files reach the development extension directly. Theme entries include `_watch: true`; reload the VS Code window if an edit is not reflected. Open the files in `previews/` and representative files from other languages to inspect highlighting. **Developer: Inspect Editor Tokens and Scopes** helps identify which TextMate or semantic token rules apply.

After changing manifest metadata or adding or removing development theme files, regenerate the development manifest and reload VS Code:

```bash
npm run sync:dev-pkgJSON
```

Both development commands run the same sync logic; `setup:dev` additionally prints the reload reminder. There is no file-watching process that continually regenerates the manifest. The script always targets the standard `~/.vscode/extensions` location rather than discovering custom extension directories or alternate VS Code editions.

For safety, the sync script refuses to use a symlink for the development extension directory or its generated manifest. Existing asset links must point to this checkout. If the checkout moves, inspect and repair those development links before running setup again.

### Editing and checks

Make production changes in `themes/cassidy-dark-color-theme.json`. Files in `dev/themes/` are separate variants: no script promotes or merges them into the production theme.

The editor settings in `.vscode/` recommend Prettier, ESLint, Markdown linting, and color inspection tools. Prettier formats on save, using two-space indentation and the repository configuration.

| Command                    | Behavior                                         |
| -------------------------- | ------------------------------------------------ |
| `npm run check`            | Check Prettier formatting across the repository. |
| `npm run format`           | Rewrite files using Prettier.                    |
| `npm run lint:docs`        | Lint Markdown files.                             |
| `npm run lint:docs:fix`    | Apply available Markdown lint fixes.             |
| `npm run lint:scripts`     | Lint JavaScript with ESLint.                     |
| `npm run lint:scripts:fix` | Apply available ESLint fixes.                    |

[`lefthook.yml`](../../lefthook.yml) defines a pre-commit hook that runs ESLint, Markdown linting, and Prettier in that order against matching staged files. Each command can fix files and stage the fixes. To explicitly install the configured hooks locally, run:

```bash
npx lefthook install
```

There is no automated test suite or `npm test` script. Check visual changes in VS Code as well as running the formatting and lint commands. The publishing pipeline does not run these development checks.

## Building the extension

The build is a packaging operation using the VS Code extension CLI, `@vscode/vsce`. There is no `npm run build` or `vscode:prepublish` script.

For a local package, install the CLI, then package the current checkout:

```bash
npm install -g @vscode/vsce
version=$(node -p "require('./package.json').version")
vsce package --out "cassidy-dark-$version.vsix"
```

This creates a local VSIX without publishing it. In VS Code, use **Extensions: Install from VSIX...** to install the archive and inspect the packaged theme.

The manifest selects `themes/cassidy-dark-color-theme.json` as the only published theme. `.vscodeignore` excludes development themes, documentation, previews, scripts, editor settings, and the listed tooling configuration files. The package carries the production theme, manifest, and distributable assets such as the README, changelog, license, and images. Generated `*.vsix` archives are also ignored by Git.

The pipeline uses the same `vsce package` operation. It installs `@vscode/vsce` globally without pinning its version, uses the Node.js available on the hosted agent, and does not run `npm ci` or compile assets. Consequently, the lockfile governs local development tools but does not pin the pipeline's packaging toolchain.

## Release configuration

Releases are orchestrated by Azure DevOps through [`azure-pipelines.yml`](../../azure-pipelines.yml). Both `trigger: none` and `pr: none` are set: pushes, pull requests, and tags do not automatically start publication. There is no GitHub Actions release workflow in this repository.

The pipeline and helper scripts refer to these resources:

| Resource                  | Configured value or requirement                                            |
| ------------------------- | -------------------------------------------------------------------------- |
| Azure DevOps organization | `https://dev.azure.com/jacobcassidy`                                       |
| Azure DevOps project      | `Cassidy Dark Theme`                                                       |
| Azure pipeline name       | `jacobcassidy.vscode-cassidy-dark-theme`                                   |
| Release branch            | `main`                                                                     |
| Hosted agent              | `ubuntu-latest`                                                            |
| Azure service connection  | `vscode_publishing_connection`                                             |
| Marketplace publisher     | `jacobcassidy`                                                             |
| GitHub repository         | `jacobcassidy/vscode-cassidy-dark-theme`                                   |
| GitHub authentication     | Secret pipeline variable `GH_TOKEN` with repository Contents write access. |

Marketplace publication uses `vsce publish --azure-credential` inside an `AzureCLI@3` task authenticated through `vscode_publishing_connection`. The task is labeled as using managed identity. That service connection and the corresponding identity's authorization to publish under `jacobcassidy` must already be configured outside this repository. The YAML references the connection; it does not create the identity or grant its permissions.

GitHub publication uses the separate `GH_TOKEN` secret, passed to the relevant pipeline steps. The GitHub CLI (`gh`) must be available on the agent; the YAML checks its authentication but does not install it. The pipeline installs `vsce` itself.

To submit a run from your computer, the Azure CLI must be installed, authenticated for this organization, and have the Azure DevOps extension available for `az pipelines run`. Your Azure DevOps account must be allowed to queue the pipeline. Local GitHub or Marketplace credentials are not used by the submission script; publication uses the pipeline's credentials.

## Publishing a release

### Prepare the release commit

1. Finish the theme changes and inspect them using the development extension or a local VSIX.
2. Set the intended release version in `package.json`. Keep the lockfile's root package metadata aligned when updating the version. The packaging and release scripts read the version from `package.json`.
3. Add a matching, nonempty version section to `CHANGELOG.md`, for example `## [1.2.2] - YYYY-MM-DD`. Move the relevant entries from `[Unreleased]` into that section.
4. Run the local checks and inspect the extracted GitHub release notes:

   ```bash
   npm run check
   npm run lint:docs
   npm run lint:scripts
   bash scripts/changelog-notes.sh
   ```

5. Commit the release changes and push them to `main` on the remote used by the Azure pipeline. Confirm the intended release commit is on that branch before starting publication.

[`scripts/changelog-notes.sh`](../../scripts/changelog-notes.sh) reads the manifest version and extracts the body below the matching `## [VERSION]` heading, stopping at the next level-two heading. It fails if that section is missing or empty. Entries under `[Unreleased]` do not become release notes automatically.

### Start the pipeline

From a local checkout on `main`, run:

```bash
npm run publish:azure
```

[`scripts/publish-azure.sh`](../../scripts/publish-azure.sh) rejects any branch other than `main`, including detached HEAD, then submits:

```bash
az pipelines run \
  --organization 'https://dev.azure.com/jacobcassidy' \
  --project 'Cassidy Dark Theme' \
  --name 'jacobcassidy.vscode-cassidy-dark-theme' \
  --branch main \
  --open
```

The command queues the remote `main` branch and opens the run in the browser. It does not commit, push, upload local changes, increment the version, or create a local Git tag. You can also manually queue the Azure pipeline against `main`; its own branch check still applies.

### Pipeline execution

The pipeline performs these steps in order:

1. **Checkout and preflight.** Check out the source, require `BUILD_SOURCEBRANCH` to equal `refs/heads/main`, require `GH_TOKEN`, validate the version's changelog notes, check GitHub authentication and repository access, and install `@vscode/vsce` globally. This preflight does not verify Marketplace publisher permissions.
2. **Package once.** Read `package.json.version` and write `cassidy-dark-VERSION.vsix` into `BUILD_ARTIFACTSTAGINGDIRECTORY`. Save the path in the pipeline variable `ExtensionVsix`.
3. **Preserve the VSIX.** Upload it as the Azure pipeline artifact `extension-vsix` before either publication step.
4. **Publish to the VS Code Marketplace.** Authenticate through `vscode_publishing_connection` and run `vsce publish --azure-credential --packagePath "$EXTENSION_VSIX"`.
5. **Publish the GitHub release.** Run `scripts/create-github-release.sh` with that same VSIX, using `GH_TOKEN`.

Both destinations receive the same packaged file. Marketplace publication runs first; if it fails, the subsequent GitHub step does not run under the pipeline's default success conditions. If GitHub publication fails afterward, the Marketplace version can already be live.

### GitHub release behavior

[`scripts/create-github-release.sh`](../../scripts/create-github-release.sh) derives the tag and release title as `vVERSION` from `package.json`, and supplies the matching changelog body as release notes. For a new release, it targets `BUILD_SOURCEVERSION` in Azure Pipelines, or the current `git rev-parse HEAD` when run locally. The GitHub CLI creates the tag if needed as part of release creation; no separate tag push is scripted.

For an existing release, the helper checks the VSIX asset's filename. It uploads the file if that name is missing, or skips it if the name is already present. It does not compare file contents, replace existing assets, update existing release notes, or retarget an existing tag. The release helper itself has no branch guard; the normal submission script and pipeline enforce `main`.

After a successful run, verify the version on the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.cassidy-dark) and check the tag, notes, and VSIX attachment on the [GitHub releases page](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/releases).

## Recovering a partial release

Use the pipeline logs to identify the failed step. Because the VSIX is archived before publication, the `extension-vsix` artifact provides the original package for recovery.

If Marketplace publication succeeded and only GitHub publication failed:

1. Download the VSIX from that run's `extension-vsix` artifact.
2. Use a local checkout of the exact release commit, so the manifest version and changelog match the downloaded package.
3. Make `gh` available and set `GH_TOKEN` securely in your shell to a token with repository Contents write access.
4. Run the GitHub helper with the absolute path to the downloaded VSIX:

   ```bash
   bash scripts/create-github-release.sh /absolute/path/to/cassidy-dark-VERSION.vsix
   ```

This runs only GitHub publication and can fill in a missing release or missing asset. It still validates the changelog and token even when an asset already exists. For an incorrect existing asset, release description, or tag target, review and correct that GitHub resource explicitly; the helper leaves it in place.

Rerunning the whole pipeline repeats Marketplace publication as well as packaging. The YAML has no check that skips a version already published to the Marketplace, so use the GitHub-only recovery path when that is the remaining failed step.
