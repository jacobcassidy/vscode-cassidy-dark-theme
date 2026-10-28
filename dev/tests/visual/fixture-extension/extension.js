/**
 * Deterministic VS Code visual fixture.
 * @file Prepare real editor, semantic token, diagnostics, and terminal states through the VS Code API.
 */

/** VS Code API supplied by the isolated extension host. */
const vscode = require("vscode");

/** Local-only control transport and readiness-file writer. */
const { createServer } = require("node:http"),
  { writeFile } = require("node:fs/promises"),
  { randomUUID } = require("node:crypto");

/** Supported scenario inputs; requests cannot execute arbitrary commands or paths. */
const scenarios = {
  javascript: ["javascript.js", 48, false],
  "typescript-off": ["typescript.ts", 35, false],
  "typescript-on": ["typescript.ts", 35, true],
  tsx: ["tsx.tsx", 30, false],
  python: ["python.py", 56, false],
  markdown: ["markdown.md", 0, false],
  problems: ["typescript.ts", 35, true],
  terminal: ["javascript.js", 48, false],
};

/**
 * Activate the fixture's private control server in the isolated test instance.
 * @param context - VS Code extension context.
 */
exports.activate = async function activate(context) {
  /** Authentication token, diagnostic collection, and per-scenario terminal. */
  const token = randomUUID(),
    diagnostics = vscode.languages.createDiagnosticCollection("visual-fixture");

  /** Terminal disposed between scenarios. */
  let terminal;

  /**
   * Prepare a requested deterministic workbench state.
   * @param name - Supported scenario name.
   */
  async function prepare(name) {
    if (!Object.hasOwn(scenarios, name)) throw new Error("Unknown visual scenario");

    /** Scenario language sample and semantic mode. */
    const [filename, line, semantic] = scenarios[name];

    terminal?.dispose();
    diagnostics.clear();
    await vscode.commands.executeCommand("workbench.action.closePanel");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.workspace
      .getConfiguration("editor")
      .update("semanticHighlighting.enabled", semantic, vscode.ConfigurationTarget.Global);

    /** Real sample document displayed in the editor. */
    const document = await vscode.workspace.openTextDocument(
        vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filename),
      ),
      editor = await vscode.window.showTextDocument(document),
      position = new vscode.Position(Math.min(line, document.lineCount - 1), 0);

    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);

    if (semantic) {
      /** Deadline for the bundled TypeScript semantic provider. */
      const deadline = Date.now() + 30000;

      while (true) {
        /** The provider must return actual tokens before capturing semantic-on states. */
        const tokens = await vscode.commands.executeCommand("vscode.provideDocumentSemanticTokens", document.uri);

        if (tokens?.data?.length) break;

        if (Date.now() > deadline) throw new Error("TypeScript semantic tokens did not become ready");

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (name === "problems") {
      diagnostics.set(document.uri, [
        new vscode.Diagnostic(new vscode.Range(35, 0, 35, 12), "Visual fixture error", vscode.DiagnosticSeverity.Error),
        new vscode.Diagnostic(
          new vscode.Range(38, 0, 38, 8),
          "Visual fixture warning",
          vscode.DiagnosticSeverity.Warning,
        ),
      ]);
      await vscode.commands.executeCommand("workbench.actions.view.problems");
    }

    if (name === "terminal") {
      /** Fixed terminal transcript independent of a shell startup file or prompt. */
      const emitter = new vscode.EventEmitter();

      terminal = vscode.window.createTerminal({
        name: "Theme colors",
        pty: {
          onDidWrite: emitter.event,

          /** Emit the complete stable transcript once the renderer opens the terminal. */
          open() {
            emitter.fire(
              "Cassidy Dark terminal palette\r\n\x1b[31mError\x1b[0m  \x1b[32mSuccess\x1b[0m  \x1b[33mWarning\x1b[0m  \x1b[34mInfo\x1b[0m  \x1b[35mAccent\x1b[0m  \x1b[36mLink\x1b[0m\r\n$ npm run check\r\nAll checks passed.\r\n",
            );
          },

          /** Release the fixture event emitter. */
          close() {
            emitter.dispose();
          },
        },
      });
      terminal.show();
    }

    await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    await vscode.commands.executeCommand("notifications.clearAll");

    if (name !== "terminal") await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");

    return { filename, semantic, theme: vscode.workspace.getConfiguration("workbench").get("colorTheme") };
  }

  /** Authenticated loopback server available only inside this test container. */
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.headers.authorization !== token) {
        response.writeHead(403).end();
        return;
      }

      /** Scenario name from the restricted route. */
      const name = request.url.slice(1),
        state = await prepare(name);

      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(state));
    } catch (error) {
      response.writeHead(500).end(String(error.stack));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.subscriptions.push(diagnostics, {
    /** Close the loopback listener with the extension. */
    dispose() {
      server.close();
    },
  });
  await writeFile(process.env.CASSIDY_VISUAL_CONTROL, JSON.stringify({ port: server.address().port, token }));
};
