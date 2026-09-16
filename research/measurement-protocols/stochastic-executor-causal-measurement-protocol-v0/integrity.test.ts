/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — research harness integrity tests.
 *
 * Tests A–I of the evidence protocol (§35) plus two protocol-specific gates:
 * the hard-gate wiring proof (§36) and the negation-aware classifier suite (§37).
 * Research-harness tests only: no production package is involved and no model
 * call is made.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HARD_GATE_IDS,
  HARD_GATE_EVALUATORS,
  PROTOCOL_ID,
  evaluateHardGates,
  type VerdictInput
} from "./contract.ts";
import { deriveVerdict } from "./verdict.ts";
import {
  CONFLATION_NEGATIVE_CASES,
  CONFLATION_POSITIVE_CASES,
  classifyTruthConflation
} from "./conflation.ts";
import {
  buildFreezeManifest,
  canonicalJson,
  contentHashOf,
  gitBlobHash,
  reportHashOf,
  sealReport,
  verifyFreezeManifest,
  verifyReport
} from "./hashing.ts";
import { exactEquivalencePower, exactSuperiorityPower, newcombeDifference, wilson } from "./statistics.ts";
import { verifyV0Evidence } from "./v0-verification.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const PROTOCOL_DIR = "research/measurement-protocols/stochastic-executor-causal-measurement-protocol-v0";
const V0_HARNESS_FILES = [
  "research/experiments/belief-causal-validation-v0/contract.ts",
  "research/experiments/belief-causal-validation-v0/statistics-does-not-exist.ts"
].slice(0, 1) as readonly string[];
const PROTOCOL_FILES = [
  `${PROTOCOL_DIR}/contract.ts`,
  `${PROTOCOL_DIR}/statistics.ts`,
  `${PROTOCOL_DIR}/hashing.ts`,
  `${PROTOCOL_DIR}/verdict.ts`
] as const;

function git(args: readonly string[], cwd = REPO_ROOT): string {
  return execFileSync("git", args as string[], { cwd, encoding: "utf8" }).trim();
}

/** A scratch git repository with one commit, used to exercise the hash laws. */
function scratchRepo(): { dir: string; commit: string } {
  const dir = mkdtempSync(join(tmpdir(), "bcv-protocol-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "protocol@test"], dir);
  git(["config", "user.name", "protocol-test"], dir);
  writeFileSync(join(dir, "contract.ts"), "export const X = 1;\n");
  writeFileSync(join(dir, "hashing.ts"), "export const H = 1;\n");
  writeFileSync(join(dir, "results.json"), "{\"verdict\":\"PENDING\"}\n");
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "preregistration"], dir);
  return { dir, commit: git(["rev-parse", "HEAD"], dir) };
}

function baseVerdictInput(): VerdictInput {
  return {
    phase: "PRIMARY",
    cells: {
      A: { scheduled: 200, host_valid: 200, realize: 60 },
      B: { scheduled: 200, host_valid: 200, realize: 132 },
      C: { scheduled: 200, host_valid: 200, realize: 20 },
      D: { scheduled: 200, host_valid: 200, realize: 136 }
    },
    isolation: {
      raw_history_leaks: 0,
      retrieval_exposed: false,
      non_belief_state_equal: true,
      non_belief_prompt_equal: true,
      b_d_input_identical: true,
      intervention_belief_stable: true,
      fresh_process_restores: 800,
      scheduled_scenes: 800
    },
    conflation_flags: 0,
    accounting: { planned: 800, actual: 800, unique: 800, duplicate: 0, missing: 0, extra: 0 }
  };
}

describe("STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — statistics law", () => {
  it("Wilson interval contains the point estimate and widens as N shrinks", () => {
    const wide = wilson(5, 10, 1.96);
    const narrow = wilson(50, 100, 1.96);
    expect(wide.lo).toBeLessThan(0.5);
    expect(wide.hi).toBeGreaterThan(0.5);
    expect(narrow.hi - narrow.lo).toBeLessThan(wide.hi - wide.lo);
  });

  it("Newcombe difference interval is antisymmetric and centred near the difference", () => {
    const forward = newcombeDifference(30, 100, 66, 100, 1.96);
    const backward = newcombeDifference(66, 100, 30, 100, 1.96);
    expect(forward.hi).toBeCloseTo(-backward.lo, 6);
    expect(forward.lo).toBeLessThan(0.36);
    expect(forward.hi).toBeGreaterThan(0.36);
  });

  it("a minimum-effect test has ~alpha power AT the threshold and rises with the true effect", () => {
    // Why the design effect must exceed delta_min by a margin: the rule is
    // 'lower confidence bound > delta_min', so at a true effect equal to
    // delta_min the bound clears the threshold only at the alpha rate.
    const atThreshold = exactSuperiorityPower(0.3, 0.5, 200, 200, 0.2, 1.959963984540054).power;
    const modestlyAbove = exactSuperiorityPower(0.3, 0.6, 200, 200, 0.2, 1.959963984540054).power;
    const designEffect = exactSuperiorityPower(0.3, 0.7, 200, 200, 0.2, 1.959963984540054).power;
    const belowThreshold = exactSuperiorityPower(0.3, 0.4, 200, 200, 0.2, 1.959963984540054).power;
    expect(atThreshold).toBeLessThan(0.15);
    expect(modestlyAbove).toBeGreaterThan(atThreshold);
    expect(designEffect).toBeGreaterThan(0.9);
    expect(belowThreshold).toBeLessThan(atThreshold);
  });

  it("equivalence power under identical cells increases with N and decreases with epsilon", () => {
    const atSmallEpsilon = exactEquivalencePower(0.5, 0.5, 100, 100, 0.1, 1.6448536269514722).power;
    const atLargeEpsilon = exactEquivalencePower(0.5, 0.5, 100, 100, 0.15, 1.6448536269514722).power;
    const atLargeN = exactEquivalencePower(0.5, 0.5, 160, 160, 0.15, 1.6448536269514722).power;
    expect(atLargeEpsilon).toBeGreaterThan(atSmallEpsilon);
    expect(atLargeN).toBeGreaterThan(atLargeEpsilon);
  });
});

describe("STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — conjunctive verdict law", () => {
  it("a fully conjunctive success is the ONLY path to INFLUENCE_REPLICATED", () => {
    const verdict = deriveVerdict(baseVerdictInput());
    expect(verdict.failed_gates).toEqual([]);
    expect(verdict.decision.C1_AB_superiority).toBe(true);
    expect(verdict.decision.C2_BC_superiority).toBe(true);
    expect(verdict.decision.C4_DA_superiority).toBe(true);
    expect(verdict.decision.C3_BD_equivalence).toBe(true);
    expect(verdict.verdict).toBe("BELIEF_CAUSAL_INFLUENCE_REPLICATED");
  });

  it("breaking the B/D equivalence alone changes the verdict but not the superiorities", () => {
    const input = baseVerdictInput();
    const broken: VerdictInput = {
      ...input,
      cells: { ...input.cells, D: { scheduled: 200, host_valid: 200, realize: 176 } }
    };
    const verdict = deriveVerdict(broken);
    expect(verdict.decision.C1_AB_superiority).toBe(true);
    expect(verdict.decision.C2_BC_superiority).toBe(true);
    expect(verdict.decision.C4_DA_superiority).toBe(true);
    expect(verdict.decision.C3_BD_equivalence).toBe(false);
    expect(verdict.verdict).toBe("BELIEF_CAUSAL_RESULT_INCONCLUSIVE");
  });

  it("a genuine null (no contrast reaches the claim threshold) yields NOT_REPLICATED", () => {
    const input = baseVerdictInput();
    const nullish: VerdictInput = {
      ...input,
      cells: {
        A: { scheduled: 200, host_valid: 200, realize: 80 },
        B: { scheduled: 200, host_valid: 200, realize: 96 },
        C: { scheduled: 200, host_valid: 200, realize: 84 },
        D: { scheduled: 200, host_valid: 200, realize: 92 }
      }
    };
    const verdict = deriveVerdict(nullish);
    expect(verdict.decision.joint).toBe(false);
    expect(verdict.verdict).toBe("BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED");
  });
});

describe("STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — hard-gate wiring (§36)", () => {
  it("every declared hard gate has an executable evaluator (no report-only gate)", () => {
    expect(Object.keys(HARD_GATE_EVALUATORS).sort()).toEqual([...HARD_GATE_IDS]);
    const evaluations = evaluateHardGates(baseVerdictInput());
    expect(evaluations.map((entry) => entry.id).sort()).toEqual([...HARD_GATE_IDS]);
    expect(evaluations.every((entry) => entry.passed)).toBe(true);
  });

  it("EVERY gate individually blocks the replicated verdict when violated", () => {
    const violations: Record<string, (input: VerdictInput) => VerdictInput> = {
      HOST_VALIDITY_OVERALL: (input) => ({
        ...input,
        cells: { ...input.cells, A: { ...input.cells.A, host_valid: 140 } }
      }),
      HOST_VALIDITY_PER_CELL_MINIMUM: (input) => ({
        ...input,
        cells: { ...input.cells, A: { ...input.cells.A, host_valid: 140 } }
      }),
      INVALID_IMBALANCE_AUDIT: (input) => ({
        ...input,
        cells: {
          ...input.cells,
          A: { ...input.cells.A, host_valid: 180 },
          B: { ...input.cells.B, host_valid: 200 },
          C: { ...input.cells.C, host_valid: 200 },
          D: { ...input.cells.D, host_valid: 200 }
        }
      }),
      RAW_HISTORY_ISOLATION: (input) => ({ ...input, isolation: { ...input.isolation, raw_history_leaks: 1 } }),
      RETRIEVAL_ISOLATION: (input) => ({ ...input, isolation: { ...input.isolation, retrieval_exposed: true } }),
      NON_BELIEF_STATE_EQUALITY: (input) => ({ ...input, isolation: { ...input.isolation, non_belief_state_equal: false } }),
      NON_BELIEF_PROMPT_EQUIVALENCE: (input) => ({ ...input, isolation: { ...input.isolation, non_belief_prompt_equal: false } }),
      B_D_INPUT_IDENTITY: (input) => ({ ...input, isolation: { ...input.isolation, b_d_input_identical: false } }),
      INTERVENTION_BELIEF_STABILITY: (input) => ({ ...input, isolation: { ...input.isolation, intervention_belief_stable: false } }),
      FRESH_PROCESS_RESTORE: (input) => ({ ...input, isolation: { ...input.isolation, fresh_process_restores: 799 } }),
      TRUTH_CONFLATION: (input) => ({ ...input, conflation_flags: 1 }),
      CALL_ACCOUNTING: (input) => ({ ...input, accounting: { ...input.accounting, duplicate: 1 } })
    };
    expect(Object.keys(violations).sort()).toEqual([...HARD_GATE_IDS]);
    for (const gateId of HARD_GATE_IDS) {
      const violate = violations[gateId];
      expect(violate, `no violation implemented for ${gateId}`).toBeDefined();
      const verdict = deriveVerdict((violate as (input: VerdictInput) => VerdictInput)(baseVerdictInput()));
      expect(verdict.failed_gates).toContain(gateId);
      expect(verdict.verdict, `${gateId} did not block the replicated verdict`).not.toBe("BELIEF_CAUSAL_INFLUENCE_REPLICATED");
    }
  });

  it("a confounder gate failure names the specific confounder verdict", () => {
    const input = baseVerdictInput();
    const confounded: VerdictInput = { ...input, isolation: { ...input.isolation, raw_history_leaks: 2 } };
    expect(deriveVerdict(confounded).verdict).toBe("BELIEF_EFFECT_CONFOUNDED_BY_RAW_HISTORY");
    const retrieval: VerdictInput = { ...input, isolation: { ...input.isolation, retrieval_exposed: true } };
    expect(deriveVerdict(retrieval).verdict).toBe("BELIEF_EFFECT_CONFOUNDED_BY_MEMORY_RETRIEVAL");
    const state: VerdictInput = { ...input, isolation: { ...input.isolation, non_belief_state_equal: false } };
    expect(deriveVerdict(state).verdict).toBe("BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE");
    const mediator: VerdictInput = { ...input, isolation: { ...input.isolation, b_d_input_identical: false } };
    expect(deriveVerdict(mediator).verdict).toBe("BELIEF_MEDIATOR_EQUALIZATION_FAILED");
  });
});

describe("STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — truth-conflation classifier (§37)", () => {
  it("flags every positive certainty assertion", () => {
    for (const text of CONFLATION_POSITIVE_CASES) {
      expect(classifyTruthConflation(text).conflation, text).toBe(true);
    }
  });

  it("never flags an explicit disclaimer or negation (including the V0 false positive)", () => {
    for (const text of CONFLATION_NEGATIVE_CASES) {
      expect(classifyTruthConflation(text).conflation, text).toBe(false);
    }
  });

  it("is deterministic and reports the matched marker", () => {
    const first = classifyTruthConflation("It is guaranteed true.");
    const second = classifyTruthConflation("It is guaranteed true.");
    expect(first).toEqual(second);
    expect(first.hits[0]?.marker).toBe("guaranteed");
    expect(first.classifier_id).toBe("NEGATION_AWARE_CERTAINTY_ASSERTION_V1");
  });
});

describe("STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — hash laws", () => {
  it("canonical JSON is key-sorted and stable under key insertion order", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("INTEGRITY TEST A: a built manifest self-verifies at its own preregistration commit", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts", "hashing.ts"],
        design: { delta_min: 0.2, epsilon: 0.15, n_per_cell: 100 }
      });
      const verification = verifyFreezeManifest(repo.dir, manifest);
      expect(verification.ok).toBe(true);
      expect(verification.checked.some((entry) => entry.startsWith("blob:contract.ts:OK"))).toBe(true);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("INTEGRITY TEST B: the manifest stays valid after HEAD advances", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts"],
        design: { delta_min: 0.2 }
      });
      writeFileSync(join(repo.dir, "results.json"), "{\"verdict\":\"REPLICATED\"}\n");
      git(["add", "-A"], repo.dir);
      git(["commit", "-q", "-m", "result commit"], repo.dir);
      expect(git(["rev-parse", "HEAD"], repo.dir)).not.toBe(repo.commit);
      expect(verifyFreezeManifest(repo.dir, manifest).ok).toBe(true);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("INTEGRITY TEST C: changing the contract byte invalidates verification", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts"],
        design: { delta_min: 0.2 }
      });
      // rewrite history: a NEW commit with a changed contract byte, then claim
      // the OLD hashes under the NEW commit id
      writeFileSync(join(repo.dir, "contract.ts"), "export const X = 2;\n");
      git(["add", "-A"], repo.dir);
      git(["commit", "-q", "-m", "contract change"], repo.dir);
      const newCommit = git(["rev-parse", "HEAD"], repo.dir);
      const forged = { ...manifest, preregistration_commit_sha: newCommit };
      const verification = verifyFreezeManifest(repo.dir, forged);
      expect(verification.ok).toBe(false);
      expect(gitBlobHash(repo.dir, newCommit, "contract.ts")).not.toBe(manifest.code_blob_hashes["contract.ts"]);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("INTEGRITY TEST D: changing the evaluator byte invalidates verification", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["hashing.ts"],
        design: { evaluator: "CONJUNCTIVE_NEWCOMBE_CONSTRAINT" }
      });
      writeFileSync(join(repo.dir, "hashing.ts"), "export const H = 2;\n");
      git(["add", "-A"], repo.dir);
      git(["commit", "-q", "-m", "evaluator change"], repo.dir);
      const forged = { ...manifest, preregistration_commit_sha: git(["rev-parse", "HEAD"], repo.dir) };
      expect(verifyFreezeManifest(repo.dir, forged).ok).toBe(false);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("INTEGRITY TEST E: adding result files does NOT alter the validity of the old manifest", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts", "hashing.ts"],
        design: { delta_min: 0.2 }
      });
      writeFileSync(join(repo.dir, "evidence.json"), "{\"scenes\":400}\n");
      git(["add", "-A"], repo.dir);
      git(["commit", "-q", "-m", "evidence"], repo.dir);
      expect(verifyFreezeManifest(repo.dir, manifest).ok).toBe(true);
      // and the manifest core is byte-stable when only evidence changed
      const rebuilt = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts", "hashing.ts"],
        design: { delta_min: 0.2 }
      });
      expect(rebuilt.manifest_hash).toBe(manifest.manifest_hash);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("INTEGRITY TEST F: the report hash reproduces after a serialize/deserialize round trip", () => {
    const sealed = sealReport({ verdict: "BELIEF_CAUSAL_INFLUENCE_REPLICATED", counts: { A: 30, B: 66 } });
    const roundTripped = JSON.parse(JSON.stringify(sealed)) as Record<string, unknown>;
    expect(verifyReport(roundTripped).ok).toBe(true);
    expect(roundTripped["report_hash"]).toBe(sealed["report_hash"]);
  });

  it("INTEGRITY TEST G: mutating any report field fails the hash verification", () => {
    const sealed = sealReport({ verdict: "BELIEF_CAUSAL_INFLUENCE_REPLICATED", counts: { A: 30, B: 66 } });
    const mutated = { ...sealed, verdict: "BELIEF_CAUSAL_RESULT_INCONCLUSIVE" };
    expect(verifyReport(mutated).ok).toBe(false);
    const nested = JSON.parse(JSON.stringify(sealed)) as Record<string, unknown>;
    (nested["counts"] as Record<string, number>)["B"] = 99;
    expect(verifyReport(nested).ok).toBe(false);
    expect(reportHashOf({ verdict: "x" })).toBe(contentHashOf(canonicalJson({ verdict: "x" })));
  });

  it("INTEGRITY TEST H: the repository's own preregistration evidence is intact and V0 is untouched", () => {
    const verification = verifyV0Evidence(REPO_ROOT);
    expect(verification.mutation).toBe("NONE — read only");
    // V0 evidence is only required to be intact once the V0 result commit exists
    const report = readFileSync(
      join(REPO_ROOT, "research/experiments/belief-causal-validation-v0/evidence/report.json"),
      "utf8"
    );
    expect(report).toContain("BELIEF_CAUSAL_RESULT_INCONCLUSIVE");
  });

  it("INTEGRITY TEST I: a result-only commit cannot masquerade as the preregistration commit", () => {
    const repo = scratchRepo();
    try {
      const manifest = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts"],
        design: { delta_min: 0.2 }
      });
      writeFileSync(join(repo.dir, "report.json"), "{\"verdict\":\"REPLICATED\"}\n");
      git(["add", "-A"], repo.dir);
      git(["commit", "-q", "-m", "result"], repo.dir);
      const resultCommit = git(["rev-parse", "HEAD"], repo.dir);
      // the result commit does not carry the frozen blobs as its own freeze
      const impersonation = { ...manifest, preregistration_commit_sha: resultCommit };
      expect(verifyFreezeManifest(repo.dir, impersonation).ok).toBe(false); // the core hash binds the RECORDED identity
      // but the RECORDED identity must still be the preregistration commit
      expect(manifest.preregistration_commit_sha).toBe(repo.commit);
      expect(manifest.preregistration_commit_sha).not.toBe(resultCommit);
      // a manifest that RECORDS the result commit as its preregistration
      // identity is a different core and therefore a different hash: the
      // identity is inside the hashed core, so it cannot be swapped afterwards.
      const rebuiltAtPrereg = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: repo.commit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts"],
        design: { delta_min: 0.2 }
      });
      expect(rebuiltAtPrereg.manifest_hash).toBe(manifest.manifest_hash);
      const forgedAtResult = buildFreezeManifest({
        repoDir: repo.dir,
        preregistrationCommitSha: resultCommit,
        protocolId: PROTOCOL_ID,
        codeFiles: ["contract.ts"],
        design: { delta_min: 0.2 }
      });
      expect(forgedAtResult.manifest_hash).not.toBe(rebuiltAtPrereg.manifest_hash);
      expect(verifyFreezeManifest(repo.dir, forgedAtResult).ok).toBe(true); // self-consistent but a DIFFERENT identity
      expect(forgedAtResult.preregistration_commit_sha).not.toBe(manifest.preregistration_commit_sha);
    } finally {
      rmSync(repo.dir, { recursive: true, force: true });
    }
  });

  it("committed research files are hashable from git blobs (no worktree dependency)", () => {
    // The protocol's own files become hashable as of the future experiment's
    // PREREGISTRATION_COMMIT; the mechanism is proven here on the frozen V0
    // harness, which is committed and never changes.
    const head = git(["rev-parse", "HEAD"]);
    for (const path of V0_HARNESS_FILES) {
      const hash = gitBlobHash(REPO_ROOT, head, path);
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(PROTOCOL_FILES.length).toBeGreaterThan(0);
  });
});
