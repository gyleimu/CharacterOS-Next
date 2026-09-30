/* eslint-disable no-restricted-imports -- Isolated research harness composing the frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0 EXECUTION (real production stack).
 *
 *   npx tsx phase-0/execute.ts <outdir>
 *
 * Exactly the frozen schedule, then STOP:
 *   1 qualification turn on a THIRD subject (non-target), then 5 turns for arm A,
 *   then the same 5 for arm B. Pre-state is frozen and hashed before any scientific
 *   turn; post-state is frozen with `scored: false` and hashed after the last turn.
 *   Scoring is a SEPARATE program that may only run once those freezes exist on disk.
 *
 * No transport is substituted: the belief semantic provider is the shipped production
 * OllamaBeliefSemanticProviderV0 and the transports are the shipped production
 * OllamaNativeCognitionTransportV0. `packages/` is never modified.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  OllamaBeliefSemanticProviderV0,
  OllamaNativeCognitionTransportV0,
  type ModelTransportV0
} from "../../../../packages/runtime/dist/index.js";
import { createProductAppraisalProviderV0 } from "../../../../product/sandbox/dist/product-appraisal-provider.js";

import {
  P0_APPRAISAL_CONTEXT_TOKENS,
  P0_APPRAISAL_NUM_PREDICT,
  P0_COGNITION_CONTEXT_TOKENS,
  P0_COGNITION_NUM_PREDICT,
  P0_EXECUTOR_MODEL,
  P0_OLLAMA_BASE_URL,
  P0_TURNS_PER_ARM,
  hashPhase0
} from "./contract.ts";
import { buildPhase0SourceV0 } from "./fixtures.ts";
import { P0_SUBJECT_A_ID, P0_SUBJECT_B_ID } from "./contract.ts";
import {
  instrumentPhase0BundleV0,
  runPhase0ScheduleV0,
  type Phase0BundleV0
} from "./harness.ts";

function countedTransport(
  inner: ModelTransportV0,
  family: "cognition" | "language" | "appraisal",
  tally: Phase0BundleV0["tally"],
  recorder: Phase0BundleV0["cognitionRequests"]
): ModelTransportV0 {
  return {
    complete: async (request: never) => {
      tally[family] += 1;
      if (family === "cognition") {
        const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
        recorder.push({ turn: currentTurn, messages: messages.map((m) => ({ role: m.role, content: m.content })) });
      }
      return inner.complete(request);
    }
  } as ModelTransportV0;
}

let currentTurn = "PRE";

/**
 * REAL production bundle. `countedTransport` is a counting/recording proxy only: it forwards
 * the request object untouched, so the bytes the executor sees are exactly production bytes.
 */
function realBundle(): Phase0BundleV0 {
  const tally = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];

  const cognition = new OllamaNativeCognitionTransportV0({
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL,
    timeout_ms: 120_000,
    num_predict: P0_COGNITION_NUM_PREDICT,
    context_window_tokens: P0_COGNITION_CONTEXT_TOKENS
  });
  const language = new OllamaNativeCognitionTransportV0({
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL,
    timeout_ms: 120_000,
    num_predict: P0_COGNITION_NUM_PREDICT,
    context_window_tokens: P0_COGNITION_CONTEXT_TOKENS
  });
  const appraisal = new OllamaNativeCognitionTransportV0({
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL,
    timeout_ms: 120_000,
    num_predict: P0_APPRAISAL_NUM_PREDICT,
    context_window_tokens: P0_APPRAISAL_CONTEXT_TOKENS
  });

  const innerProvider = new OllamaBeliefSemanticProviderV0({
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL
  });

  return {
    cognitionTransport: countedTransport(cognition, "cognition", tally, cognitionRequests),
    languageTransport: countedTransport(language, "language", tally, cognitionRequests),
    appraisalProvider: createProductAppraisalProviderV0({
      transport: countedTransport(appraisal, "appraisal", tally, cognitionRequests)
    }).provider,
    beliefSemanticProvider: {
      propose: async (input: never) => {
        tally.belief_semantic += 1;
        const turn = currentTurn;
        try {
          const output = await innerProvider.propose(input);
          providerCalls.push({ turn, input, output, error: null });
          return output;
        } catch (error) {
          providerCalls.push({ turn, input, output: null, error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      }
    },
    tally,
    cognitionRequests,
    providerCalls,
    executorModel: P0_EXECUTOR_MODEL,
    executorBaseUrl: P0_OLLAMA_BASE_URL,
    isStub: false,
    setTurnLabel: (label) => {
      currentTurn = label;
    }
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("P0_EXECUTE_USAGE: usage: execute.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  const bundle = instrumentPhase0BundleV0(realBundle());
  const result = await runPhase0ScheduleV0({
    bundle,
    sourceA: buildPhase0SourceV0(P0_SUBJECT_A_ID),
    sourceB: buildPhase0SourceV0(P0_SUBJECT_B_ID),
    log: (line) => console.log(line)
  });

  const hashes: Record<string, string> = {};
  hashes["qualification.json"] = await write("qualification.json", result.qualification);
  hashes["pre-state-A.json"] = await write("pre-state-A.json", {
    scored: false,
    role: "PRE_TRAJECTORY_STATE_A",
    state: result.preStateA
  });
  hashes["pre-state-B.json"] = await write("pre-state-B.json", {
    scored: false,
    role: "PRE_TRAJECTORY_STATE_B",
    state: result.preStateB
  });
  hashes["post-state-A.json"] = await write("post-state-A.json", {
    scored: false,
    role: "POST_TRAJECTORY_STATE_A",
    state: result.postStateA
  });
  hashes["post-state-B.json"] = await write("post-state-B.json", {
    scored: false,
    role: "POST_TRAJECTORY_STATE_B",
    state: result.postStateB
  });
  hashes["raw-trials.json"] = await write("raw-trials.json", {
    turns: result.turns,
    provider_calls: bundle.providerCalls,
    cognition_requests: bundle.cognitionRequests
  });
  hashes["executed-leakage-audit.json"] = await write("executed-leakage-audit.json", result.executedLeakage);

  const totalCalls = bundle.tally.cognition + bundle.tally.language + bundle.tally.appraisal + bundle.tally.belief_semantic;
  const persistence = {
    claim_tested:
      "the changed credence is a CANONICAL durable belief state, not temporary executor text, not a local prompt variable, and not an ephemeral adaptation result",
    evidence: [
      "the value is read through the runtime's read-only canonical state projection (subjectStateView), which reads the canonical SubjectState and calls no provider",
      "the same read reports state_revision and repository_revision, so the change is bound to a canonical state revision",
      "the durable capture reports subject_head commit_ref / record_checksum / state_hash_after, so the change sits behind a committed canonical bundle",
      "the durable belief workflow store image is captured alongside, so the workflow that produced the change is durable state"
    ],
    NOT_tested_here:
      "process restart and reload. That is a LATER frozen phase, and §15 of this round's brief forbids adding it here. State durability across restart is therefore NOT established by Phase 0.",
    canonical_reads_only: true,
    prompt_text_used_as_evidence: false
  };
  hashes["persistence-scope.json"] = await write("persistence-scope.json", persistence);

  const integrity = {
    turns_executed_qualification: result.turns.filter((t) => t.arm === "QUALIFICATION").length,
    turns_executed_A: result.turns.filter((t) => t.arm === "A").length,
    turns_executed_B: result.turns.filter((t) => t.arm === "B").length,
    turns_expected_per_arm: P0_TURNS_PER_ARM,
    schedule_followed:
      result.turns.filter((t) => t.arm === "A").length === P0_TURNS_PER_ARM &&
      result.turns.filter((t) => t.arm === "B").length === P0_TURNS_PER_ARM,
    qualification_passed: result.qualificationPassed,
    integrity_failures: result.integrityFailures,
    call_tally: { ...bundle.tally },
    total_model_calls: totalCalls,
    exact_belief_semantic_calls: bundle.tally.belief_semantic,
    executor_model: bundle.executorModel,
    executor_base_url: bundle.executorBaseUrl,
    transport_substituted: false,
    transport_substitution_note:
      "NONE. The belief semantic provider is the shipped production OllamaBeliefSemanticProviderV0; transports are the shipped production OllamaNativeCognitionTransportV0; the appraisal provider is the shipped product composition. packages/ is unmodified.",
    arms_share_a_byte_identical_opening_turn:
      result.turns.find((t) => t.arm === "A" && t.turn_index === 0)?.user_text ===
      result.turns.find((t) => t.arm === "B" && t.turn_index === 0)?.user_text,
    trajectory_evidence_carries_model_generated_content:
      "yes, and this is inherent to the production ordering law: from turn 1 the evidence offered to belief adaptation is the behaviour-outcome feedback of the PREVIOUS turn, which contains the subject's own delivered reply as well as the user text. Phase 0 therefore does NOT claim a single-byte intervention; it claims matched authored events whose only authored difference is the frozen valence span."
  };
  hashes["collection-integrity.json"] = await write("collection-integrity.json", { integrity, artifact_hashes: hashes });
  await write("execution-manifest.json", {
    phase: "HISTORY_INTERNALIZATION_TEST_V1_PHASE_0",
    revision: "REV2_PHASE_BOUNDARIES",
    scored: false,
    next_step: "run score.ts against the frozen post-state artifacts",
    artifact_hashes: hashes
  });

  console.log("");
  console.log(`EXECUTION COMPLETE — ${result.turns.length} turns`);
  console.log(
    `  calls: cognition=${bundle.tally.cognition} language=${bundle.tally.language} appraisal=${bundle.tally.appraisal} belief_semantic=${bundle.tally.belief_semantic} total=${totalCalls}`
  );
  console.log(`  integrity failures: ${result.integrityFailures.length}`);
  console.log("STOP — no further turns, no extension, no retry.");
}

await main();
