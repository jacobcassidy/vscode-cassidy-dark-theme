/**
 * VS Code screenshot configuration.
 * @file Keep renderer dimensions, comparison output, and Linux baselines deterministic.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "theme.spec.js",
  workers: 1,
  retries: 0,
  timeout: 120000,
  outputDir: ".cache/visual/results",
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
  reporter: [["list"], ["html", { outputFolder: ".cache/visual/report", open: "never" }]],
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0 } },
});
