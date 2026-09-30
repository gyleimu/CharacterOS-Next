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
      "research/measurement-protocols/**/*.test.ts",
      // Confirmatory preregistration harness tests (offline, no model calls).
      "research/experiments/belief-causal-confirmatory-stochastic-v1/**/*.test.ts",
      // EXPLORATORY, non-confirmatory executor schema-failure diagnostic
      // instrumentation: Phase A gate, mock fetch only, 0 model calls.
      "research/experiments/executor-schema-failure-diagnostic-v0/**/*.test.ts",
      // Model-visible contract parity audit (offline contract tests).
      "research/audits/model-visible-contract-parity-v0/**/*.test.ts",
      // Post-parity exploratory schema-failure diagnostic (Phase A gate, mock fetch only).
      "research/experiments/post-parity-schema-failure-diagnostic-v0/**/*.test.ts",
      // Engineered capability probe (Phase A audit + bounded probe; mock fetch only).
      "research/experiments/structured-output-capability-probe-v0/**/*.test.ts",
      // Strict-schema executor qualification, Gate S (offline tests; mock transports only).
      "research/experiments/strict-schema-executor-qualification-v0/**/*.test.ts",
      // Phase-0 executor-robustness remediation: the fail-closed session-poisoning regression
      // (offline tests; stub transports only, 0 model calls, no production change).
      "research/north-star/history-internalization/phase-0/remediation/**/*.test.ts",
      // Decision Probe V0 instrument (offline tests; stub transports, 0 model calls).
      // It measures a closed-set decision over an already-production-built request and
      // changes no Core semantics; Phase D0 runs are a separate, explicitly-invoked CLI.
      "research/experiments/decision-probe-v0/**/*.test.ts",
      // Decision Probe V1 protocol audits (offline; construct-neutrality, fixture-blindness,
      // state-blindness gates + frozen V0 artifact preservation checks, 0 model calls).
      "research/experiments/decision-probe-v1/**/*.test.ts",
      // Decision Probe V2 transport-aware protocol audits (offline; contract inheritance,
      // FORMAT_ONLY / TOKEN_REMAP construction, TRANSPORT_EQUIVALENCE_GATE, 0 model calls).
      "research/experiments/decision-probe-v2/**/*.test.ts",
      // D1 belief-state-sensitivity preregistration audits (offline; frozen probe bytes,
      // deterministic r_confirm rule, frame-minimal byte-diff, within-identity reversal).
      "research/experiments/belief-state-sensitivity-d1/**/*.test.ts",
      // Phase-0 CLOUD EXECUTOR SWAP (offline; stub transports only, 0 model calls, no network).
      // Pins the swap's three claims: prompt bytes unchanged (frozen builder reused by identity),
      // no local fallback / credential never degraded or recorded, and the science reused by
      // reference (this tree cannot mint a verdict). Also fences the cloud readiness criteria.
      "research/north-star/history-internalization/phase-0/cloud-swap/**/*.test.ts",
      // Phase-0 harness-level tests (offline; stub transports, 0 model calls). Covers the additive
      // subject-id parameterisation and, decisively, proves the leakage audit is DEAF when the map
      // does not travel with the identities — the disarmament that parameterisation exists to prevent.
      "research/north-star/history-internalization/phase-0/*.test.ts"
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
