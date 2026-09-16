import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "product/sandbox/src/**/*.test.ts",
      "product/web/src/**/*.test.ts",
      "evals/conformance/**/*.test.ts",
      // Research measurement-protocol harness tests (methodology slice: the
      // integrity laws the next confirmatory experiment depends on).
      "research/measurement-protocols/**/*.test.ts"
    ],
    allowOnly: false,
    // Environment tolerance ONLY (assertions are unchanged): the deterministic
    // experiment/conformance suites spawn child processes and rebuild canonical
    // worlds, so individual cases routinely exceed vitest's short defaults when
    // files run in parallel. No test becomes passable that would otherwise fail.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Several conformance suites hold hard 60s budgets for their own child-process
    // restores (frozen evidence, never edited). Oversubscribing 16 cores with
    // process-spawning files starves those budgets, so the pool is bounded.
    maxWorkers: 4
  }
});
