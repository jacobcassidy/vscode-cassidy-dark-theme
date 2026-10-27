/**
 * Terminal message colors.
 * @file Apply consistent ANSI colors to script messages according to their purpose.
 */

/** Terminal foreground colors keyed by message purpose; default text needs no ANSI sequence. */
const colors = {
  error: "\u001b[31m",
  warning: "\u001b[93m",
  info: "\u001b[34m",
  success: "\u001b[32m",
  default: "",
  action: "\u001b[35m",
  file: "\u001b[34m",
  heading: "\u001b[36m",
  important: "\u001b[35m",
};

/**
 * Color a terminal message and reset the terminal afterward, leaving default text untouched.
 * @param {string} message - Text to display.
 * @param {"error" | "warning" | "info" | "success" | "default" | "action" | "file" | "heading" | "important"} [kind] - Message purpose determining its color.
 * @returns {string} Message with the appropriate terminal foreground color.
 */
export function formatMessage(message, kind = "default") {
  return colors[kind] ? `${colors[kind]}${message}\u001b[0m` : message;
}
