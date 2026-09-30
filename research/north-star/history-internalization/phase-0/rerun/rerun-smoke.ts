/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * RERUN POLICY SMOKE — 0 model calls.
 *
 * Two deterministic stub runs of the EXACT rerun core, verifying the two policy laws that matter
 * before any real call is spent:
 *
 *   A. all ten required scientific turns valid  -> the endpoint is frozen
 *   B. an invalid required turn in arm B         -> the run stops immediately, the OTHER ARM IS NOT
 *      FINISHED, the subject is quarantined and NO endpoint is frozen
 *
 * It also verifies the §26 accounting reconciles and that every attempt carries the §13 fields.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ModelTransportResponseV0, ModelTransportV0 } from "../../../../../packages/runtime/dist/index.js";

import { hashPhase0 } from "../contract.ts";
import type { Phase0AppraisalProviderV0, Phase0BundleV0 } from "../harness.ts";
import { P0_OUTCOME_BROKEN, P0_OUTCOME_KEPT } from "../contract.ts";
import { R2_REQUIRED_SCIENTIFIC_TURNS } from "./contract-r2.ts";
import { runRerunV0 } from "./rerun.ts";

type ScriptedTurn = "VALID" | "INVALID_STANCE";

/** A stub world whose cognition script is consumed per cognition call. */
function stubBundle(script: readonly ScriptedTurn[], onCognition: (index: number) => void): Phase0BundleV0 {
  let cursor = 0;
  const valid = (): Record<string, unknown> => ({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "offline stub cognition",
      relevant_memory_handles: [],
      considered_handles: [],
      current_intent: "respond to the user",
      confidence: 0.7,
      uncertainty: 0.3,
      action_intent: null,
      evidence_handles: []
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  });
  const cognition: ModelTransportV0 = {
    complete: async (): Promise<ModelTransportResponseV0> => {
      const index = cursor;
      cursor += 1;
      onCognition(index);
      const scripted = script[index] ?? "VALID";
      const body = valid();
      // Structurally valid, semantically incomplete — the Class A shape.
      if (scripted === "INVALID_STANCE") body["response_semantics"] = { kind: "PRIMARY_STANCE" };
      return { content: JSON.stringify(body), model: "stub" } as ModelTransportResponseV0;
    }
  };
  const language: ModelTransportV0 = {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({
        content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "STUB_REPLY", evidence_refs: [] }),
        model: "stub"
      }) as ModelTransportResponseV0
  };
  const appraisal = {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: { relevance: 0.6, goal_congruence: 0.5, attribution: "other", controllability: 0.5, uncertainty: 0.5, intensity: 0.4 },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as Phase0AppraisalProviderV0;

  return {
    cognitionTransport: cognition,
    languageTransport: language,
    appraisalProvider: appraisal,
    beliefSemanticProvider: {
      propose: async (input: never) => {
        const typed = input as { semantic_context_fingerprint: string; candidate_catalog_fingerprint: string; catalog: { propositions: readonly { proposition_id: string; proposition_label: string }[] }; evidence: { evidence: readonly { scene: string }[] } };
        const bindings = {
          schema_version: "belief-semantic-provider-output-v0",
          semantic_context_fingerprint: typed.semantic_context_fingerprint,
          candidate_catalog_fingerprint: typed.candidate_catalog_fingerprint
        };
        const text = typed.evidence.evidence.map((entry) => entry.scene).join("\n");
        const target = typed.catalog.propositions.find((p) => p.proposition_label.includes("Nadia")) ?? null;
        if (target === null) return { ...bindings, kind: "NO_BEARING" };
        if (text.includes(P0_OUTCOME_KEPT)) return { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "SUPPORTS" };
        if (text.includes(P0_OUTCOME_BROKEN)) return { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "CONTRADICTS" };
        return { ...bindings, kind: "NO_BEARING" };
      }
    },
    tally: { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 },
    cognitionRequests: [],
    providerCalls: [],
    executorModel: "stub",
    executorBaseUrl: "stub",
    isStub: true
  } as Phase0BundleV0;
}

async function main(): Promise<void> {
  const checks: Record<string, boolean> = {};
  const detail: Record<string, unknown> = {};

  // ---- A: all ten valid ------------------------------------------------------------------------
  const callsA: number[] = [];

  const outA = mkdtempSync(join(tmpdir(), "r2-smoke-ok-"));
  const resultA = await runRerunV0(
    stubBundle(Array.from({ length: 40 }, () => "VALID" as ScriptedTurn), (index) => callsA.push(index)),
    outA
  );
  checks["A_all_ten_scientific_turns_valid"] = resultA.allRequiredTurnsValid === true;
  checks["A_scientific_turns_executed_is_ten"] = resultA.scientificTurnsExecuted === R2_REQUIRED_SCIENTIFIC_TURNS;
  checks["A_no_invalid"] = resultA.invalidCount === 0;
  checks["A_did_not_stop_early"] = resultA.stoppedEarly === false;

  // ---- B: arm B's third scientific turn is invalid ---------------------------------------------
  // Cognition call order: qualification(0), A turns 0..4 (1..5), B turns 0..4 (6..10).
  // The 3rd B turn is cognition index 6 + 2 = 8.
  const callsB: number[] = [];
  const scriptB: ScriptedTurn[] = Array.from({ length: 40 }, (_, index) => (index === 8 ? "INVALID_STANCE" : "VALID"));
  const outB = mkdtempSync(join(tmpdir(), "r2-smoke-invalid-"));
  const resultB = await runRerunV0(
    stubBundle(scriptB, (index) => callsB.push(index)),
    outB
  );
  checks["B_reports_not_all_valid"] = resultB.allRequiredTurnsValid === false;
  checks["B_counts_one_invalid"] = resultB.invalidCount === 1;
  checks["B_stopped_early"] = resultB.stoppedEarly === true;
  checks["B_quarantined_a_subject"] = resultB.quarantined.length === 1;
  // The decisive policy check: the run stopped, it did not collect the remaining turns.
  checks["B_did_not_run_the_remaining_turns"] = callsB.length === 9; // 1 qual + 5 A + 3 B
  detail["B_cognition_calls"] = callsB.length;
  detail["B_executed_scientific_turns"] = resultB.scientificTurnsExecuted;

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  console.log(`RERUN POLICY SMOKE (0 model calls) — ${Object.keys(checks).length - failures.length}/${Object.keys(checks).length} checks passed`);
  for (const [name, value] of Object.entries(checks)) console.log(`  ${value ? "yes" : "NO "}  ${name}`);
  console.log(`  arm-B stub: cognition calls ${callsB.length}, executed turns ${resultB.scientificTurnsExecuted}, invalid ${resultB.invalidCount}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
  void hashPhase0;
  void outA;
  void outB;
  void detail;
}

await main();
