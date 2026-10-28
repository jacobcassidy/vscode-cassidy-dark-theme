/**
 * Terminal activity feedback.
 * @file Display an animated current stage and elapsed time, with plain stage messages for redirected output.
 */

import { formatMessage } from "./terminal-output.js";

/**
 * Start terminal feedback that the caller must stop before printing its final result.
 * @param {string} initialMessage - Initial activity description.
 * @param {NodeJS.WriteStream} [stream] - Progress destination, separate from command results.
 * @returns {{ update: (message: string) => void, stop: () => void }} Stage reporting and idempotent cleanup.
 */
export function createTerminalProgress(initialMessage, stream = process.stderr) {
  /** Spinner frames and invocation start time remain local to this progress display. */
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    started = Date.now();

  /** Current activity, animation position, and cleanup state. */
  let message = initialMessage,
    frame = 0,
    stopped = false;

  /** Render one terminal frame without leaving stale characters from a longer stage. */
  function render() {
    /** Elapsed wall time helps distinguish a long-running stage from a fresh one. */
    const elapsed = Math.floor((Date.now() - started) / 1000);

    /** Keep feedback on one terminal row, including on narrow windows. */
    const line = `${frames[frame++ % frames.length]} ${message} (${elapsed}s)`;

    stream.write(`\r\u001b[2K${formatMessage(line.slice(0, Math.max(1, (stream.columns || 80) - 1)), "info")}`);
  }

  if (stream.isTTY) render();
  else stream.write(`${message}\n`);

  /** Only interactive terminals need animation; the timer must never keep a finished command alive. */
  const timer = stream.isTTY ? setInterval(render, 120) : undefined;

  timer?.unref();

  return {
    /**
     * Display the next activity immediately, without repeating identical redirected messages.
     * @param {string} nextMessage - Current stage description.
     */
    update(nextMessage) {
      if (stopped || nextMessage === message) return;
      message = nextMessage;
      if (stream.isTTY) render();
      else stream.write(`${message}\n`);
    },

    /** Stop animation and clear its terminal row before success, failure, or cancellation output. */
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      if (stream.isTTY) stream.write("\r\u001b[2K");
    },
  };
}
