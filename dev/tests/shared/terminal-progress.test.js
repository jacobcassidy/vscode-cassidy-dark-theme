/**
 * Terminal progress behavior.
 * @file Verify animation, elapsed time, plain redirected output, and cleanup after a failed operation.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { createTerminalProgress } from "../../tooling/shared/terminal-progress.js";

test("interactive progress animates while waiting and stops cleanly after failure", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });

  /** Captured terminal writes expose animation without requiring a real terminal or wall-clock waits. */
  const chunks = [],
    stream = {
      isTTY: true,
      columns: 100,

      /**
       * Capture a terminal frame or cleanup sequence.
       * @param {string} chunk - Written terminal text.
       */
      write(chunk) {
        chunks.push(chunk);
      },
    };

  /** Progress wraps the same try/finally lifetime used by a failing command. */
  const progress = createTerminalProgress("Retrieving upstream sources", stream);

  await assert.rejects(async () => {
    try {
      assert.match(stripVTControlCharacters(chunks[0]), /Retrieving upstream sources \(0s\)/);
      t.mock.timers.tick(1200);
      assert.notEqual(chunks[0], chunks.at(-1));
      assert.match(stripVTControlCharacters(chunks.at(-1)), /\(1s\)/);
      progress.update("Verifying sources");
      assert.match(chunks.at(-1), /Verifying sources/);

      throw new Error("Source verification failed");
    } finally {
      progress.stop();
    }
  }, /Source verification failed/);

  assert.equal(chunks.at(-1), "\r\u001b[2K");

  /** Cleanup is idempotent and prevents future timer frames or stage updates. */
  const stoppedCount = chunks.length;

  progress.stop();
  progress.update("Must remain stopped");
  t.mock.timers.tick(5000);
  assert.equal(chunks.length, stoppedCount);
});

test("redirected progress prints each stage once without animation or control sequences", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });

  /** Plain output is collected separately from command results. */
  const chunks = [],
    stream = {
      isTTY: false,

      /**
       * Capture a plain stage message.
       * @param {string} chunk - Written progress text.
       */
      write(chunk) {
        chunks.push(chunk);
      },
    };

  /** Noninteractive feedback requires no recurring output while a stage is unchanged. */
  const progress = createTerminalProgress("Starting refresh", stream);

  progress.update("Retrieving sources");
  progress.update("Retrieving sources");
  t.mock.timers.tick(5000);
  progress.stop();
  assert.deepEqual(chunks, ["Starting refresh\n", "Retrieving sources\n"]);
});
