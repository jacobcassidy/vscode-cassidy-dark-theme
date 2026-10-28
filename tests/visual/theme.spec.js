/**
 * Published theme screenshot regressions.
 * @file Capture real VS Code language, semantic, diagnostic, and terminal rendering in isolated profiles.
 */

import { test, expect, chromium } from "@playwright/test";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";
import { parse } from "jsonc-parser";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";

/** Pinned runtime and isolated instance paths. */
const version = "1.143.1",
  root = process.cwd(),
  cache = resolve(root, ".cache/visual"),
  instance = join(cache, "instance"),
  controlFile = join(instance, "control.json"),
  workspace = join(instance, "workspace");

/** Browser transport, VS Code child, renderer page, and private control credentials. */
let browser, child, page, control;

/** Published editor background used to assert the selected theme actually rendered. */
const theme = parse(await readFile(join(root, "themes/cassidy-dark-color-theme.json"), "utf8"));

test.beforeAll(async () => {
  test.setTimeout(300000);

  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error("Run screenshots with npm run check:visual (pinned Linux/amd64)");

  await rm(instance, { recursive: true, force: true });
  await mkdir(join(instance, "profile/User"), { recursive: true });
  await mkdir(join(instance, "extensions/cassidy-dark"), { recursive: true });
  await cp(join(root, "samples/grammar"), workspace, { recursive: true });
  await cp(join(root, "themes"), join(instance, "extensions/cassidy-dark/themes"), { recursive: true });
  await cp(join(root, "package.json"), join(instance, "extensions/cassidy-dark/package.json"));
  await writeFile(
    join(instance, "profile/User/settings.json"),
    JSON.stringify({
      "workbench.colorTheme": "Cassidy Dark",
      "workbench.startupEditor": "none",
      "workbench.tips.enabled": false,
      "workbench.enableExperiments": false,
      "chat.disableAIFeatures": true,
      "workbench.secondarySideBar.defaultVisibility": "hidden",
      "extensions.ignoreRecommendations": true,
      "workbench.editor.enablePreview": false,
      "workbench.activityBar.location": "hidden",
      "window.titleBarStyle": "custom",
      "window.commandCenter": false,
      "window.menuBarVisibility": "hidden",
      "window.zoomLevel": 0,
      "editor.fontFamily": "Liberation Mono",
      "editor.fontSize": 14,
      "editor.lineHeight": 22,
      "editor.fontLigatures": false,
      "editor.minimap.enabled": false,
      "editor.stickyScroll.enabled": false,
      "editor.cursorBlinking": "solid",
      "editor.renderWhitespace": "none",
      "editor.scrollBeyondLastLine": false,
      "editor.smoothScrolling": false,
      "editor.occurrencesHighlight": "off",
      "editor.selectionHighlight": false,
      "breadcrumbs.enabled": false,
      "terminal.integrated.fontFamily": "Liberation Mono",
      "terminal.integrated.fontSize": 14,
      "terminal.integrated.cursorBlinking": false,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
      "security.workspace.trust.enabled": false,
      "typescript.disableAutomaticTypeAcquisition": true,
      "problems.autoReveal": false,
      "workbench.reduceMotion": "on",
      "window.restoreWindows": "none",
    }),
  );

  /** Downloaded exact VS Code executable; cached across runs. */
  const executable = await downloadAndUnzipVSCode({ version, platform: "linux-x64", cachePath: join(cache, "vscode") });

  /** Verify the exact runtime build as well as the advertised release version. */
  const product = JSON.parse(await readFile(join(executable, "..", "resources/app/product.json"), "utf8"));

  expect(product.commit).toBe("e646868227c3e3a9e3f24277c8c7220be42c0be7");
  child = spawn(
    executable,
    [
      workspace,
      "--user-data-dir",
      join(instance, "profile"),
      "--extensions-dir",
      join(instance, "extensions"),
      "--extensionDevelopmentPath",
      join(root, "tests/visual/fixture-extension"),
      "--remote-debugging-port=9222",
      "--no-sandbox",
      "--disable-gpu",
      "--force-color-profile=srgb",
      "--force-device-scale-factor=1",
      "--skip-welcome",
      "--skip-release-notes",
      "--locale=en-US",
      "--new-window",
    ],
    { env: { ...process.env, CASSIDY_VISUAL_CONTROL: controlFile }, stdio: ["ignore", "pipe", "pipe"] },
  );

  /** Persistent runtime diagnostics for failed startup. */
  const logs = [];

  child.stdout.on("data", (data) => logs.push(data));
  child.stderr.on("data", (data) => logs.push(data));
  child.on("exit", () => {
    void writeFile(join(cache, "vscode.log"), Buffer.concat(logs));
  });
  await expect
    .poll(
      async () => {
        try {
          control = JSON.parse(await readFile(controlFile, "utf8"));
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 90000, message: "VS Code fixture extension must activate" },
    )
    .toBe(true);
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  page = browser
    .contexts()[0]
    .pages()
    .find((candidate) => candidate.url().includes("workbench"));

  if (!page) throw new Error("VS Code workbench renderer was not found");

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".monaco-workbench")).toBeVisible();
  await page.addStyleTag({ content: ".cursor, .cursors-layer { visibility: hidden !important; }" });
});

test.afterAll(async () => {
  await browser?.close();
  child?.kill("SIGTERM");
});

for (const scenario of [
  "javascript",
  "typescript-off",
  "typescript-on",
  "tsx",
  "python",
  "markdown",
  "problems",
  "terminal",
]) {
  test(scenario, async () => {
    /** API-driven editor readiness, including actual semantic tokens when requested. */
    const response = await fetch(`http://127.0.0.1:${control.port}/${scenario}`, {
      method: "POST",
      headers: { authorization: control.token },
    });

    /** API readiness result must describe the published theme. */
    const payload = await response.text();

    expect(response.ok, payload).toBe(true);
    expect(JSON.parse(payload).theme).toBe("Cassidy Dark");
    expect(
      await page
        .locator(".monaco-workbench")
        .evaluate((element) =>
          element.ownerDocument.defaultView
            .getComputedStyle(element)
            .getPropertyValue("--vscode-editor-background")
            .trim(),
        ),
    ).toBe(theme.colors["editor.background"]);
    await expect(page.locator(".tab.active .label-name")).toHaveText(
      scenario.startsWith("typescript") || scenario === "problems"
        ? "typescript.ts"
        : scenario === "terminal"
          ? "javascript.js"
          : scenario === "tsx"
            ? "tsx.tsx"
            : `${scenario}.${scenario === "javascript" ? "js" : scenario === "python" ? "py" : "md"}`,
    );
    await expect(page.locator(".monaco-editor .view-lines").first()).toBeVisible();

    if (scenario === "problems") await expect(page.getByText("Visual fixture error", { exact: true })).toBeVisible();

    if (scenario === "terminal") await expect(page.locator(".terminal-wrapper")).toBeVisible();

    await expect(page).toHaveScreenshot(`${scenario}.png`);
  });
}
