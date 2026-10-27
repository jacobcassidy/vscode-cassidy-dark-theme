# Workbench color audit

## Table of Contents

| Ch  | Section                                                                                                       | Subsection                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | [Result](#result)                                                                                             |                                                                                                                 |
| 2   | [Missing colors in stable source](#missing-colors-in-stable-source)                                           |                                                                                                                 |
| 3   | [Additional missing colors on main](#additional-missing-colors-on-main)                                       |                                                                                                                 |
| 4   | [Source registrations versus documentation and schema](#source-registrations-versus-documentation-and-schema) |                                                                                                                 |
| 5   | [Deprecated IDs already in the reference](#deprecated-ids-already-in-the-reference)                           |                                                                                                                 |
| 6   | [Reference IDs absent from both source snapshots](#reference-ids-absent-from-both-source-snapshots)           |                                                                                                                 |
| 6.1 |                                                                                                               | [Entries outside the remoteHub and gitblame namespaces](#entries-outside-the-remotehub-and-gitblame-namespaces) |
| 6.2 |                                                                                                               | [Entries requiring separate extension verification](#entries-requiring-separate-extension-verification)         |
| 7   | [Method and limits](#method-and-limits)                                                                       |                                                                                                                 |

Reviewed on 2026-10-24 against [`all-workbench-settings-clean.json`](all-workbench-settings-clean.json). The annotated [`all-workbench-settings.json`](all-workbench-settings.json) has exactly the same color IDs, so these findings apply to both files.

## Result

The reference contains 1,023 unique color IDs. Eight source-registered colors are missing: four are present in the latest stable source, and another four are present only in the main-branch snapshot reviewed here.

| Source snapshot                                                                                                                                               | Unique registered IDs | Already in reference | Missing from reference | Reference IDs absent from source |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------: | -------------------: | ---------------------: | -------------------------------: |
| [VS Code 1.143.1](https://github.com/microsoft/vscode/releases/tag/1.143.1), released 2026-10-22                                                              |                   998 |                  994 |                      4 |                               29 |
| [Main at `1184ad4d45794110deb6b897ea83b15aac44ed89`](https://github.com/microsoft/vscode/tree/1184ad4d45794110deb6b897ea83b15aac44ed89), committed 2026-10-24 |                 1,002 |                  994 |                      8 |                               29 |

These totals include editor, platform, workbench, agent sessions, deprecated registrations, the 16 dynamically registered terminal ANSI colors, and 11 color contributions from the bundled Git extension. They represent registrations found in source across application surfaces, rather than colors guaranteed to load in every window.

The production theme defines 243 color IDs, all registered in both source snapshots, with no deprecated IDs. Its other 755 stable-source colors can use VS Code's defaults and inheritance; an omitted override is not inherently a theme defect.

## Missing colors in stable source

The mobile colors apply to the phone layout of the agent sessions window. They are separate from `gitDecoration.*`, because that window does not load the same SCM contribution as the desktop workbench. See the [mobile color registrations](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/sessions/browser/parts/mobile/contributions/mobileDiffColors.ts#L6).

| Color ID                                      | Purpose                                                          | Default for dark themes                        | Source                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agentsMobileDiff.addedForeground`            | Added-file indicators and added lines in mobile agent diffs.     | `#81b88b`                                      | [Registration](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/sessions/browser/parts/mobile/contributions/mobileDiffColors.ts#L28)                  |
| `agentsMobileDiff.deletedForeground`          | Deleted-file indicators and removed lines in mobile agent diffs. | `#c74e39`                                      | [Registration](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/sessions/browser/parts/mobile/contributions/mobileDiffColors.ts#L40)                  |
| `agentsMobileDiff.modifiedForeground`         | Modified-file indicators in mobile agent changes.                | `#E2C08D`                                      | [Registration](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/sessions/browser/parts/mobile/contributions/mobileDiffColors.ts#L34)                  |
| `editorOverviewRuler.agentFeedbackForeground` | Agent-feedback markers in the editor overview ruler.             | Inherits `editorOverviewRuler.infoForeground`. | [Registration](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackOverviewRulerContribution.ts#L19) |

The agent-feedback marker is intended to be opaque. Its registration lives in the agent sessions application, so its presence in the source does not imply that the regular desktop editor loads it.

## Additional missing colors on main

These are present in the pinned main snapshot and absent from the 1.143.1 source snapshot. Treat them as upcoming colors rather than assuming a particular released version supports them.

| Color ID                        | Purpose                                                                | Default for dark themes | Source                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentsWindowGraphic.orange`    | Orange details in the Welcome page illustration for the Agents window. | `#D18616`               | [Registration](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/common/agentsColors.ts#L214)                                            |
| `chat.fusionBadgeForeground`    | Text on the Fusion badge in the chat model picker.                     | `#1f1f1f`               | [Registration](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerColors.ts#L23) |
| `chat.fusionBadgeGradientEnd`   | Purple end of the Fusion badge background gradient.                    | `#a685f3`               | [Registration](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerColors.ts#L18) |
| `chat.fusionBadgeGradientStart` | Mint end of the Fusion badge background gradient.                      | `#94f6ed`               | [Registration](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerColors.ts#L13) |

## Source registrations versus documentation and schema

The published [Theme Color reference](https://code.visualstudio.com/api/references/theme-color) and its [Markdown source](https://github.com/microsoft/vscode-docs/blob/main/api/references/theme-color.md) were also checked on the review date. Of these eight missing IDs, only the three `agentsMobileDiff.*` IDs appear as color entries in the documentation snapshot. The other five demonstrate why source inspection can find options absent from the published list.

Documentation coverage and schema support are separate. VS Code's [`registerColor` implementation](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/platform/theme/common/colorUtils.ts#L168) adds registered IDs to its color schema, including transparency requirements and deprecation metadata. An undocumented registration can therefore still be supported when its contribution is loaded. IntelliSense also depends on the running VS Code version, application surface, and installed extensions.

The `$schema` URI in the reference file identifies VS Code's runtime schema; it is not a fixed list stored in this repository. This audit compares source registrations, not the runtime schema of an installed VS Code instance.

## Deprecated IDs already in the reference

These IDs remain registered, so they differ from entries absent from source. Their replacement IDs are already in both reference files.

| Deprecated ID                        | Current ID                               | Status in reviewed snapshots                             |
| ------------------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `editorIndentGuide.background`       | `editorIndentGuide.background1`          | Deprecated in stable and main.                           |
| `editorIndentGuide.activeBackground` | `editorIndentGuide.activeBackground1`    | Deprecated in stable and main.                           |
| `editorActiveLineNumber.foreground`  | `editorLineNumber.activeForeground`      | Deprecated in stable and main.                           |
| `quickInput.list.focusBackground`    | `quickInputList.focusBackground`         | Deprecated in stable and main.                           |
| `modernActivityBar.activeBackground` | `modernActivityBarItem.activeBackground` | Deprecated in stable and main.                           |
| `modernActivityBar.activeForeground` | `modernActivityBarItem.activeForeground` | Deprecated in stable and main.                           |
| `modernActivityBar.hoverBackground`  | `modernActivityBarItem.hoverBackground`  | Deprecated in stable and main.                           |
| `modernActivityBar.hoverForeground`  | `modernActivityBarItem.hoverForeground`  | Deprecated in stable and main.                           |
| `chat.inputWorkingBorderColor2`      | `chat.inputWorkingBorderColor1`          | Registered but unused in stable and main.                |
| `chat.inputWorkingBorderColor3`      | `chat.inputWorkingBorderColor1`          | Registered but unused in stable and main.                |
| `chat.voiceSpeakingGlow`             | `chat.voiceListeningGlow`                | Deprecated and unused on main; not deprecated in stable. |

Sources: [editor colors](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/editor/common/core/editorColorRegistry.ts#L32), [quick input colors](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/platform/theme/common/colors/quickpickColors.ts#L37), [modern Activity Bar colors](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/common/theme.ts#L747), [main chat colors](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/contrib/chat/common/widget/chatColors.ts#L145), and [stable chat colors](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/contrib/chat/common/widget/chatColors.ts#L145).

## Reference IDs absent from both source snapshots

The following 29 IDs have no registration in the audited production source or bundled extension manifests. Absence here does not establish that an installed third-party extension cannot contribute one, or that an older VS Code version never supported it. Preserve extension compatibility entries until the contributing extension has been checked separately.

### Entries outside the remoteHub and gitblame namespaces

```text
editorWatermark.foreground
scm.historyGraph.green
scm.historyGraph.historyItemGroupBase
scm.historyGraph.historyItemGroupHoverLabelForeground
scm.historyGraph.historyItemGroupLocal
scm.historyGraph.historyItemGroupRemote
scm.historyGraph.red
scm.historyGraph.yellow
scm.historyItemAdditionsForeground
scm.historyItemDeletionsForeground
scm.historyItemSelectedStatisticsBorder
scm.historyItemStatisticsBorder
scmGraph.historyItemGroupBase
scmGraph.historyItemGroupLocal
scmGraph.historyItemGroupRemote
testing.message.error.decorationForeground
```

The current [SCM graph registrations](https://github.com/microsoft/vscode/blob/1184ad4d45794110deb6b897ea83b15aac44ed89/src/vs/workbench/contrib/scm/browser/scmHistory.ts#L29) use IDs such as `scmGraph.foreground1` through `scmGraph.foreground5`, `scmGraph.historyItemRefColor`, `scmGraph.historyItemRemoteRefColor`, `scmGraph.historyItemBaseRefColor`, `scmGraph.historyItemHoverAdditionsForeground`, and `scmGraph.historyItemHoverDeletionsForeground`. These IDs are already in the reference. Review the old SCM entries against those current controls; this is not a claim that every old color has a direct replacement.

### Entries requiring separate extension verification

```text
gitblame.inlineMessage
remoteHub.decorations.addedForegroundColor
remoteHub.decorations.conflictForegroundColor
remoteHub.decorations.deletedForegroundColor
remoteHub.decorations.ignoredResourceForeground
remoteHub.decorations.incomingAddedForegroundColor
remoteHub.decorations.incomingDeletedForegroundColor
remoteHub.decorations.incomingModifiedForegroundColor
remoteHub.decorations.incomingRenamedForegroundColor
remoteHub.decorations.modifiedForegroundColor
remoteHub.decorations.possibleConflictForegroundColor
remoteHub.decorations.submoduleForegroundColor
remoteHub.decorations.workspaceRepositoriesView.hasUncommittedChangesForegroundColor
```

## Method and limits

Downloaded the stable-tag and pinned-main source archives from `microsoft/vscode`. Parsed production TypeScript files under `src/` as syntax trees and collected literal `registerColor(...)` calls, including a static template-literal ID. Excluded test and fixture directories. Compared unique, case-sensitive IDs with the JSONC `colors` objects in both references and the production theme.

Manually accounted for all three calls whose first argument was not a literal: the registry forwarding function, the loop over the 16-entry terminal ANSI map, and the extension color-contribution loader. Read `contributes.colors` from extension manifests to cover bundled extension registrations. No duplicate registrations were found in the extracted sets.

This was a source and reference audit. VS Code was not built or launched, and visual behavior was not tested. Third-party extension registries, hardcoded UI colors without a theme registration, semantic token colors, and TextMate scopes are outside its scope. Dark defaults in the tables are upstream defaults, not proposed Cassidy Dark palette choices.

The existing reference files and shipped theme were left unchanged for review. To refresh the references, add the four stable IDs first and label the four main-only IDs as upcoming. Keep deprecated compatibility IDs explicitly labeled, and verify extension-owned entries before removing them.
