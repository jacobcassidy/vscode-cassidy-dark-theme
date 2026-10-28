/**
 * Focused build selections for behavioral fixtures.
 * @file Keep test group selections concise while exercising the common production preparation/application interface.
 */

import { prepareBuild, applyBuild } from "../../tooling/themes/build.js";

/**
 * Build a fixture's production group, optionally testing palette independence.
 * @param [options] - Fixture build options.
 */
export function buildProduction(options = {}) {
  return buildFixture({ ...options, mode: options.paletteOnly ? "palette" : "prod" });
}

/**
 * Return a fixture's complete development artifact summary.
 * @param [options] - Fixture build options.
 */
export function buildDevelopmentSummary(options = {}) {
  return buildFixture({ ...options, mode: "dev" });
}

/**
 * Select per-target results for assertions about target-specific colors and outputs.
 * @param [options] - Fixture build options.
 */
export async function buildDevelopment(options = {}) {
  return (await buildDevelopmentSummary(options)).targets;
}

/**
 * Compose preparation and application for focused fixture builds.
 * @param [options] - Selected mode, root, check, and operation adapters.
 */
export async function buildFixture(options = {}) {
  return applyBuild(await prepareBuild(options), options);
}
