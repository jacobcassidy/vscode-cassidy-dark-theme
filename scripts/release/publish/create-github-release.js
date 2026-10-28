/**
 * GitHub release recovery command.
 * @file Verify package identity and remote state before recovering a GitHub release.
 */

import { repositoryRoot } from "../../../tooling/shared/paths.js";
import { recoverGitHubRelease } from "../../../tooling/release/github.js";

try {
  if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required with repository Contents write access");

  if (process.argv.length !== 3) throw new Error("Usage: npm run recover -- /absolute/path/to/extension.vsix");

  /** Verified result without credentials. */
  const result = await recoverGitHubRelease({
    vsix: process.argv[2],
    root: repositoryRoot,
    commit: process.env.BUILD_SOURCEVERSION,
  });

  console.log(`Release ${result.tag}: ${result.status} (SHA-256 ${result.digest})`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
