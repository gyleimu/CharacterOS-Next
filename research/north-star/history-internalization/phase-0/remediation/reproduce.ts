/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * §12 — DETERMINISTIC STUB REPRODUCTION of the run-1 failure chain.
 *
 *   npx tsx phase-0/remediation/reproduce.ts [outdir]
 *
 * 0 model calls. No production change. Sequence:
 *
 *   turn 0  valid response                      -> must PASS
 *   turn 1  PRIMARY_STANCE with NO subjective_selection -> must FAIL CLOSED
 *   turn 2  valid response                      -> baseline expectation: ingress CONFLICT
 *
 * This program does not guess the root cause from run-1's artifacts. It drives the SAME
 * production runtime with stub transports, observes exactly what happens, and only then reads
 * the code paths that produced it. If the chain does NOT reproduce, that is a STOP condition.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ModelTransportResponseV0,
  ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";


import { P0_SUBJECT_A_ID } from "../contract.ts";
import { buildPhase0SourceV0 } from "../fixtures.ts";
import { openPhase0RuntimeV0, capturePhase0StateV0, type Phase0AppraisalProviderV0, type Phase0BundleV0 } from "../harness.ts";

/** Which response the cognition transport returns on a given turn index. */
type ScriptedTurn = "VALID" | "PRIMARY_STANCE_WITHOUT_SUBJECTIVE_SELECTION";

const SCRIPT: readonly ScriptedTurn[] = ["VALID", "PRIMARY_STANCE_WITHOUT_SUBJECTIVE_SELECTION", "VALID"];

let stubTurnIndex = 0;

function validProposal(): Record<string, unknown> {
  return {
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
  };
}

/**
 * The exact malformed shape run-1 produced, constructed from the AUTHORITATIVE CONTRACT rather
 * than copied from the run-1 artifact.
 *
 * The production rule (`conversation-cognition-proposal.ts:1909`) is:
 *
 *     if (kind === PRIMARY_RESPONSE_KIND_STANCE_V0) {
 *       const keys = exactClosedKeys(value, STANCE_ATOM_KEYS, detail);   // structural check FIRST
 *       if (keys !== null) return { ok: false, detail: keys };
 *       if (proposal.subjective_selection.kind !== SUBJECTIVE_SELECTION_KIND_SELECTED_V1) {
 *         return { ok: false, detail: `... PRIMARY_STANCE requires an authoritative ... stance` };
 *       }
 *
 * So the minimal violating response is structurally VALID and semantically INCOMPLETE:
 * `response_semantics.kind = PRIMARY_STANCE` while `subjective_selection.kind` stays
 * `NO_SUBJECTIVE_SELECTION`. Removing the `subjective_selection` KEY instead (the first attempt
 * at this reproduction) trips the STRUCTURAL check first and is rejected on a different code
 * path — which is exactly why the first attempt did not reproduce run-1.
 */
function malformedStanceProposal(): Record<string, unknown> {
  const proposal = validProposal();
  proposal["response_semantics"] = { kind: "PRIMARY_STANCE" };
  return proposal;
}

function scriptedCognitionTransport(record: { turn: number; scripted: ScriptedTurn }[]): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      const scripted = SCRIPT[stubTurnIndex] ?? "VALID";
      record.push({ turn: stubTurnIndex, scripted });
      const body = scripted === "VALID" ? validProposal() : malformedStanceProposal();
      return { content: JSON.stringify(body), model: "stub" } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function stubLanguageTransport(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({
        content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "STUB_REPLY", evidence_refs: [] }),
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
        dimensions: { relevance: 0.6, goal_congruence: 0.5, attribution: "other", controllability: 0.5, uncertainty: 0.5, intensity: 0.4 },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as Phase0AppraisalProviderV0;
}

function stubBeliefProvider(): { propose: (input: never) => Promise<unknown> } {
  return {
    propose: async (input: never) => {
      const typed = input as { semantic_context_fingerprint: string; candidate_catalog_fingerprint: string };
      return {
        schema_version: "belief-semantic-provider-output-v0",
        kind: "NO_BEARING",
        semantic_context_fingerprint: typed.semantic_context_fingerprint,
        candidate_catalog_fingerprint: typed.candidate_catalog_fingerprint
      };
    }
  };
}

const TEXT = ["a valid opening message", "a message whose executor response will be schema-invalid", "a valid follow-up message"];

async function main(): Promise<void> {
  const outdir = process.argv[2] ?? join(import.meta.dirname ?? ".", "evidence");
  mkdirSync(outdir, { recursive: true });

  const record: { turn: number; scripted: ScriptedTurn }[] = [];
  const tally = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const bundle: Phase0BundleV0 = {
    cognitionTransport: scriptedCognitionTransport(record),
    languageTransport: stubLanguageTransport(),
    appraisalProvider: stubAppraisalProvider(),
    beliefSemanticProvider: stubBeliefProvider(),
    tally,
    cognitionRequests: [],
    providerCalls: [],
    executorModel: "stub",
    executorBaseUrl: "stub",
    isStub: true,
    setTurnLabel: () => {}
  };

  const runtime = await openPhase0RuntimeV0(P0_SUBJECT_A_ID, buildPhase0SourceV0(P0_SUBJECT_A_ID), "session-repro-0001", bundle);
  const turns: Record<string, unknown>[] = [];

  for (let index = 0; index < SCRIPT.length; index += 1) {
    stubTurnIndex = index;
    const before = await runtime.status();
    const outcome = await runtime.submitUserText(TEXT[index] as string);
    const after = await runtime.status();
    turns.push({
      turn: index,
      scripted_response: SCRIPT[index],
      status: outcome.status,
      failure: outcome.failure,
      turn_index_reported: outcome.turn_index,
      runtime_turn_index_before: before.turn_index,
      runtime_turn_index_after: after.turn_index,
      state_revision_before: before.state_revision,
      state_revision_after: after.state_revision,
      repository_revision_before: before.repository_revision,
      repository_revision_after: after.repository_revision,
      pending_lifecycle_work_before: before.pending_lifecycle_work,
      pending_lifecycle_work_after: after.pending_lifecycle_work
    });
    console.log(
      `turn ${index} scripted=${SCRIPT[index]} status=${outcome.status} ` +
        `turnIndex ${String(before.turn_index)}->${String(after.turn_index)} rev ${String(before.state_revision)}->${String(after.state_revision)}`
    );
    if (outcome.failure !== null) console.log(`    failure: ${outcome.failure.slice(0, 220)}`);
  }

  // ---- the three observations that constitute the reproduction --------------------------------
  const t0 = turns[0] as Record<string, unknown>;
  const t1 = turns[1] as Record<string, unknown>;
  const t2 = turns[2] as Record<string, unknown>;
  const observations = {
    turn0_valid_passed: t0["status"] === "COMPLETE",
    turn1_invalid_failed_closed: t1["status"] === "FAILED",
    turn1_failure_is_the_schema_rejection: String(t1["failure"] ?? "").includes("SEMANTIC_COMPLETENESS_FAILED"),
    turn1_did_not_advance_the_turn_index: t1["runtime_turn_index_before"] === t1["runtime_turn_index_after"],
    turn1_did_advance_canonical_state:
      (t1["state_revision_after"] as number) > (t1["state_revision_before"] as number),
    turn2_valid_was_rejected_at_ingress: String(t2["failure"] ?? "").includes("ingress must record (CONFLICT)"),
    turn2_reused_the_same_source_event_id:
      t2["runtime_turn_index_before"] === t1["runtime_turn_index_before"],
    poisoned_next_turn_reproduced: String(t2["failure"] ?? "").includes("CONFLICT")
  };

  const postState = await capturePhase0StateV0(runtime, P0_SUBJECT_A_ID);
  const artifact = {
    scope: "0 model calls, no production change, deterministic stub transports",
    sequence: SCRIPT,
    turns,
    observations,
    every_observation_holds: Object.values(observations).every((value) => value === true),
    post_state_after_poisoning: postState,
    call_tally: tally
  };
  writeFileSync(join(outdir, "PHASE0_RUN1_REPRODUCTION.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log("");
  console.log(`REPRODUCTION ${artifact.every_observation_holds ? "CONFIRMED" : "NOT CONFIRMED"}`);
  for (const [name, value] of Object.entries(observations)) console.log(`  ${value ? "yes" : "NO "}  ${name}`);
  if (!artifact.every_observation_holds) {
    console.log("STOP: the failure chain did not reproduce as expected; do not infer a root cause from run-1 artifacts.");
    process.exitCode = 2;
  }
}

await main();
