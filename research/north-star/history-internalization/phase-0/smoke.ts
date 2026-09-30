/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE 0 SMOKE TEST — 0 model calls.
 *
 * Exercises the EXACT SAME schedule mechanics as `execute.ts` against deterministic stub
 * transports, so a wiring error is found here instead of after real calls have been spent.
 * This is the repository's live-adjudication law: probe the live wiring with stub transports
 * before spending real calls.
 *
 * The stub belief provider is NOT a scientific instrument and its outputs are meaningless:
 * it exists only to make the chain commit so the harness mechanics (freeze ordering, state
 * capture, leakage scan, scoring handoff) can be verified end to end.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../../../../packages/runtime/dist/index.js";

import { BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION } from "../../../../packages/runtime/dist/index.js";

import {
  P0_OUTCOME_BROKEN,
  P0_OUTCOME_KEPT,
  P0_SUBJECT_A_ID,
  P0_SUBJECT_B_ID,
  hashPhase0,
  scorePhase0V0
} from "./contract.ts";
import { buildPhase0SourceV0 } from "./fixtures.ts";
import { instrumentPhase0BundleV0, runPhase0ScheduleV0, type Phase0AppraisalProviderV0, type Phase0BundleV0 } from "./harness.ts";

function stubCognitionTransport(recorder: Phase0BundleV0["cognitionRequests"]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
      recorder.push({ turn: smokeTurn, messages });
      return {
        content: JSON.stringify({
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
        }),
        model: "stub"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function stubLanguageTransport(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({
        content: JSON.stringify({
          schema_version: "language-realization-semantic-draft-v1",
          text: "STUB_REPLY",
          evidence_refs: []
        }),
        model: "stub"
      }) as ModelTransportResponseV0
  } as ModelTransportV0;
}

function stubAppraisalProvider(): Phase0AppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4
        },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as Phase0AppraisalProviderV0;
}

/** Deterministic stub classifier: reads the SAME evidence text the production provider reads. */
function stubBeliefSemanticProvider(calls: Phase0BundleV0["providerCalls"], tally: Phase0BundleV0["tally"]): { propose: (input: never) => Promise<unknown> } {
  return {
    propose: async (input: never) => {
      tally.belief_semantic += 1;
      const typed = input as {
        semantic_context_fingerprint: string;
        candidate_catalog_fingerprint: string;
        catalog: { propositions: readonly { proposition_id: string; proposition_label: string }[] };
        evidence: { evidence: readonly { scene: string }[] };
      };
      const bindings = {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        semantic_context_fingerprint: typed.semantic_context_fingerprint,
        candidate_catalog_fingerprint: typed.candidate_catalog_fingerprint
      };
      const text = typed.evidence.evidence.map((entry) => entry.scene).join("\n");
      const target = typed.catalog.propositions.find((p) => p.proposition_label.includes("Nadia")) ?? null;
      let output: unknown;
      if (target === null) output = { ...bindings, kind: "NO_BEARING" };
      else if (text.includes(P0_OUTCOME_KEPT)) output = { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "SUPPORTS" };
      else if (text.includes(P0_OUTCOME_BROKEN)) output = { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "CONTRADICTS" };
      else output = { ...bindings, kind: "NO_BEARING" };
      calls.push({ turn: "STUB", input, output, error: null });
      return output;
    }
  };
}

let smokeTurn = "PRE";

async function main(): Promise<void> {
  const tally = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];
  const bundle: Phase0BundleV0 = {
    cognitionTransport: stubCognitionTransport(cognitionRequests),
    languageTransport: stubLanguageTransport(),
    appraisalProvider: stubAppraisalProvider(),
    beliefSemanticProvider: stubBeliefSemanticProvider(providerCalls, tally),
    tally,
    cognitionRequests,
    providerCalls,
    executorModel: "stub",
    executorBaseUrl: "stub",
    isStub: true,
    setTurnLabel: (label) => {
      smokeTurn = label;
    }
  };

  const instrumented = instrumentPhase0BundleV0(bundle);
  const result = await runPhase0ScheduleV0({
    bundle: instrumented,
    sourceA: buildPhase0SourceV0(P0_SUBJECT_A_ID),
    sourceB: buildPhase0SourceV0(P0_SUBJECT_B_ID),
    log: () => {}
  });

  const checks: Record<string, boolean> = {
    qualification_passed: result.qualificationPassed,
    eleven_turns_executed: result.turns.length === 11,
    five_turns_arm_A: result.turns.filter((t) => t.arm === "A").length === 5,
    five_turns_arm_B: result.turns.filter((t) => t.arm === "B").length === 5,
    pre_state_A_target_found: result.itemPreA !== null,
    pre_state_B_target_found: result.itemPreB !== null,
    post_state_A_target_found: result.itemPostA !== null,
    post_state_B_target_found: result.itemPostB !== null,
    pre_states_share_the_same_baseline:
      result.itemPreA?.credence === 0.55 && result.itemPreB?.credence === 0.55,
    arm_A_moved_up: (result.itemPostA?.credence ?? 0) > (result.itemPreA?.credence ?? 0),
    arm_B_moved_down: (result.itemPostB?.credence ?? 1) < (result.itemPreB?.credence ?? 1),
    executed_leakage_clean: result.executedLeakage["clean"] === true,
    executed_leakage_can_fire: result.executedLeakage["check_can_fire"] === true,
    no_integrity_failures: result.integrityFailures.length === 0
  };

  const score = scorePhase0V0({
    credence_pre_A: result.itemPreA?.credence ?? 0,
    credence_post_A: result.itemPostA?.credence ?? 0,
    credence_pre_B: result.itemPreB?.credence ?? 0,
    credence_post_B: result.itemPostB?.credence ?? 0,
    turns_executed_A: 5,
    turns_executed_B: 5,
    integrity_failures: result.integrityFailures
  });
  checks["scorer_reaches_POSITIVE_on_the_stub_chain"] = score.verdict.outcome === "POSITIVE";
  checks["scorer_would_report_the_observed_deltas"] = score.delta_A > 0 && score.delta_B < 0;

  // ---- §3 instrumentation: every attempt of every family, attributed to a turn ----------------
  const families = new Set(instrumented.attempts.map((attempt) => attempt.family));
  const attemptsByFamily = Object.fromEntries(
    ["cognition", "language", "appraisal", "belief_semantic"].map((family) => [
      family,
      instrumented.attempts.filter((attempt) => attempt.family === family).length
    ])
  );
  checks["instrumentation_records_all_four_families"] = families.size === 4;
  checks["every_attempt_carries_a_turn_label"] = instrumented.attempts.every(
    (attempt) => attempt.turn !== "PRE" && attempt.turn.includes(":turn_")
  );
  checks["every_attempt_carries_a_request_hash"] = instrumented.attempts.every((attempt) =>
    attempt.request_hash.startsWith("sha256:")
  );
  checks["every_attempt_carries_a_result_status"] = instrumented.attempts.every((attempt) => attempt.result_status.length > 0);

  const outdir = mkdtempSync(join(tmpdir(), "p0-smoke-"));
  const content = `${JSON.stringify({ smoke: true, checks, score, tally, attempts_by_family: attemptsByFamily, attempt_count: instrumented.attempts.length, turns: result.turns.map((t) => ({ arm: t.arm, turn: t.turn_index, status: t.status, failure: t.failure, terminal: t.belief_adaptation?.current?.terminal_kind ?? null })) }, null, 2)}\n`;
  writeFileSync(join(outdir, "smoke-result.json"), content, "utf8");
  const smokeHash = await hashPhase0(content, "smoke-result.json");

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  console.log(`SMOKE (0 model calls) — ${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks passed`);
  console.log(`  turns: ${result.turns.map((t) => `${t.arm}:${t.turn_index}=${t.belief_adaptation?.current?.terminal_kind ?? "none"}`).join(" ")}`);
  console.log(`  pre A/B=${String(result.itemPreA?.credence)}/${String(result.itemPreB?.credence)}  post A/B=${String(result.itemPostA?.credence)}/${String(result.itemPostB?.credence)}`);
  console.log(`  scorer: ${score.verdict.outcome} delta_A=${score.delta_A} delta_B=${score.delta_B}`);
  console.log(`  stub calls: cognition=${tally.cognition} language=${tally.language} appraisal=${tally.appraisal} belief_semantic=${tally.belief_semantic}`);
  console.log(`  smoke hash: ${smokeHash}`);
  if (failed.length > 0) {
    console.log(`FAILED CHECKS: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

await main();
