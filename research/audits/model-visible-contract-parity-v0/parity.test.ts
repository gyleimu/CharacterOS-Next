/* eslint-disable no-restricted-imports -- Research harness: imports frozen production contracts and the consumed calibration record by relative path. */
/**
 * MODEL-VISIBLE CONTRACT PARITY REMEDIATION — tests A–O.
 *
 * ZERO model calls, ZERO network calls. These tests pin the three-layer parity
 * (production validator ↔ model-facing schema ↔ system prompt) and the immutability
 * of the historical record.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeConversationCognitionModelOutputV8,
  CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS,
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0,
  SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1
} from "../../../packages/runtime/dist/index.js";
import {
  CONVERSATION_COGNITION_FIELD_BOUNDS_CLAUSE_V8,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
  renderCognitionProposalContractV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

import {
  buildCalibrationProjection,
  buildCalibrationRequest,
  buildCalibrationSubject,
  FROZEN_CALIBRATION_REQUEST_HASH,
  serializeAuthoritativeRequest
} from "../../experiments/belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { CALIBRATION_LAW } from "../../experiments/belief-causal-confirmatory-stochastic-v1/calibration-law.ts";
import { CURRENT_SCENE, MODEL, modelConfigManifest } from "../../experiments/belief-causal-confirmatory-stochastic-v1/contract.ts";
import { hashJson } from "../../experiments/belief-causal-confirmatory-stochastic-v1/histories.ts";

import { buildParityInventory, CONSTRAINT_SPECS, inventorySummary } from "./inventory.ts";
import {
  CONSUMED_CONTRACT,
  liveSchemaHash,
  liveSystemHash,
  REMEDIATED_CONTRACT,
  REMEDIATED_REQUEST
} from "./contract-authority.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const CALIBRATION_EVIDENCE_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1/evidence";
const DIAGNOSTIC_ARTIFACT = join(REPO_ROOT, "tmp/diag/executor-schema-failure-diagnostic-v0.json");

/** Recorded historical values — the consumed calibration and its artifacts. */
const CONSUMED_REQUEST_HASH = "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509";
const CONSUMED_SYSTEM_HASH = "sha256:9241794b19b06b7a85a020c0c2a3522fd14504c80689ef8a3180afed8e25dc2c";
const CONSUMED_SCHEMA_HASH = "sha256:e9da721b67903c40e40f32dc1989456924923167e921e47cdd2231a78ee771b9";
const CONSUMED_DIAGNOSTIC_ARTIFACT_HASH = "sha256:4295cdc473128730c302055c84987527a70ea79ac5ba7432e95962ccd59a0da5";
const CONSUMED_CALIBRATION_EVIDENCE_HASH = "sha256:a556a5193be0d9b5e147790a10e956f7e85faea99fbc50c7edc5d0624b92bf48";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function canonicalHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

/** A CLARIFY proposal whose only varying part is the basis text. */
function clarificationProposal(missingInformation: string, neededFor = "planning"): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v8",
    response_semantics: { kind: "PRIMARY_CLARIFICATION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "parity fixture",
      relevant_memory_handles: [],
      considered_handles: ["F1", "C1"],
      current_intent: "respond",
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_handles: []
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
    clarification_basis: {
      current_observation_ref: "observation:o-source-event-bcv1-current-scene-1",
      missing_information: missingInformation,
      needed_for: neededFor
    }
  };
}

async function productionVerdict(proposal: Record<string, unknown>): Promise<{ ok: boolean; detail: string | null }> {
  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);
  const checked = canonicalizeConversationCognitionModelOutputV8(proposal as never, projection as never, (projection as { projection_hash: string }).projection_hash as never);
  return checked.ok ? { ok: true, detail: null } : { ok: false, detail: checked.detail };
}

const MULTIBYTE = "𝔼"; // U+1D53C: 4 UTF-8 bytes, 2 UTF-16 code units, 1 code point

/* -------------------------------------------------------------------------- */
/* A / B — the bound is exposed in the schema and in the prompt                */
/* -------------------------------------------------------------------------- */

describe("PARITY — A/B: the 256 code-point law reaches the executor", () => {
  it("TEST_A_SCHEMA_EXPOSES_256", () => {
    const items = buildParityInventory();
    const basis = items.find((item) => item.id === "BASIS_MISSING_INFORMATION_LENGTH");
    expect(basis?.schema_representation).toContain("maxLength=256");
    expect(basis?.schema_representation).toContain("minLength=1");
    expect(basis?.schema_exposes_bound).toBe(true);
    const node = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { clarification_basis: { anyOf: readonly { properties?: Record<string, Record<string, unknown>> }[] } };
      }
    ).properties.clarification_basis.anyOf[1].properties?.["missing_information"];
    expect(node?.["maxLength"]).toBe(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS);
    expect(node?.["maxLength"]).toBe(256);
    // the LENGTH rule must NOT be advertised as trim-based
    expect(node?.["pattern"]).toBeUndefined();
    expect(node?.["minLength"]).toBe(1);
  });

  it("TEST_B_PROMPT_EXPOSES_256", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V8;
    expect(prompt).toContain(
      "clarification_basis.missing_information must contain at least one character and at most 256 code points"
    );
    expect(prompt).toContain("clarification_basis.needed_for must contain at least one character and at most 256 code points");
    expect(prompt).toContain("18. FIELD BOUNDS (binding");
    expect(prompt).toContain("the host never truncates, repairs or coerces your text");
    // and the rendered contract section states the same bound next to the field
    expect(renderCognitionProposalContractV8(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).toContain(
      "missing_information: string (at least one character, at most 256 code points)"
    );
    // the clause is generated from the validator's own constant
    expect(CONVERSATION_COGNITION_FIELD_BOUNDS_CLAUSE_V8).toContain(String(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS));
  });
});

/* -------------------------------------------------------------------------- */
/* C–F — production acceptance is unchanged at the boundary                    */
/* -------------------------------------------------------------------------- */

describe("PARITY — C/D/E/F: the host still accepts 255/256 and rejects 257", () => {
  it("TEST_C_PRODUCTION_STILL_ENFORCES_256", async () => {
    const verdict = await productionVerdict(clarificationProposal("a".repeat(257)));
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("missing_information: exceeds 256 code points");
  });

  it("TEST_D_255_PASSES", async () => {
    expect((await productionVerdict(clarificationProposal("a".repeat(255)))).ok).toBe(true);
  });

  it("TEST_E_256_PASSES", async () => {
    expect((await productionVerdict(clarificationProposal("a".repeat(256)))).ok).toBe(true);
  });

  it("TEST_F_257_FAILS", async () => {
    expect((await productionVerdict(clarificationProposal("a".repeat(257)))).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* G — the semantic unit is the Unicode code point                             */
/* -------------------------------------------------------------------------- */

describe("PARITY — G: the metric is Unicode code points, not bytes or UTF-16 units", () => {
  it("TEST_G_MULTIBYTE_CODE_POINT_PARITY", async () => {
    // 256 multi-byte code points = 1024 UTF-8 bytes = 512 UTF-16 units.
    const atBound = MULTIBYTE.repeat(256);
    expect(atBound.length).toBe(512); // UTF-16 code units
    expect(Buffer.byteLength(atBound, "utf8")).toBe(1024); // UTF-8 bytes
    expect([...atBound].length).toBe(256); // code points — the host's unit
    expect((await productionVerdict(clarificationProposal(atBound))).ok).toBe(true);
    expect((await productionVerdict(clarificationProposal(MULTIBYTE.repeat(255)))).ok).toBe(true);
    const overBound = MULTIBYTE.repeat(257);
    expect(Buffer.byteLength(overBound, "utf8")).toBe(1028);
    const verdict = await productionVerdict(clarificationProposal(overBound));
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("exceeds 256 code points");
    // a 512-byte, 256-code-point value is lawful, so bytes are demonstrably not the metric
    expect((await productionVerdict(clarificationProposal("é".repeat(256)))).ok).toBe(true);
  });

  it("TEST_G2_SCHEMA_UNIT_MATCHES_THE_VALIDATOR_UNIT", () => {
    // JSON Schema maxLength counts code points, the same unit the validator uses.
    const node = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { clarification_basis: { anyOf: readonly { properties?: Record<string, Record<string, unknown>> }[] } };
      }
    ).properties.clarification_basis.anyOf[1].properties?.["missing_information"];
    expect(node?.["maxLength"]).toBe(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS);
    expect([...MULTIBYTE.repeat(256)].length).toBe(256);
  });
});

/* -------------------------------------------------------------------------- */
/* H — the captured diagnostic example still fails, offline                    */
/* -------------------------------------------------------------------------- */

describe("PARITY — H: the captured 273-code-point rejection still reproduces", () => {
  it("TEST_H_DIAGNOSTIC_273_REGRESSION", async () => {
    // (1) A synthetic fixture of the SAME length always reproduces the rejection.
    const synthetic = "x".repeat(273);
    const verdict = await productionVerdict(clarificationProposal(synthetic));
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("exceeds 256 code points");

    // (2) When the captured artifact is present, its REAL 273-code-point value is
    // replayed against the host — offline, without modifying the artifact.
    if (!existsSync(DIAGNOSTIC_ARTIFACT)) return;
    const artifact = JSON.parse(readFileSync(DIAGNOSTIC_ARTIFACT, "utf8")) as {
      artifact_hash: string;
      responses: readonly { readonly schema_valid: boolean; readonly raw_content: string | null }[];
    };
    const captured = artifact.responses.find((response) => !response.schema_valid);
    expect(captured).toBeDefined();
    const parsed = JSON.parse(captured?.raw_content ?? "{}") as { clarification_basis?: { missing_information?: string } };
    const value = parsed.clarification_basis?.missing_information ?? "";
    expect([...value].length).toBe(273);
    const replayed = await productionVerdict({ ...clarificationProposal(value), response_semantics: { kind: "PRIMARY_CLARIFICATION" } });
    expect(replayed.ok).toBe(false);
    expect(replayed.detail).toContain("missing_information: exceeds 256 code points");
  });
});

/* -------------------------------------------------------------------------- */
/* I — no truncation, repair or coercion                                       */
/* -------------------------------------------------------------------------- */

describe("PARITY — I: the host never truncates or repairs model text", () => {
  it("TEST_I_NO_AUTOMATIC_TRUNCATION", async () => {
    const verdict = await productionVerdict(clarificationProposal("y".repeat(400)));
    expect(verdict.ok).toBe(false);
    // A rejected response is rejected — there is no repaired proposal to accept.
    const source = ["conversation-cognition-proposal.ts", "factual-claim-authorization.ts"].map((file) =>
      readFileSync(join(REPO_ROOT, "packages/runtime/src/transitions/conversation", file), "utf8")
    );
    for (const text of source) {
      expect(text).not.toMatch(/slice\(\s*0\s*,\s*(256|CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS)/);
      expect(text).not.toMatch(/substring\(\s*0\s*,\s*(256|CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS)/);
      expect(text).not.toMatch(/missing_information\s*=\s*.*\.slice\(/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* J — the historical calibration record is intact                             */
/* -------------------------------------------------------------------------- */

describe("PARITY — J: the consumed calibration record is untouched", () => {
  it("TEST_J_OLD_CALIBRATION_EVIDENCE_UNCHANGED", () => {
    const tracked = readFileSync(join(REPO_ROOT, CALIBRATION_EVIDENCE_DIR, "calibration-request.json"), "utf8");
    const parsed = JSON.parse(tracked) as { hashes: { model_facing_request_hash: string; system_hash: string; schema_hash: string } };
    // The consumed request, system and schema hashes are still the historical ones.
    expect(parsed.hashes.model_facing_request_hash).toBe(CONSUMED_REQUEST_HASH);
    expect(parsed.hashes.system_hash).toBe(CONSUMED_SYSTEM_HASH);
    expect(parsed.hashes.schema_hash).toBe(CONSUMED_SCHEMA_HASH);
    // And the historical constant in the consumed experiment still names it.
    expect(FROZEN_CALIBRATION_REQUEST_HASH).toBe(CONSUMED_REQUEST_HASH);

    // The consumed calibration evidence artifact (untracked scratch) is intact.
    const evidencePath = join(REPO_ROOT, "tmp/bcv1/calibration-evidence-917d5d1.json");
    if (existsSync(evidencePath)) {
      const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as { evidence_hash: string; approved_prereg_sha: string };
      expect(evidence.evidence_hash).toBe(CONSUMED_CALIBRATION_EVIDENCE_HASH);
      expect(evidence.approved_prereg_sha).toBe("917d5d107cc29033b036682875b69be9d02d34f2");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* K — the diagnostic artifact is intact                                       */
/* -------------------------------------------------------------------------- */

describe("PARITY — K: the exploratory diagnostic artifact is untouched", () => {
  it("TEST_K_OLD_DIAGNOSTIC_ARTIFACT_UNCHANGED", () => {
    if (!existsSync(DIAGNOSTIC_ARTIFACT)) return;
    const artifact = JSON.parse(readFileSync(DIAGNOSTIC_ARTIFACT, "utf8")) as Record<string, unknown> & { artifact_hash: string };
    const { artifact_hash: recorded, ...core } = artifact;
    expect(canonicalHash(core)).toBe(recorded);
    expect(recorded).toBe(CONSUMED_DIAGNOSTIC_ARTIFACT_HASH);
  });
});

/* -------------------------------------------------------------------------- */
/* L / M — the request hash moved and stays deterministic                      */
/* -------------------------------------------------------------------------- */

describe("PARITY — L/M: a NEW request authority, proven deterministic", () => {
  it("TEST_L_REQUEST_CHANGED_FROM_THE_CONSUMED_HASH", async () => {
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    expect(request.hashes.model_facing_request_hash).not.toBe(CONSUMED_REQUEST_HASH);
    expect(request.hashes.system_hash).not.toBe(CONSUMED_SYSTEM_HASH);
    expect(request.hashes.schema_hash).not.toBe(CONSUMED_SCHEMA_HASH);
    // The subject rendering and the model configuration are untouched.
    expect(request.hashes.user_hash).toBe("sha256:55d27d60fe3087537e66c1075dbe43677160ddbc0d8569207577b46962a219f3");
    expect(request.hashes.model_config_hash).toBe("sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5");
    expect(Buffer.byteLength(serializeAuthoritativeRequest(request.body), "utf8")).toBeGreaterThan(16085);
  });

  it("TEST_M_NEW_REQUEST_IS_100X_DETERMINISTIC", async () => {
    const hashes = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const request = await buildCalibrationRequest({
        schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
        modelConfigHash: hashJson(modelConfigManifest())
      });
      hashes.add(request.hashes.model_facing_request_hash);
    }
    expect(hashes.size).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* N — the scientific design is untouched                                      */
/* -------------------------------------------------------------------------- */

describe("PARITY — N: scientific design and statistical law are unchanged", () => {
  it("TEST_N_NO_TREATMENT_SCENARIO_OR_STATISTICAL_CHANGE", () => {
    expect(CURRENT_SCENE.text).toContain("service passage");
    expect(MODEL.id).toBe("deepseek-flash");
    expect(MODEL.temperature).toBe(0);
    expect(MODEL.max_tokens).toBe(16384);
    expect(MODEL.fallbacks).toEqual([]);
    expect(CALIBRATION_LAW.scheduled_logical_trials).toBe(50);
    expect(CALIBRATION_LAW.minimum_host_valid_count).toBe(48);
    expect(CALIBRATION_LAW.maximum_non_host_valid_count).toBe(2);
    expect(CALIBRATION_LAW.outcome_diversity_gate).toBe("NONE");
    expect(CALIBRATION_LAW.modifies).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* O — the parity inventory has no unexplained gap                             */
/* -------------------------------------------------------------------------- */

describe("PARITY — O: no unexplained PRODUCTION_ONLY model-authored constraint", () => {
  it("TEST_O_PARITY_INVENTORY_IS_COMPLETE", () => {
    const items = buildParityInventory();
    expect(items.length).toBe(CONSTRAINT_SPECS.length);
    const summary = inventorySummary(items);
    expect(summary.unexplained_production_only).toEqual([]);
    for (const item of items) {
      if (item.status === "NOT_MODEL_RELEVANT") continue;
      expect(item.status, `${item.id} is ${item.status}`).toBe("FULL_PARITY");
      expect(item.schema_exposes_bound, `${item.id} schema`).toBe(true);
      expect(item.prompt_exposes_bound, `${item.id} prompt`).toBe(true);
    }
    // every bounded model-authored text field declares the SAME number in both layers
    for (const item of items) {
      if (item.production_constant === null || !item.field_path.includes(".")) continue;
      const bound = String(item.production_constant.value);
      expect(item.schema_representation, item.id).toContain(bound);
      expect(item.prompt_representation, item.id).toContain(bound);
    }
  });

  it("TEST_O2_THE_TWO_NON_EMPTINESS_RULES_ARE_NOT_CONFLATED", () => {
    const items = buildParityInventory();
    const basis = items.find((item) => item.id === "BASIS_MISSING_INFORMATION_LENGTH");
    const claimText = items.find((item) => item.id === "CLAIM_TEXT_LENGTH");
    expect(basis?.non_empty_rule).toBe("LENGTH");
    expect(claimText?.non_empty_rule).toBe("AFTER_TRIM");
    // the schema mirrors the distinction: only the trim-based field carries pattern
    const basisNode = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { clarification_basis: { anyOf: readonly { properties?: Record<string, Record<string, unknown>> }[] } };
      }
    ).properties.clarification_basis.anyOf[1].properties?.["missing_information"];
    const claimNode = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { factual_assessment: { properties: { claims: { items: { oneOf: readonly { properties: Record<string, Record<string, unknown>> }[] } } } } };
      }
    ).properties.factual_assessment.properties.claims.items.oneOf[0].properties["text"];
    expect(basisNode?.["pattern"]).toBeUndefined();
    expect(claimNode?.["pattern"]).toBe("\\S");
    expect(claimNode?.["maxLength"]).toBe(FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0);
    expect(
      (CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as { properties: { subjective_selection: { oneOf: readonly { properties: Record<string, Record<string, unknown>> }[] } } })
        .properties.subjective_selection.oneOf[1].properties["stance"]?.["maxLength"]
    ).toBe(SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1);
  });

  it("TEST_O3_WHITESPACE_ONLY_IS_STILL_LAWFUL_ONLY_WHERE_THE_HOST_ALLOWS_IT", async () => {
    // LENGTH rule: a whitespace-only basis value is lawful, so the contract must not forbid it.
    expect((await productionVerdict(clarificationProposal(" ".repeat(10)))).ok).toBe(true);
    // and the schema advertises exactly that (no pattern on the basis field).
    const basisNode = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { clarification_basis: { anyOf: readonly { properties?: Record<string, Record<string, unknown>> }[] } };
      }
    ).properties.clarification_basis.anyOf[1].properties?.["missing_information"];
    expect(basisNode?.["pattern"]).toBeUndefined();
    // an EMPTY basis value remains rejected by the host.
    expect((await productionVerdict(clarificationProposal(""))).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* P — the recorded NEW authority matches the live artefacts                   */
/* -------------------------------------------------------------------------- */

describe("PARITY — P: the recorded contract authority is computed, not asserted", () => {
  it("TEST_P_RECORDED_AUTHORITY_MATCHES_THE_LIVE_CONTRACT", () => {
    expect(liveSchemaHash()).toBe(REMEDIATED_CONTRACT.schema_hash);
    expect(liveSystemHash()).toBe(REMEDIATED_CONTRACT.system_hash);
    expect(liveSchemaHash()).not.toBe(CONSUMED_CONTRACT.schema_hash);
    expect(liveSystemHash()).not.toBe(CONSUMED_CONTRACT.system_hash);
  });

  it("TEST_P2_THE_CONSUMED_AUTHORITY_IS_RECORDED_AND_NEVER_REISSUED", async () => {
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    // The REMEDIATED request is the live one and is recorded as data.
    expect(request.hashes.model_facing_request_hash).toBe(REMEDIATED_REQUEST.request_hash);
    expect(Buffer.byteLength(serializeAuthoritativeRequest(request.body), "utf8")).toBe(REMEDIATED_REQUEST.body_bytes);
    expect(CONSUMED_CONTRACT.status).toBe("CONSUMED_BY_EXECUTOR_CALIBRATION_STOP_EARLY");
    expect(FROZEN_CALIBRATION_REQUEST_HASH).toBe(CONSUMED_CONTRACT.request_hash);
    expect(request.hashes.model_facing_request_hash).not.toBe(CONSUMED_CONTRACT.request_hash);
    expect(CONSUMED_CONTRACT.body_bytes).toBe(16085);
    expect(Buffer.byteLength(serializeAuthoritativeRequest(request.body), "utf8")).not.toBe(CONSUMED_CONTRACT.body_bytes);
  });
});
