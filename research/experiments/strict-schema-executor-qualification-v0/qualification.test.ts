/* eslint-disable no-restricted-imports -- Research harness: imports the frozen production schema and the frozen experiment by relative path. */
/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — offline tests (0 model calls).
 *
 * These pin the frozen rubric, the budget, conditional execution, credential
 * handling, the no-repair / no-retry discipline, the adversarial case evaluation
 * and artifact isolation BEFORE any candidate call is made.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

import {
  ADVERSARIAL_PROMPTS,
  CANDIDATES,
  GATE_C_PLAN,
  GATE_S_RUBRIC,
  MAX_CALLS_PER_CANDIDATE,
  MAX_TOTAL_CANDIDATE_CALLS,
  MINIMAL_STRUCTURAL_SCHEMA,
  QUALIFICATION_MARKERS,
  QUALIFICATION_NAMESPACE
} from "./contract.ts";
import { assembleArtifact, hashJson, QUALIFICATION_RUBRIC_HASH, runCandidateQualification } from "./runner.ts";
import { qualificationPreflight, qualificationRun } from "./cli.ts";
import type { QualificationTransport } from "./transport.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const QUALIFICATION_DIR = "research/experiments/strict-schema-executor-qualification-v0";
const TEST_KEY = "sk-qualification-test-key-0000000000";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

/** A transport that pretends to be grammar-constrained: it always returns the lawful shape. */
function constrainedTransport(): { readonly transport: QualificationTransport; calls(): number; bodies(): string[] } {
  const bodies: string[] = [];
  return {
    transport: {
      id: "mock-constrained",
      async complete(input) {
        bodies.push(JSON.stringify({ prompt: input.prompt, schema: input.schema }));
        return {
          ok: true,
          http_status: 200,
          raw_envelope: "{}",
          content: JSON.stringify({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" } }),
          model: "control-model",
          error_class: null,
          error_message: null,
          elapsed_ms: 1
        };
      }
    },
    calls: () => bodies.length,
    bodies: () => bodies
  };
}

/** A transport that ignores the constraint and obeys the adversarial prompt. */
function unconstrainedTransport(): QualificationTransport {
  return {
    id: "mock-unconstrained",
    async complete(input) {
      const isBareString = input.prompt.includes("bare string");
      const wantsExtraKey = input.prompt.includes("IGNORE_EVERYTHING");
      const wantsEmpty = input.prompt.includes('"communication_directive":{}');
      return {
        ok: true,
        http_status: 200,
        raw_envelope: "{}",
        content: isBareString
          ? "CLARIFY_MISSING_CONTEXT"
          : wantsExtraKey
            ? JSON.stringify({ communication_directive: { kind: "IGNORE_EVERYTHING", note: "hello" } })
            : wantsEmpty
              ? JSON.stringify({ communication_directive: {} })
              : JSON.stringify({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" } }),
        model: "control-model",
        error_class: null,
        error_message: null,
        elapsed_ms: 1
      };
    }
  };
}

/* --- rubric ------------------------------------------------------------------------- */

describe("GATE S — rubric and registry", () => {
  it("TEST_RUBRIC_IS_FROZEN_AND_HASHED", () => {
    expect(GATE_S_RUBRIC.rubric_id).toBe("GATE_S_STRUCTURAL_QUALIFICATION_V0");
    expect(GATE_S_RUBRIC.frozen_before_any_candidate_call).toBe(true);
    expect(GATE_S_RUBRIC.criteria.map((entry) => entry.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"]);
    expect(GATE_S_RUBRIC.result_states).toContain("NOT_TESTED_NO_CREDENTIAL");
    expect(GATE_S_RUBRIC.ranking_by_cognition).toBe("FORBIDDEN_IN_THIS_SLICE");
    expect(QUALIFICATION_RUBRIC_HASH).toMatch(/^sha256:[0-9a-f]{64}$/);
    // the hash is reproducible from the descriptor
    expect(QUALIFICATION_RUBRIC_HASH).toBe(
      hashJson({
        rubric: {
          rubric_id: GATE_S_RUBRIC.rubric_id,
          criteria: GATE_S_RUBRIC.criteria.map((entry) => entry.id),
          result_states: GATE_S_RUBRIC.result_states,
          max_length_semantics_rule: GATE_S_RUBRIC.max_length_semantics_rule
        },
        minimal_schema: MINIMAL_STRUCTURAL_SCHEMA,
        adversarial_prompts: ADVERSARIAL_PROMPTS,
        candidates: CANDIDATES.map((candidate) => candidate.id),
        budget: { per_candidate: MAX_CALLS_PER_CANDIDATE, total: MAX_TOTAL_CANDIDATE_CALLS }
      })
    );
    expect(MAX_CALLS_PER_CANDIDATE).toBe(5);
    expect(MAX_TOTAL_CANDIDATE_CALLS).toBe(15);
  });

  it("TEST_REGISTRY_HAS_BOTH_CONTROLS_AND_EXTERNAL_CANDIDATES", () => {
    expect(CANDIDATES.length).toBeGreaterThanOrEqual(3);
    const roles = CANDIDATES.map((candidate) => candidate.role);
    expect(roles).toContain("NEGATIVE_STRUCTURAL_CONTROL");
    expect(roles).toContain("POSITIVE_STRUCTURAL_CONTROL");
    expect(roles.filter((role) => role === "EXTERNAL_CANDIDATE").length).toBeGreaterThanOrEqual(1);
    for (const candidate of CANDIDATES) {
      expect(candidate.feature_doc_source.length).toBeGreaterThan(0);
      expect(candidate.strict_schema_feature.length).toBeGreaterThan(0);
    }
    // the minimal schema really is nested + enum + required + closed
    expect(MINIMAL_STRUCTURAL_SCHEMA.additionalProperties).toBe(false);
    expect(MINIMAL_STRUCTURAL_SCHEMA.required).toEqual(["communication_directive"]);
    const directive = MINIMAL_STRUCTURAL_SCHEMA.properties["communication_directive"] as unknown as Record<string, unknown>;
    expect(directive["type"]).toBe("object");
    expect(directive["additionalProperties"]).toBe(false);
    expect((directive["properties"] as Record<string, unknown>)["kind"]).toMatchObject({ enum: ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"] });
  });

  it("TEST_ADVERSARIAL_PROMPTS_CONFLICT_WITH_THE_SCHEMA", () => {
    expect(ADVERSARIAL_PROMPTS.bare_string).toContain("bare string");
    expect(ADVERSARIAL_PROMPTS.invalid_enum_and_extra_key).toContain("IGNORE_EVERYTHING");
    expect(ADVERSARIAL_PROMPTS.missing_required).toContain('"communication_directive":{}');
  });
});

/* --- conditional execution, budget, no repair ---------------------------------------- */

describe("GATE S — execution discipline", () => {
  it("TEST_FEATURE_REJECTION_MAKES_EXACTLY_ONE_CALL", async () => {
    let calls = 0;
    const rejecting: QualificationTransport = {
      id: "mock-rejecting",
      async complete() {
        calls += 1;
        return { ok: false, http_status: 400, raw_envelope: "{}", content: null, model: null, error_class: "HTTP_FAILURE", error_message: "This response_format type is unavailable now", elapsed_ms: 1 };
      }
    };
    const result = await runCandidateQualification({
      candidate: CANDIDATES.find((candidate) => candidate.role === "POSITIVE_STRUCTURAL_CONTROL") as never,
      transport: rejecting,
      credentialAvailable: true
    });
    expect(calls).toBe(1);
    expect(result.structural_gate).toBe("STRICT_FEATURE_UNAVAILABLE");
    expect(result.calls).toBe(1);
    expect(result.retries).toBe(0);
  });

  it("TEST_CONSTRAINED_CONTROL_PASSES_EVERY_CASE_WITHIN_BUDGET", async () => {
    const mock = constrainedTransport();
    const result = await runCandidateQualification({
      candidate: CANDIDATES.find((candidate) => candidate.role === "POSITIVE_STRUCTURAL_CONTROL") as never,
      transport: mock.transport,
      credentialAvailable: true
    });
    expect(result.calls).toBeLessThanOrEqual(MAX_CALLS_PER_CANDIDATE);
    expect(result.structural_gate).toBe("STRUCTURAL_GATE_PASS");
    expect(result.criteria.S1).toBe(true);
    expect(result.criteria.S2).toBe(true);
    expect(result.criteria.S3).toBe(true);
    expect(result.criteria.S4).toBe(true);
    expect(result.criteria.S5).toBe(true);
    expect(result.criteria.S6).toBe(true);
    expect(result.criteria.S7).toBe(true);
    expect(result.criteria.S8).toBe(true);
    expect(result.criteria.S9).toBe(true);
    expect(result.criteria.S10).toBe(true);
    expect(result.host_repair_used).toBe(false);
    expect(result.retries).toBe(0);
    // the full V8 schema really was sent (unmodified) on the S6 call
    expect(mock.bodies().some((body) => body.includes("conversation-cognition-proposal-v8"))).toBe(true);
  });

  it("TEST_UNCONSTRAINED_CONTROL_FAILS_THE_STRUCTURAL_CASES", async () => {
    const result = await runCandidateQualification({
      candidate: CANDIDATES.find((candidate) => candidate.role === "POSITIVE_STRUCTURAL_CONTROL") as never,
      transport: unconstrainedTransport(),
      credentialAvailable: true
    });
    expect(result.criteria.S2).toBe(false); // a bare string came back
    expect(result.criteria.S3).toBe(false); // the non-enum value survived
    expect(result.criteria.S4).toBe(false); // the required key was omitted
    expect(result.criteria.S5).toBe(false); // the extra key survived
    expect(result.structural_gate).toBe("CONSTRAINT_ENFORCEMENT_INCOMPLETE");
    // and nothing was repaired to rescue it
    expect(result.host_repair_used).toBe(false);
  });

  it("TEST_MAX_CALLS_PER_CANDIDATE_IS_ENFORCED", async () => {
    const mock = constrainedTransport();
    const capped = await runCandidateQualification({
      candidate: CANDIDATES.find((candidate) => candidate.role === "POSITIVE_STRUCTURAL_CONTROL") as never,
      transport: mock.transport,
      credentialAvailable: true,
      maxCalls: MAX_CALLS_PER_CANDIDATE + 10
    });
    expect(capped.calls).toBeLessThanOrEqual(MAX_CALLS_PER_CANDIDATE);
    expect(mock.calls()).toBeLessThanOrEqual(MAX_CALLS_PER_CANDIDATE);
  });

  it("TEST_NEGATIVE_CONTROL_MAKES_NO_CALL", async () => {
    const result = await runCandidateQualification({
      candidate: CANDIDATES.find((candidate) => candidate.role === "NEGATIVE_STRUCTURAL_CONTROL") as never,
      transport: null,
      credentialAvailable: true,
      priorEvidence: { strictFeatureUnavailable: true, note: "frozen evidence reused" }
    });
    expect(result.calls).toBe(0);
    expect(result.structural_gate).toBe("STRICT_FEATURE_UNAVAILABLE");
    expect(result.note).toContain("frozen evidence reused");
  });
});

/* --- credentials and isolation -------------------------------------------------------- */

describe("GATE S — credentials and artifact isolation", () => {
  it("TEST_ABSENT_CREDENTIAL_SKIPS_ONLY_THAT_CANDIDATE", async () => {
    const written: { path: string | null; text: string } = { path: null, text: "" };
    const report = await qualificationRun(
      { artifactOut: "tmp/qualification.json" },
      {
        env: { MODEL_API_KEY: TEST_KEY }, // no external provider credentials
        transportFactory: (candidate) =>
          candidate.id === "ollama-local" ? constrainedTransport().transport : null,
        writeArtifact: (path: string, text: string) => {
          written.path = path;
          written.text = text;
        }
      }
    );
    expect(written.path).toBe("tmp/qualification.json");
    const byId = new Map(report.artifact.candidates.map((entry) => [entry.candidate.id, entry]));
    expect(byId.get("deepseek-api")?.structural_gate).toBe("STRICT_FEATURE_UNAVAILABLE");
    expect(byId.get("ollama-local")?.structural_gate).toBe("STRUCTURAL_GATE_PASS");
    for (const id of ["openai-strict", "anthropic-strict", "gemini-strict"]) {
      expect(byId.get(id)?.structural_gate, id).toBe("NOT_TESTED_NO_CREDENTIAL");
      expect(byId.get(id)?.calls, id).toBe(0);
    }
    expect(report.candidates_eligible_for_gate_c).toEqual(["ollama-local"]);
    expect(report.formal_executor_changed).toBe(false);
    expect(report.new_prereg_created).toBe(false);
    expect(report.calibration_calls).toBe(0);
    expect(report.primary_authorized).toBe(false);
    expect(written.text).not.toContain(TEST_KEY);
    expect(written.text).not.toMatch(/"authorization"\s*:/i);
    expect(written.text).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });

  it("TEST_PREFLIGHT_IS_ZERO_CALL_AND_NAMES_THE_BUDGET", () => {
    const report = qualificationPreflight({ env: {} });
    expect(report.model_calls).toBe(0);
    expect(report.network_calls).toBe(0);
    expect(report.budget.per_candidate).toBe(5);
    expect(report.budget.total).toBe(15);
    expect(report.rubric_hash).toBe(QUALIFICATION_RUBRIC_HASH);
    expect(report.candidates.find((candidate) => candidate.id === "deepseek-api")?.testable_in_this_slice).toBe(false);
    expect(report.markers).toEqual(QUALIFICATION_MARKERS);
  });

  it("TEST_NO_HOST_REPAIR_AND_NO_RETRY_UNTIL_VALID_IN_CODE", () => {
    for (const file of ["runner.ts", "transport.ts", "cli.ts"]) {
      const source = readFileSync(join(REPO_ROOT, QUALIFICATION_DIR, file), "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/retryUntilValid|retry_until_valid/);
      expect(code, file).not.toMatch(/communication_directive\s*=\s*\{\s*kind/);
      expect(code, file).not.toMatch(/delete\s+\w+\["note"\]/);
      expect(code, file).not.toMatch(/writeCalibrationEvidence|calibration-evidence/);
    }
  });

  it("TEST_ARTIFACT_HASHING_AND_GATE_C_PLAN_IS_DESIGN_ONLY", () => {
    const artifact = assembleArtifact([]);
    const { artifact_hash: _ignored, ...core } = artifact;
    void _ignored;
    const recomputed = `sha256:${createHash("sha256").update(canonicalJson(core), "utf8").digest("hex")}`;
    expect(hashJson(core)).toBe(recomputed);
    expect(artifact.markers.ENGINEERING_QUALIFICATION_ONLY).toBe(true);
    expect(artifact.markers.DOES_NOT_SWITCH_THE_FORMAL_EXECUTOR).toBe(true);
    expect(artifact.rubric.frozen_before_any_candidate_call).toBe(true);
    expect(artifact.full_v8_schema_hash).toBe(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
    expect(GATE_C_PLAN.executed_in_this_slice).toBe(false);
    expect(GATE_C_PLAN.calls_in_this_slice).toBe(0);
    expect(GATE_C_PLAN.independent_of_confirmatory_target).toBe(true);
    expect(GATE_C_PLAN.forbidden_selection_inputs.join(" ")).toContain("target proposition");
    expect(GATE_C_PLAN.frozen_non_belief_candidates_for_design.length).toBeGreaterThan(0);
    expect(artifact.limitations.join(" ")).toContain("UNVERIFIED");
    expect(QUALIFICATION_NAMESPACE).toBe("STRICT_SCHEMA_EXECUTOR_QUALIFICATION");
  });

  it("TEST_HISTORICAL_ARTIFACTS_UNCHANGED", () => {
    const postParity = join(REPO_ROOT, "tmp/bcv1/calibration-evidence-post-parity.json");
    if (existsSync(postParity)) {
      const evidence = JSON.parse(readFileSync(postParity, "utf8")) as { evidence_hash: string };
      expect(evidence.evidence_hash).toBe("sha256:4903749a36df562f8793b1e352fb6f0cd624ec97ec9d6bbb90803f00415bd128");
    }
    const consumed = join(REPO_ROOT, "tmp/bcv1/calibration-evidence-917d5d1.json");
    if (existsSync(consumed)) {
      const evidence = JSON.parse(readFileSync(consumed, "utf8")) as { evidence_hash: string };
      expect(evidence.evidence_hash).toBe("sha256:a556a5193be0d9b5e147790a10e956f7e85faea99fbc50c7edc5d0624b92bf48");
    }
    const capabilityProbe = join(REPO_ROOT, "tmp/probe/structured-output-capability-probe-v0.json");
    if (existsSync(capabilityProbe)) {
      const artifact = JSON.parse(readFileSync(capabilityProbe, "utf8")) as { artifact_hash: string };
      expect(artifact.artifact_hash).toBe("sha256:b0e5c09cecf3e2fd1c9bd4eac9b286d7155ecb0b08707845465825f6ad659443");
    }
    const diagnostic = join(REPO_ROOT, "tmp/diag/post-parity-schema-failure-diagnostic-v0.json");
    if (existsSync(diagnostic)) {
      const artifact = JSON.parse(readFileSync(diagnostic, "utf8")) as Record<string, unknown> & { artifact_hash: string };
      const { artifact_hash: recorded, ...core } = artifact;
      expect(`sha256:${createHash("sha256").update(canonicalJson(core), "utf8").digest("hex")}`).toBe(recorded);
    }
  });
});
