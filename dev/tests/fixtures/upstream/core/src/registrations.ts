import { UI_ID, UI_DESCRIPTION } from "./barrel.js";
registerColor(UI_ID, {}, nls.localize("editor.background", UI_DESCRIPTION));
registerColor(
  "editor.foreground",
  {},
  localize({ key: "editor.foreground", comment: ["Static message."] }, "Upstream editor foreground."),
);
registry.registerTokenType("variable", "Upstream variables.");
registry.registerTokenType("function", "Upstream functions.");
registry.registerTokenModifier("readonly", "Read-only symbols.");
registry.registerTokenModifier("defaultLibrary", "Standard library symbols.");
registerColor("testing.iconFailed", {}, "New parent purpose.");
registerColor("testing.iconFailed.retired", {}, "Child purpose remains.");

function forward(id: string, description: string) {
  registerColor(id, {}, description);
}
