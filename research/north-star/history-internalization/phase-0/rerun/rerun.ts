/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * HISTORY_INTERNALIZATION_V1_PHASE0_RERUN — execution.
 *
 *   npx tsx phase-0/rerun/rerun.ts <outdir>
 *
 * NEW INDEPENDENT EXECUTION of the SAME FROZEN SCIENTIFIC DESIGN. Not a run-1 continuation.
 *
 * Policy, frozen before the first call:
 *   - 10 REQUIRED SCIENTIFIC SUBJECT TURNS (arm A 5 + arm B 5), plus 1 non-scientific
 *     qualification/bootstrap turn accounted separately;
 *   - the stop rule is expressed in TURNS, never in calls and never in observed belief movement;
 *   - the FIRST invalid required turn makes the whole run INCONCLUSIVE immediately: no restore and
 *     continue, no retry, no replacement, and the OTHER ARM IS NOT FINISHED to collect more data;
 *   - a subject that hits an invalid required turn is SCIENTIFICALLY_QUARANTINED_AFTER_INVALID_TURN
 *     and its state may never enter the endpoint.
 *
 * Provider/model unchanged from run-1; no structured-output constraint, no prompt change, nothing
 * added in response to the known executor risk.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  OllamaBeliefSemanticProviderV0,
  OllamaNativeCognitionTransportV0,
  type BeliefAdaptationTurnReportV0,
  type InteractiveTurnOutcomeV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";
import { createProductAppraisalProviderV0 } from "../../../../../product/sandbox/dist/product-appraisal-provider.js";

import {
  P0_APPRAISAL_CONTEXT_TOKENS,
  P0_APPRAISAL_NUM_PREDICT,
  P0_COGNITION_CONTEXT_TOKENS,
  P0_COGNITION_NUM_PREDICT,
  P0_EXECUTOR_MODEL,
  P0_OLLAMA_BASE_URL,
  P0_QUAL_TURN_TEXT,
  P0_SUBJECT_DISPLAY_NAME,
  P0_BELIEF_SEMANTIC_CALLS_PER_TURN,
  hashPhase0,
  renderPhase0TurnTextV0
} from "../contract.ts";
import { buildPhase0SourceForSubjectV0 } from "../fixtures.ts";
import {
  capturePhase0StateV0,
  instrumentPhase0BundleV0,
  openPhase0RuntimeV0,
  type Phase0AttemptsV0,
  type Phase0BundleV0,
  type Phase0CallAttemptV0
} from "../harness.ts";
import {
  R2_QUAL_SUBJECT_ID,
  R2_REQUIRED_SCIENTIFIC_TURNS,
  R2_SCIENTIFIC_POLICY,
  R2_SCIENTIFIC_TURNS_PER_ARM,
  R2_SUBJECT_A_ID,
  R2_SUBJECT_B_ID
} from "./contract-r2.ts";

function assert(condition: boolean, code: string, detail: string): void {
  if (!condition) throw new Error(`${code}: ${detail}`);
}

// ---------------------------------------------------------------------------------------------
// Instrumented production bundle (same provider/model/config as run-1)
// ---------------------------------------------------------------------------------------------

/** Module-level label so the belief-semantic captures carry the scientific turn identity. */
let captureLabel = "PENDING";

function realBundle(): Phase0BundleV0 {
  const tally = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];
  const build = (numPredict: number, contextTokens: number): ModelTransportV0 =>
    new OllamaNativeCognitionTransportV0({
      base_url: P0_OLLAMA_BASE_URL,
      model: P0_EXECUTOR_MODEL,
      timeout_ms: 120_000,
      num_predict: numPredict,
      context_window_tokens: contextTokens
    });
  /** Counting proxy only: forwards the request object untouched. */
  const counted = (inner: ModelTransportV0, family: "cognition" | "language" | "appraisal"): ModelTransportV0 =>
    ({
      complete: async (request: never) => {
        tally[family] += 1;
        if (family === "cognition") {
          const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
          cognitionRequests.push({ turn: captureLabel, messages: messages.map((m) => ({ role: m.role, content: m.content })) });
        }
        return inner.complete(request);
      }
    }) as ModelTransportV0;
  const innerProvider = new OllamaBeliefSemanticProviderV0({ base_url: P0_OLLAMA_BASE_URL, model: P0_EXECUTOR_MODEL });

  return {
    cognitionTransport: counted(build(P0_COGNITION_NUM_PREDICT, P0_COGNITION_CONTEXT_TOKENS), "cognition"),
    languageTransport: counted(build(P0_COGNITION_NUM_PREDICT, P0_COGNITION_CONTEXT_TOKENS), "language"),
    appraisalProvider: createProductAppraisalProviderV0({
      transport: counted(build(P0_APPRAISAL_NUM_PREDICT, P0_APPRAISAL_CONTEXT_TOKENS), "appraisal")
    }).provider,
    beliefSemanticProvider: {
      propose: async (input: never) => {
        tally.belief_semantic += 1;
        const turn = captureLabel;
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
      captureLabel = label;
    }
  } as Phase0BundleV0;
}

// ---------------------------------------------------------------------------------------------
// Attempt ledger with the §13 fields
// ---------------------------------------------------------------------------------------------

interface RerunAttemptV0 {
  readonly sequence: number;
  readonly subject_id: string;
  readonly subject_role: "ARM_A" | "ARM_B" | "QUALIFICATION";
  /** "A:turn_3" style scientific identity, or null for a non-scientific operation. */
  readonly scientific_turn_id: string | null;
  readonly scientific_turn: boolean;
  readonly runtime_turn_index: number | null;
  readonly call_family: string;
  readonly request_hash: string;
  readonly provider_status: string;
  /** Only the belief-semantic family has a frozen parser/semantic outcome; others are N/A. */
  readonly parser_status: string;
  readonly semantic_status: string;
  readonly result_hash: string | null;
}

function parseStatusFor(family: string, terminal: string | null): { parser: string; semantic: string } {
  if (family !== "belief_semantic") {
    return { parser: "NOT_APPLICABLE", semantic: "NOT_APPLICABLE" };
  }
  if (terminal === null) return { parser: "UNKNOWN", semantic: "UNKNOWN" };
  return { parser: "FROZEN_RUNNER_COMPLETED", semantic: terminal };
}

// ---------------------------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------------------------

interface ScientificTurnV0 {
  readonly subject_id: string;
  readonly role: "ARM_A" | "ARM_B";
  readonly arm_turn_index: number;
  readonly scientific_turn_id: string;
  readonly user_text: string;
  readonly status: string;
  readonly failure: string | null;
  readonly valid: boolean;
  readonly belief_adaptation: BeliefAdaptationTurnReportV0 | null;
  readonly relationship_familiarity: unknown;
  readonly runtime_turn_index_before: number;
  readonly runtime_turn_index_after: number;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
}

/**
 * The whole rerun, over an injected bundle. `rerun.ts` calls it with the real production bundle;
 * `rerun-smoke.ts` calls it with deterministic stub transports, so the stop-on-invalid policy and
 * the ledger mechanics are verified at 0 model calls before any real call is spent.
 */
export async function runRerunV0(rawBundle: Phase0BundleV0, outdir: string): Promise<{
  readonly allRequiredTurnsValid: boolean;
  readonly scientificTurnsExecuted: number;
  readonly invalidCount: number;
  readonly stoppedEarly: boolean;
  readonly quarantined: string[];
}> {
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  const bundle = instrumentPhase0BundleV0(rawBundle);
  const attempts: RerunAttemptV0[] = [];
  let sequence = 0;
  let currentScientificId: string | null = null;
  let currentSubjectId = "UNKNOWN";
  let currentRole: RerunAttemptV0["subject_role"] = "QUALIFICATION";
  let currentRuntimeTurn: number | null = null;
  let currentTerminal: string | null = null;
  void captureLabel;

  // The instrumentation records a base attempt; we enrich it with the §13 identity fields at the
  // moment the harness sets the turn label.
  const ledgerFromInstrumentation = (base: readonly Phase0CallAttemptV0[]): void => {
    while (attempts.length < base.length) {
      const next = base[attempts.length] as Phase0CallAttemptV0;
      sequence += 1;
      const status = parseStatusFor(next.family, currentTerminal);
      attempts.push({
        sequence,
        subject_id: currentSubjectId,
        subject_role: currentRole,
        scientific_turn_id: currentScientificId,
        scientific_turn: currentScientificId !== null,
        runtime_turn_index: currentRuntimeTurn,
        call_family: next.family,
        request_hash: next.request_hash,
        provider_status: next.result_status,
        parser_status: status.parser,
        semantic_status: status.semantic,
        result_hash: next.result_hash
      });
    }
  };

  const instrumentedAttempts = (bundle as Phase0BundleV0 & Phase0AttemptsV0).attempts;

  // ---- §12 STAGE 0: non-scientific qualification / bootstrap -----------------------------------
  console.log("STAGE 0 — qualification (NON-scientific bootstrap)");
  currentScientificId = null;
  currentSubjectId = R2_QUAL_SUBJECT_ID;
  currentRole = "QUALIFICATION";
  currentRuntimeTurn = null;
  const qualificationRuntime = await openPhase0RuntimeV0(
    R2_QUAL_SUBJECT_ID,
    buildPhase0SourceForSubjectV0(R2_QUAL_SUBJECT_ID, "QUALIFICATION"),
    "session-r2-qualification-0001",
    bundle
  );
  const qualificationOutcome = await qualificationRuntime.submitUserText(P0_QUAL_TURN_TEXT);
  ledgerFromInstrumentation(instrumentedAttempts);
  const qualificationPassed = qualificationOutcome.status === "COMPLETE";
  console.log(`  qualification status=${qualificationOutcome.status}`);
  await write("r2-qualification.json", {
    role: "NON_SCIENTIFIC_BOOTSTRAP",
    scientific_turn: false,
    subject_id: R2_QUAL_SUBJECT_ID,
    status: qualificationOutcome.status,
    passed: qualificationPassed,
    note: "a bootstrap operation, accounted separately from the 10 required scientific subject turns; it cannot contribute to any endpoint"
  });
  assert(qualificationPassed, "R2_QUALIFICATION_FAILED", `qualification turn did not complete: ${String(qualificationOutcome.failure)}`);

  // ---- §15 pre-state freeze --------------------------------------------------------------------
  console.log("STAGE 1 — pre-state freeze (fresh R2 subjects)");
  const runtimeA = await openPhase0RuntimeV0(R2_SUBJECT_A_ID, buildPhase0SourceForSubjectV0(R2_SUBJECT_A_ID), "session-r2-k7q2-4103-0001", bundle);
  const runtimeB = await openPhase0RuntimeV0(R2_SUBJECT_B_ID, buildPhase0SourceForSubjectV0(R2_SUBJECT_B_ID), "session-r2-k7q2-8267-0001", bundle);
  const preA = await capturePhase0StateV0(runtimeA, R2_SUBJECT_A_ID);
  const preB = await capturePhase0StateV0(runtimeB, R2_SUBJECT_B_ID);
  const preHashes = {
    "r2-pre-state-A.json": await write("r2-pre-state-A.json", { scored: false, role: "R2_PRE_TRAJECTORY_STATE_A", state: preA }),
    "r2-pre-state-B.json": await write("r2-pre-state-B.json", { scored: false, role: "R2_PRE_TRAJECTORY_STATE_B", state: preB })
  };

  // ---- §16/§17 the frozen trajectories, stopping at the FIRST invalid required turn -------------
  const scientificTurns: ScientificTurnV0[] = [];
  let invalidCount = 0;
  let stoppedEarly = false;
  let quarantined: string[] = [];

  for (const [role, subjectId, runtime] of [
    ["ARM_A", R2_SUBJECT_A_ID, runtimeA],
    ["ARM_B", R2_SUBJECT_B_ID, runtimeB]
  ] as const) {
    if (stoppedEarly) break;
    console.log(`STAGE 2 — ${role}`);
    for (let armTurn = 0; armTurn < R2_SCIENTIFIC_TURNS_PER_ARM; armTurn += 1) {
      const arm = role === "ARM_A" ? "A" : "B";
      const expected = renderPhase0TurnTextV0(arm, armTurn);
      currentScientificId = `${arm}:turn_${armTurn}`;
      currentSubjectId = subjectId;
      currentRole = role;
      const before = await runtime.status();
      currentRuntimeTurn = before.turn_index;
      currentTerminal = null;
      const outcome: InteractiveTurnOutcomeV0 = await runtime.submitUserText(expected);
      const after = await runtime.status();
      const report = (outcome.belief_adaptation ?? null) as BeliefAdaptationTurnReportV0 | null;
      currentTerminal = report?.current?.terminal_kind ?? null;
      ledgerFromInstrumentation(instrumentedAttempts);

      const valid = outcome.status === "COMPLETE";
      scientificTurns.push({
        subject_id: subjectId,
        role,
        arm_turn_index: armTurn,
        scientific_turn_id: currentScientificId,
        user_text: expected,
        status: outcome.status,
        failure: outcome.failure,
        valid,
        belief_adaptation: report,
        relationship_familiarity: outcome.relationship_familiarity ?? null,
        runtime_turn_index_before: before.turn_index,
        runtime_turn_index_after: after.turn_index,
        state_revision_before: before.state_revision,
        state_revision_after: after.state_revision,
        repository_revision_before: before.repository_revision,
        repository_revision_after: after.repository_revision
      });
      console.log(
        `  ${currentScientificId} status=${outcome.status} terminal=${report?.current?.terminal_kind ?? "none"} ` +
          `prev=${String(report?.current?.prior_credence ?? "null")} next=${String(report?.current?.next_credence ?? "null")}`
      );

      if (!valid) {
        invalidCount += 1;
        stoppedEarly = true;
        quarantined = [subjectId];
        console.log(`  INVALID required turn — ${R2_SCIENTIFIC_POLICY.on_invalid}`);
        console.log(`  ${R2_SCIENTIFIC_POLICY.do_not_finish_the_other_arm}`);
        break;
      }
    }
  }

  // ---- §18 post-state freeze (ONLY when all 10 required turns were valid) -----------------------
  const allRequiredTurnsValid = invalidCount === 0 && scientificTurns.length === R2_REQUIRED_SCIENTIFIC_TURNS;
  let postHashes: Record<string, string> = {};
  let postA: unknown = null;
  let postB: unknown = null;
  if (allRequiredTurnsValid) {
    console.log("STAGE 3 — post-state freeze");
    postA = await capturePhase0StateV0(runtimeA, R2_SUBJECT_A_ID);
    postB = await capturePhase0StateV0(runtimeB, R2_SUBJECT_B_ID);
    postHashes = {
      "r2-post-state-A.json": await write("r2-post-state-A.json", { scored: false, role: "R2_POST_TRAJECTORY_STATE_A", state: postA }),
      "r2-post-state-B.json": await write("r2-post-state-B.json", { scored: false, role: "R2_POST_TRAJECTORY_STATE_B", state: postB })
    };
  } else {
    // §4: a quarantined state may never enter the endpoint. Capture it as diagnostic evidence only.
    console.log("STAGE 3 — post-state NOT frozen as an endpoint (invalid turn occurred)");
    if (!quarantined.includes(R2_SUBJECT_A_ID)) postA = await capturePhase0StateV0(runtimeA, R2_SUBJECT_A_ID);
    if (!quarantined.includes(R2_SUBJECT_B_ID)) postB = await capturePhase0StateV0(runtimeB, R2_SUBJECT_B_ID);
    await write("r2-diagnostic-states.json", {
      role: "DIAGNOSTIC_EVIDENCE_ONLY_NOT_AN_ENDPOINT",
      quarantined_subjects: quarantined,
      state_A: postA,
      state_B: postB,
      note: "these states may not enter the post-state endpoint, the state-delta scorer, the arm-divergence scorer, restart persistence evidence, or the positive predicate"
    });
  }

  // ---- §26 exact ledger ------------------------------------------------------------------------
  ledgerFromInstrumentation(instrumentedAttempts);
  const byFamily = (family: string): number => attempts.filter((attempt) => attempt.call_family === family).length;
  const runtimeTally = bundle.tally;
  const ledger = {
    artifact: "R2_PROVIDER_ATTEMPT_LEDGER",
    fields_required_by_the_brief: [
      "subject_id",
      "scientific_turn_id",
      "runtime_turn_index",
      "call_family",
      "request_hash",
      "provider_status",
      "parser_status",
      "semantic_status"
    ],
    total_attempts: attempts.length,
    by_family: {
      cognition: byFamily("cognition"),
      language: byFamily("language"),
      appraisal: byFamily("appraisal"),
      belief_semantic: byFamily("belief_semantic")
    },
    runtime_tally: { ...runtimeTally },
    reconciles_with_runtime_tally:
      attempts.length === runtimeTally.cognition + runtimeTally.language + runtimeTally.appraisal + runtimeTally.belief_semantic,
    every_attempt_has_a_subject: attempts.every((attempt) => attempt.subject_id !== "UNKNOWN"),
    every_scientific_attempt_is_flagged: attempts.every((attempt) => typeof attempt.scientific_turn === "boolean"),
    parser_and_semantic_status_scope:
      "defined only for the belief-semantic family, whose parser and semantic validation are the frozen runner's; transport families report NOT_APPLICABLE with that reason, rather than a fabricated status",
    attempts
  };
  writeFileSync(join(outdir, "r2-provider-attempt-ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const accounting = {
    scientific_subject_turns_required: R2_REQUIRED_SCIENTIFIC_TURNS,
    scientific_subject_turns_executed: scientificTurns.filter((turn) => turn.valid).length,
    scientific_subject_turns_invalid: invalidCount,
    non_scientific_bootstrap_turns: 1,
    runtime_turns_total: 1 + scientificTurns.length,
    provider_attempts_total: attempts.length,
    cognition_attempts: byFamily("cognition"),
    language_attempts: byFamily("language"),
    appraisal_attempts: byFamily("appraisal"),
    belief_semantic_attempts: byFamily("belief_semantic"),
    belief_semantic_attempts_per_scientific_turn_expected: P0_BELIEF_SEMANTIC_CALLS_PER_TURN,
    stop_rule_expressed_in: "frozen subject turns, never in provider calls or observed belief movement",
    provider_calls_are_accounting_only: true
  };

  const manifest = {
    artifact: "R2_EXECUTION_MANIFEST",
    execution_identity: "NEW INDEPENDENT EXECUTION OF THE SAME FROZEN SCIENTIFIC DESIGN — not a run-1 continuation",
    provider: { base_url: P0_OLLAMA_BASE_URL, model: P0_EXECUTOR_MODEL, structured_output_constraint_added: false },
    subjects: {
      arm_A_subject_id: R2_SUBJECT_A_ID,
      arm_B_subject_id: R2_SUBJECT_B_ID,
      lineage_labels: ["Alice-A-R2", "Alice-B-R2"],
      display_name: P0_SUBJECT_DISPLAY_NAME,
      run1_subject_ids_reused: false
    },
    failed_turn_mutation_fact:
      "A FAILED turn CAN change canonical revision/state and is NOT rolled back. The harness must never assume FAILED == NO STATE CHANGE.",
    all_required_turns_valid: allRequiredTurnsValid,
    stopped_early_on_invalid: stoppedEarly,
    quarantined_subjects: quarantined,
    accounting,
    artifact_hashes: { ...preHashes, ...postHashes }
  };
  await write("r2-execution-manifest.json", manifest);
  await write("r2-scientific-turns.json", {
    required: R2_REQUIRED_SCIENTIFIC_TURNS,
    executed: scientificTurns.length,
    all_valid: allRequiredTurnsValid,
    turns: scientificTurns
  });

  console.log("");
  console.log(`RERUN EXECUTION COMPLETE — scientific turns ${scientificTurns.length}/${R2_REQUIRED_SCIENTIFIC_TURNS} (invalid ${invalidCount})`);
  console.log(`  provider attempts: ${attempts.length} (cognition ${byFamily("cognition")}, language ${byFamily("language")}, appraisal ${byFamily("appraisal")}, belief-semantic ${byFamily("belief_semantic")})`);
  console.log(`  endpoint frozen: ${String(allRequiredTurnsValid)}`);
  console.log("STOP — no retry, no replacement, no extension.");

  return {
    allRequiredTurnsValid,
    scientificTurnsExecuted: scientificTurns.filter((turn) => turn.valid).length,
    invalidCount,
    stoppedEarly,
    quarantined
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  assert(outdir !== undefined, "R2_USAGE", "usage: rerun.ts <outdir>");
  await runRerunV0(realBundle(), outdir);
}

// Only run the CLI when this file is the entry point, so a smoke test can import runRerunV0.
if (process.argv[1] !== undefined && process.argv[1].replaceAll("\\", "/").endsWith("/rerun.ts")) {
  await main();
}
