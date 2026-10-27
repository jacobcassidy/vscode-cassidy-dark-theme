/**
 * Theme source and generated validation.
 * @file Validate authored categories/aliases/details and current generated registrations without application.
 */

import { prepareBuild } from "./build.js";
import { checkGeneratedThemes } from "./generated-validation.js";
import { repositoryRoot } from "../shared/paths.js";

/**
 * Validate current authored sources and generated registrations/assets without applying artifacts.
 * @param [root] - Checkout or isolated project root.
 */
export async function checkThemes(root = repositoryRoot) {
  await prepareBuild({ root });
  return checkGeneratedThemes(root);
}
