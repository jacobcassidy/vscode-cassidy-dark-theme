/**
 * Bounded source retrieval.
 * @file Verify latest stable/main resolution, transient retry budgets, cancellation, and fail-closed metadata handling without network access.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createRetrieval,
  resolveLatest,
  retryDelay,
  validateSourceConfig,
} from "../../../tooling/tokens/data/sources.js";

/**
 * Construct a minimal HTTP response for deterministic injected transports.
 * @param status - HTTP status.
 * @param value - JSON payload.
 * @param [headers] - Response headers.
 */
function response(status, value, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),

    /**
     * Return the controlled response body for the metadata transport fixture.
     */
    text: async () => JSON.stringify(value),
  };
}

/** Finite local policies avoid real timers/retry waits in every test. */
const policy = { requestMs: 30, attempts: 3, totalMs: 3000 };

test("recorded coverage is a bijection over full source identities", () => {
  /** Independent core and contributor inputs require distinct complete coverage identities. */
  const inputs = [
    { id: "vscode-stable", kind: "core", revision: "a".repeat(40) },
    { id: "extension-1", kind: "extension", revision: "b".repeat(40), contributor: "fixture.extension" },
  ];

  /** Valid replay metadata is independent from parser/updater output. */
  const config = {
    policy: "latest-stable",
    repository: "microsoft/vscode",
    supplementalMain: false,
    retrieval: policy,
    coverageExceptions: [],
    lastSuccessful: {
      resolution: { version: "1.2.3", tag: "1.2.3", inputs },
      coverage: inputs.map((identity) => ({ identity: { ...identity }, ui: [], types: [], modifiers: [], scopes: [] })),
      acceptedCoverage: [],
      localSyntax: {
        path: "src/themes/prod/default/tokens/syntax/definitions.jsonc",
        revision: `sha256:${"c".repeat(64)}`,
      },
    },
  };

  validateSourceConfig(config);

  for (const mutate of [
    (candidate) => {
      candidate.lastSuccessful.coverage[1] = structuredClone(candidate.lastSuccessful.coverage[0]);
    },
    (candidate) => {
      candidate.lastSuccessful.coverage.pop();
    },
    (candidate) => {
      candidate.lastSuccessful.coverage[1].identity.contributor = "other.extension";
    },
    (candidate) => {
      candidate.lastSuccessful.coverage[0].identity.kind = "extension";
    },
    (candidate) => {
      candidate.lastSuccessful.coverage[0].identity.extra = true;
    },
  ]) {
    /** Each malformed record starts from a separately valid configuration. */
    const candidate = structuredClone(config);

    mutate(candidate);
    assert.throws(() => validateSourceConfig(candidate), /coverage|Coverage/);
  }
});

for (const release of [
  { tag_name: "1.2.3", draft: true },
  { tag_name: "1.2.3-beta.1", prerelease: true },
  { tag_name: "main" },
  {},
]) {
  test(`latest resolution rejects invalid/unpublished release ${JSON.stringify(release)}`, async () => {
    /** Metadata response never authorizes an old successful resolution fallback. */
    const retrieval = createRetrieval({
      policy,

      /**
       * Return a controlled metadata response or transport failure without networking.
       */
      fetch: async () => response(200, release),
    });

    await assert.rejects(
      resolveLatest({ repository: "microsoft/vscode", supplementalMain: true }, retrieval),
      /published stable/,
    );
  });
}

test("latest release and annotated tag/main revisions resolve afresh on every invocation", async () => {
  /** Exact API request inventory proves caches cannot freeze release discovery. */
  const urls = [],
    stable = "a".repeat(40),
    main = "b".repeat(40);

  /** Finite retrieval context shared by discovery, verification, and downloads. */
  const retrieval = createRetrieval({
    policy,

    /**
     * Return a controlled metadata response or transport failure without networking.
     * @param url - Requested metadata URL.
     */
    fetch: async (url) => {
      urls.push(url);
      if (url.endsWith("releases/latest")) return response(200, { tag_name: "1.2.3", draft: false, prerelease: false });
      if (url.includes("git/ref/tags")) return response(200, { object: { type: "tag", sha: "c".repeat(40) } });
      if (url.includes("git/tags")) return response(200, { object: { type: "commit", sha: stable } });
      return response(200, { object: { type: "commit", sha: main } });
    },
  });

  assert.deepEqual(
    (await resolveLatest({ repository: "microsoft/vscode", supplementalMain: true }, retrieval)).inputs.map(
      (input) => input.revision,
    ),
    [stable, main],
  );

  await resolveLatest({ repository: "microsoft/vscode", supplementalMain: true }, retrieval);
  assert.equal(urls.filter((url) => url.endsWith("releases/latest")).length, 2);
});

for (const status of [408, 429, 500, 503]) {
  test(`HTTP ${status} retries finitely within shared invocation/request budgets`, async () => {
    /** Clock and retry waits advance deterministically without wall-clock sleeps. */
    let now = 0,
      attempts = 0;

    /** Recorded waits are evidence of bounded backoff and server-delay handling. */
    const waits = [];

    /** Finite retrieval context shared by discovery, verification, and downloads. */
    const retrieval = createRetrieval({
      policy,

      /**
       * Read the deterministic retrieval clock.
       */
      now: () => now,

      /**
       * Return deterministic jitter for bounded retry assertions.
       */
      random: () => 0,

      /**
       * Advance the injected retrieval clock without a wall-clock wait.
       * @param ms - Requested delay in milliseconds.
       */
      wait: async (ms) => {
        waits.push(ms);
        now += ms;
      },

      /**
       * Return a controlled metadata response or transport failure without networking.
       */
      fetch: async () => {
        attempts++;
        return attempts < 3 ? response(status, {}, { "retry-after": "0.01" }) : response(200, { success: true });
      },
    });

    assert.deepEqual(await retrieval.request("https://fixture.invalid/metadata"), { success: true });
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [10, 10]);
  });
}

for (const status of [401, 403, 404]) {
  test(`HTTP ${status} is fatal without retry or old-source fallback`, async () => {
    /** Transport count distinguishes fatal failures from transient retry classification. */
    let attempts = 0;

    /** Transport returns a permanent failure every time. */
    const retrieval = createRetrieval({
      policy,

      /**
       * Return a controlled metadata response or transport failure without networking.
       */
      fetch: async () => {
        attempts++;
        return response(status, {});
      },
    });

    await assert.rejects(retrieval.request("https://fixture.invalid/metadata"), /after 1 attempt/);
    assert.equal(attempts, 1);
  });
}

test("retry exhaustion, total budget, invalid policies, and cancellation have finite deterministic outcomes", async () => {
  /** All retry waits are injected and do not block the test runner. */
  let now = 0,
    attempts = 0;

  /** Transport errors are transient but never authorize unbounded retries. */
  const retrieval = createRetrieval({
    policy: { ...policy, totalMs: 10000 },

    /**
     * Read the deterministic retrieval clock.
     */
    now: () => now,

    /**
     * Return deterministic jitter for bounded retry assertions.
     */
    random: () => 0,

    /**
     * Advance the injected retrieval clock without a wall-clock wait.
     * @param ms - Requested delay in milliseconds.
     */
    wait: async (ms) => {
      now += ms;
    },

    /**
     * Return a controlled metadata response or transport failure without networking.
     */
    fetch: async () => {
      attempts++;
      throw new TypeError("network failure");
    },
  });

  await assert.rejects(retrieval.request("https://fixture.invalid/network"), /after 3 attempt/);
  assert.equal(attempts, 3);

  /** An excessive Retry-After cannot exceed the shared total budget. */
  const limited = createRetrieval({
    policy,

    /**
     * Return a controlled metadata response or transport failure without networking.
     */
    fetch: async () => response(429, {}, { "retry-after": "99" }),
  });

  await assert.rejects(limited.request("https://fixture.invalid/limited"), /exceeds remaining total budget/);

  for (const invalid of [0, -1, Infinity, NaN])
    assert.throws(() => createRetrieval({ policy: { ...policy, totalMs: invalid } }), /finite and positive/);

  /** User cancellation aborts immediately without entering another retry. */
  const cancellation = new AbortController();

  /** Retrieval context connected to the explicit cancellation signal. */
  const cancelled = createRetrieval({
    policy,
    signal: cancellation.signal,

    /**
     * Return a controlled metadata response or transport failure without networking.
     */
    fetch: async () => {
      cancellation.abort(new Error("cancelled by fixture"));
      throw new Error("aborted");
    },
  });

  await assert.rejects(cancelled.request("https://fixture.invalid/cancelled"), /cancelled by fixture/);
  assert.equal(retryDelay("garbage", 0), undefined);
  assert.equal(retryDelay("1.5", 0), 1500);
});

test("idempotent Git downloads use bounded transient retries without retrying missing revisions", async () => {
  /** Controlled subprocess outcomes avoid network traffic and real timeout waits. */
  let attempts = 0;

  /** Git transport retries delegate to the same finite invocation context. */
  const retrieval = createRetrieval({
    policy: { ...policy, totalMs: 10000 },

    /** Provide deterministic retry jitter. */
    random: () => 0,

    /** Advance no wall-clock time while testing bounded Git retry counts. */
    wait: async () => {},

    /** Simulate transient connection failure followed by a verified fetch completion. */
    runGit: async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error("Connection reset"), { stderr: "Connection reset" });
      return { stdout: "complete" };
    },
  });

  assert.equal(await retrieval.git(["fetch", "origin", "a".repeat(40)], "."), "complete");
  assert.equal(attempts, 3);

  /** A missing required revision is fatal and never turns into an old-source fallback. */
  const missing = createRetrieval({
    policy,

    /** Simulate a fatal missing revision without a transport retry. */
    runGit: async () => {
      throw new Error("couldn't find remote ref");
    },
  });
  await assert.rejects(missing.git(["fetch", "origin", "b".repeat(40)], "."), /after 1 attempt/);
});
