# Agent Instructions

## Repository guidance

- Finish each task or feature by committing its completed changes.
- Match the existing commit message style and formatting; use a plain, sentence-case imperative subject without adding prefixes or changing the format.
- When relevant, document completed tasks or features in `CHANGELOG.md` and/or `README.md`.

## Code Spacing Rules

- Put a blank line before each JSDoc block, except at the start of a file.
- Separate a control-flow statement from the preceding statement at the same level with a blank line. This includes `if`, loops, `switch`, `try`, `return`, `throw`, `break`, and `continue`. Do not pad the start of a block or detach `else`, `catch`, `finally`, or `do...while` continuations.
- Put a blank line after a completed block, control-flow statement, or multiline expression statement when another statement follows at the same level. Keep function-call arguments and chained expressions together.
- Put a blank line after a standalone `let`, `const`, or `var` when the next statement is not another variable declaration. Keep consecutive variable declarations together; do not pad before closing syntax or inside loop headers.
- Put a blank line after every export declaration, including `export const`, before any following code or comment.
- Separate a `const` declaration spanning more than three source lines from neighboring statements with blank lines, including adjacent variable declarations.

Exceptions to these spacing rules:

- Keep a `const` and the single-line statement that immediately precedes its block’s closing syntax together, even when the `const` spans multiple lines. Retain any required blank line before the `const`.
- If every statement directly inside a code block fits on one source line, omit blank lines between them. Apply this separately to nested blocks. Keep comments attached to their code and preserve spacing before JSDoc blocks.
