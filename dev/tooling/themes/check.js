/**
 * Theme source and generated validation.
 * @file Validate authored categories/aliases/details and current generated registrations without application.
 */

import { prepareBuild, applyBuild } from "./build.js";
import { checkGeneratedThemes } from "./generated-validation.js";
import { repositoryRoot } from "../shared/paths.js";

/**
 * Prepare sources once, compare current artifacts, and validate registrations/assets without writes.
 * @param [root] - Checkout or isolated project root.
 */
export async function checkThemes(root = repositoryRoot) {
  /** Shared preparation supplies source validation and exact generated-output comparisons. */
  const prepared = await prepareBuild({ root });

  await applyBuild(prepared, { check: true });

  return checkGeneratedThemes(root);
}
