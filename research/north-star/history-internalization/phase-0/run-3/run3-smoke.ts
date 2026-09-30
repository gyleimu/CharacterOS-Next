/* eslint-disable no-restricted-imports -- isolated harness (repo convention) */
/** RUN-3 POLICY SMOKE — 0 model calls. Verifies the run-3 program's stop-on-invalid behaviour. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelTransportResponseV0, ModelTransportV0 } from "../../../../../packages/runtime/dist/index.js";
import { P0_OUTCOME_BROKEN, P0_OUTCOME_KEPT } from "../contract.ts";
import type { Phase0AppraisalProviderV0, Phase0BundleV0 } from "../harness.ts";
import { runRun3V0 } from "./run3.ts";

type Scripted = "VALID" | "INVALID_STANCE";

function stub(script: readonly Scripted[], onCall: (i: number) => void): Phase0BundleV0 {
  let cursor = 0;
  const valid = (): Record<string, unknown> => ({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: { schema_version: "cognition-proposal-v0", reasoning_summary: "stub", relevant_memory_handles: [], considered_handles: [], current_intent: "respond", confidence: 0.7, uncertainty: 0.3, action_intent: null, evidence_handles: [] },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  });
  return {
    cognitionTransport: { complete: async (): Promise<ModelTransportResponseV0> => {
      const i = cursor; cursor += 1; onCall(i);
      const body = valid();
      if ((script[i] ?? "VALID") === "INVALID_STANCE") body["response_semantics"] = { kind: "PRIMARY_STANCE" };
      return { content: JSON.stringify(body), model: "stub" } as ModelTransportResponseV0;
    } } as ModelTransportV0,
    languageTransport: { complete: async (): Promise<ModelTransportResponseV0> =>
      ({ content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "STUB", evidence_refs: [] }), model: "stub" }) as ModelTransportResponseV0 } as ModelTransportV0,
    appraisalProvider: { proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return { schema_version: "factual-event-appraisal-proposal-v0", status: "APPRAISED", subject_id: ctx.subject_id, factual_event_ref: ctx.factual_event_ref, context_projection_hash: ctx.context_projection_hash,
        dimensions: { relevance: 0.6, goal_congruence: 0.5, attribution: "other", controllability: 0.5, uncertainty: 0.5, intensity: 0.4 }, assessment_confidence: 0.6, evidence_refs: [ctx.factual_event_ref].sort() };
    } } as unknown as Phase0AppraisalProviderV0,
    beliefSemanticProvider: { propose: async (input: never) => {
      const t = input as { semantic_context_fingerprint: string; candidate_catalog_fingerprint: string; catalog: { propositions: readonly { proposition_id: string; proposition_label: string }[] }; evidence: { evidence: readonly { scene: string }[] } };
      const b = { schema_version: "belief-semantic-provider-output-v0", semantic_context_fingerprint: t.semantic_context_fingerprint, candidate_catalog_fingerprint: t.candidate_catalog_fingerprint };
      const text = t.evidence.evidence.map((e) => e.scene).join("\n");
      const target = t.catalog.propositions.find((p) => p.proposition_label.includes("Nadia")) ?? null;
      if (target === null) return { ...b, kind: "NO_BEARING" };
      if (text.includes(P0_OUTCOME_KEPT)) return { ...b, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "SUPPORTS" };
      if (text.includes(P0_OUTCOME_BROKEN)) return { ...b, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "CONTRADICTS" };
      return { ...b, kind: "NO_BEARING" };
    } },
    tally: { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 },
    cognitionRequests: [], providerCalls: [], executorModel: "stub", executorBaseUrl: "stub", isStub: true
  } as Phase0BundleV0;
}

const A: Scripted[] = Array.from({ length: 40 }, () => "VALID");
const B: Scripted[] = Array.from({ length: 40 }, (_, i) => (i === 8 ? "INVALID_STANCE" : "VALID"));
const checks: Record<string, boolean> = {};

const okCalls: number[] = [];
const okResult = await runRun3V0(stub(A, (i) => okCalls.push(i)), mkdtempSync(join(tmpdir(), "r3-ok-")));
checks["all_valid_runs_ten_scientific_turns"] = okResult.allRequiredTurnsValid === true && okResult.scientificTurnsExecuted === 10;
checks["all_valid_has_no_invalid"] = okResult.invalidScientificTurns === 0;

const badCalls: number[] = [];
const badResult = await runRun3V0(stub(B, (i) => badCalls.push(i)), mkdtempSync(join(tmpdir(), "r3-bad-")));
checks["invalid_stops_the_run"] = badResult.stoppedEarly === true && badResult.allRequiredTurnsValid === false;
checks["invalid_is_counted"] = badResult.invalidScientificTurns === 1;
checks["invalid_quarantines_a_subject"] = badResult.quarantined.length === 1;
checks["other_arm_is_not_finished"] = badCalls.length === 9; // 1 bootstrap + 5 A + 3 B

const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
console.log(`RUN-3 POLICY SMOKE (0 model calls) — ${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} passed`);
for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "yes" : "NO "}  ${k}`);
console.log(`  invalid-case stub calls: ${badCalls.length}, executed ${badResult.scientificTurnsExecuted}, invalid ${badResult.invalidScientificTurns}`);
if (failed.length > 0) { console.log(`FAILED: ${failed.join(", ")}`); process.exitCode = 1; }
