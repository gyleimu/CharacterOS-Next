/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE0-RUN-3 EXECUTION.
 *
 *   npx tsx phase-0/run-3/run3.ts <outdir>
 *
 * A NEW, INDEPENDENT EXECUTION of the SAME FROZEN SCIENTIFIC DESIGN, through the real production
 * runtime. No infrastructure work: gate 3 already passed.
 *
 * Order, fixed:
 *   §2 authorization audit (0 scientific turns if it drifts)
 *   → §8 pre-state freeze for both fresh subjects (scored: false, hashed)
 *   → §9 exactly 5 scientific turns for arm A, then 5 for arm B, through the real runtime
 *   → STOP AT THE FIRST INVALID REQUIRED TURN (the other arm is not finished)
 *   → §16 post-state freeze ONLY if all 10 required turns were valid
 *   → §17 dataset with scored: false + SHA256, scored by a SEPARATE program
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  P0_TARGET_PROPOSITION_ID,
  P0_TURNS_PER_ARM,
  hashPhase0,
  renderPhase0TurnTextV0,
  scorePhase0V0
} from "../contract.ts";
import { buildPhase0SourceForSubjectV0, stripIdentityV0 } from "../fixtures.ts";
import {
  capturePhase0StateV0,
  instrumentPhase0BundleV0,
  openPhase0RuntimeV0,
  type Phase0AttemptsV0,
  type Phase0BundleV0,
  type Phase0CallAttemptV0
} from "../harness.ts";
import {
  R3_ARM_MAPPING,
  R3_BOOTSTRAP_OPERATIONS,
  R3_FORBIDDEN_MODEL_VISIBLE_TOKENS,
  R3_QUAL_SUBJECT_ID,
  R3_SCIENTIFIC_TURNS_PER_ARM,
  R3_SCIENTIFIC_TURNS_PLANNED,
  R3_SUBJECT_1_ID,
  R3_SUBJECT_2_ID,
  R3_SUBJECT_DISPLAY_NAME
} from "./contract-r3.ts";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

function assert(condition: boolean, code: string, detail: string): void {
  if (!condition) throw new Error(`${code}: ${detail}`);
}

let captureLabel = "PENDING";

/** The frozen production bundle: same provider, model, transport and configuration as gates 1-3. */
function frozenBundle(): Phase0BundleV0 {
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

interface ScientificTurnRecordV0 {
  readonly subject_id: string;
  readonly role: "ARM_A" | "ARM_B";
  readonly arm_turn_index: number;
  readonly scientific_turn_id: string;
  readonly scientific_turn: true;
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

export interface Run3ResultV0 {
  readonly allRequiredTurnsValid: boolean;
  readonly scientificTurnsExecuted: number;
  readonly invalidScientificTurns: number;
  readonly stoppedEarly: boolean;
  readonly quarantined: readonly string[];
}

/** §2 — the gate-3 authorization must still hold before any scientific operation. */
export function run3AuthorizationAuditV0(): Record<string, unknown> {
  const base = "research/north-star/history-internalization/phase-0/evidence/readiness-gate-3";
  const verdict = JSON.parse(readFileSync(join(base, "PROVIDER_READINESS_VERDICT.json"), "utf8")) as {
    outcome: string;
    request_hash: string;
    identity: { model_digest_observed: string | null; identity_unchanged: boolean };
  };
  const authorization = readFileSync(join(base, "PHASE0_PROVIDER_READINESS_AUTHORIZATION.json"), "utf8");
  const run1Freeze = JSON.parse(
    readFileSync("research/north-star/history-internalization/phase-0/remediation/PHASE0_RUN1_FREEZE.json", "utf8")
  ) as { files: Record<string, { sha256: string }> };
  const run1Drift = Object.entries(run1Freeze.files).filter(([path, recorded]) => {
    try {
      return sha256(readFileSync(join("research/north-star/history-internalization/phase-0/evidence/run-1", path), "utf8")) !== recorded.sha256;
    } catch {
      return true;
    }
  });
  const run2Closure = JSON.parse(
    readFileSync("research/north-star/history-internalization/phase-0/evidence/readiness/RUN2_PROVIDER_BLOCK_CLOSURE.json", "utf8")
  ) as { closure_token: string };
  const productionDirty = execSync("git status --porcelain -- packages/").toString().trim();
  const head = execSync("git rev-parse HEAD").toString().trim();

  const audit = {
    artifact: "RUN3_PREEXECUTION_AUTHORIZATION_AUDIT",
    model_calls: 0,
    checks: {
      gate_3_verdict_is_pass: verdict.outcome === "PASS",
      gate_3_request_hash_unchanged: verdict.request_hash === "sha256:00339f4acf551b10c185c0cbbc427b511ec2f4a6c84530dd73075c001c96f338",
      gate_3_provider_identity_unchanged: verdict.identity.identity_unchanged === true,
      authorization_artifact_hash: `sha256:${sha256(authorization)}`,
      run1_frozen_artifacts_unchanged: run1Drift.length === 0,
      run2_closure_unchanged: run2Closure.closure_token === "HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_BLOCKED_BEFORE_SCIENTIFIC_START",
      production_commit: head,
      production_tree_unmodified: productionDirty === ""
    },
    drift: {
      run1_drifted_files: run1Drift.map(([path]) => path)
    },
    rule: "if the authorization identity has drifted, STOP with 0 scientific turns"
  };
  const checks = audit.checks as Record<string, unknown>;
  assert(checks["gate_3_verdict_is_pass"] === true, "RUN3_GATE3_NOT_PASS", "gate 3 is not PASS");
  assert(checks["gate_3_request_hash_unchanged"] === true, "RUN3_GATE3_HASH_DRIFT", "the gate-3 request hash drifted");
  assert(checks["gate_3_provider_identity_unchanged"] === true, "RUN3_GATE3_IDENTITY_DRIFT", "the gate-3 provider identity drifted");
  assert(checks["run1_frozen_artifacts_unchanged"] === true, "RUN3_RUN1_DRIFT", "run-1 artifacts drifted");
  assert(checks["production_tree_unmodified"] === true, "RUN3_PRODUCTION_DIRTY", productionDirty);
  return audit;
}

export async function runRun3V0(rawBundle: Phase0BundleV0, outdir: string): Promise<Run3ResultV0> {
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  // ---- §2 authorization audit ---------------------------------------------------------------
  const authorization = run3AuthorizationAuditV0();
  await write("RUN3_PREEXECUTION_AUTHORIZATION_AUDIT.json", authorization);

  // ---- §4 initial-state equivalence, mechanically, BEFORE any scientific turn -----------------
  const source1 = buildPhase0SourceForSubjectV0(R3_SUBJECT_1_ID);
  const source2 = buildPhase0SourceForSubjectV0(R3_SUBJECT_2_ID);
  const stripped1 = stripIdentityV0(source1);
  const stripped2 = stripIdentityV0(source2);
  const item1 = source1.beliefs.items[0];
  const item2 = source2.beliefs.items[0];
  const equivalence = {
    artifact: "RUN3_INITIAL_STATE_EQUIVALENCE_AUDIT",
    subjects: { subject_1: R3_SUBJECT_1_ID, subject_2: R3_SUBJECT_2_ID, bootstrap: R3_QUAL_SUBJECT_ID },
    identity_fields_stripped: ["subject_id", "display_name", "identity_anchors"],
    canonical_scientific_state_equivalent: stripped1 === stripped2,
    raw_subject_objects_unequal: JSON.stringify(source1) !== JSON.stringify(source2),
    both_directions_observed: (stripped1 === stripped2) !== (JSON.stringify(source1) !== JSON.stringify(source2)),
    target_belief_proposition_1: item1 ?? null,
    target_belief_proposition_2: item2 ?? null,
    proposition_id_equal: item1?.proposition_id === item2?.proposition_id,
    initial_credence_equal: item1?.credence === item2?.credence,
    target_proposition_id: P0_TARGET_PROPOSITION_ID,
    components_compared: [
      "target belief proposition (proposition_id and credence)",
      "affect state",
      "relationship state",
      "personality state and traits seed",
      "relevant memory state",
      "regulation and runtime metadata",
      "runtime configuration (identical frozen constants for both subjects)"
    ],
    model_visible_subject_id_policy: "OPAQUE_NON_SEMANTIC",
    model_visible_ids_share_stem_and_differ_only_in_an_opaque_suffix:
      R3_SUBJECT_1_ID.slice(0, -4) === R3_SUBJECT_2_ID.slice(0, -4),
    no_arm_letter_in_either_id: ![R3_SUBJECT_1_ID, R3_SUBJECT_2_ID].some((id) =>
      /(^|[-_])[ab]($|[-_])/i.test(id.replace("subject-r3-", "").replace(/-\d+$/, ""))
    ),
    arm_mapping_is_experiment_side_only: true
  };
  assert(equivalence.canonical_scientific_state_equivalent, "RUN3_STATE_MISMATCH", "the fresh subjects are not identically initialised");
  assert(equivalence.raw_subject_objects_unequal, "RUN3_IDENTITY_PARITY_VACUOUS", "raw objects identical, so the parity check proves nothing");
  assert(equivalence.proposition_id_equal && equivalence.initial_credence_equal, "RUN3_TARGET_MISMATCH", "target beliefs differ");
  await write("RUN3_INITIAL_STATE_EQUIVALENCE_AUDIT.json", equivalence);

  // ---- §3/§5/§6 schedule ---------------------------------------------------------------------
  const schedule = {
    artifact: "RUN3_SCIENTIFIC_SCHEDULE",
    scientific_subject_turns_planned: R3_SCIENTIFIC_TURNS_PLANNED,
    scientific_turns_per_arm: R3_SCIENTIFIC_TURNS_PER_ARM,
    bootstrap_operations: R3_BOOTSTRAP_OPERATIONS,
    bootstrap_carries_scientific_turn_false: true,
    order: ["BOOTSTRAP (scientific_turn = false)", "ARM_A turns 0..4", "ARM_B turns 0..4"],
    design_reused_verbatim: true,
    outcome_informed_redesign: false,
    note:
      "run-1's partial observations did not influence any character of this design: the trajectory texts, VALENCE_TABLE, turn count, proposition, predicted directions and scorer are the frozen ones",
    model_visible_subject_id_policy: "OPAQUE_NON_SEMANTIC",
    forbidden_model_visible_tokens: R3_FORBIDDEN_MODEL_VISIBLE_TOKENS,
    arm_mapping: R3_ARM_MAPPING
  };
  await write("RUN3_SCIENTIFIC_SCHEDULE.json", schedule);

  const identity = {
    artifact: "RUN3_PROVIDER_IDENTITY",
    provider: "Ollama",
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL,
    transport: "OllamaNativeCognitionTransportV0 (production)",
    belief_semantic_provider: "OllamaBeliefSemanticProviderV0 (production)",
    num_predict_cognition: P0_COGNITION_NUM_PREDICT,
    num_ctx_cognition: P0_COGNITION_CONTEXT_TOKENS,
    timeout_ms: 120_000,
    structured_output_constraint: null,
    fallback_configured: false,
    frozen_since: "gates 1-3 and run-1"
  };
  await write("RUN3_PROVIDER_IDENTITY.json", identity);

  const bundle = instrumentPhase0BundleV0(rawBundle);
  const attempts: Record<string, unknown>[] = [];
  let sequence = 0;
  let currentScientificId: string | null = null;
  let currentSubjectId = R3_QUAL_SUBJECT_ID;
  let currentRole: "ARM_A" | "ARM_B" | "BOOTSTRAP" = "BOOTSTRAP";
  let currentRuntimeTurn: number | null = null;
  let currentTerminal: string | null = null;
  const instrumented = (bundle as Phase0BundleV0 & Phase0AttemptsV0).attempts;

  const drainLedger = (): void => {
    while (attempts.length < instrumented.length) {
      const next = instrumented[attempts.length] as Phase0CallAttemptV0;
      sequence += 1;
      const isBeliefSemantic = next.family === "belief_semantic";
      attempts.push({
        sequence,
        subject_id: currentSubjectId,
        subject_role: currentRole,
        scientific_turn_id: currentScientificId,
        scientific_turn: currentScientificId !== null,
        runtime_turn_index: currentRuntimeTurn,
        call_family: next.family,
        request_hash: next.request_hash,
        provider_model: P0_EXECUTOR_MODEL,
        provider_status: next.result_status,
        latency_ms: null,
        parser_result: isBeliefSemantic ? "FROZEN_RUNNER_COMPLETED" : "NOT_APPLICABLE",
        semantic_result: isBeliefSemantic ? (currentTerminal ?? "UNKNOWN") : "NOT_APPLICABLE",
        result_hash: next.result_hash
      });
    }
  };

  // ---- bootstrap (NON-scientific) -------------------------------------------------------------
  console.log("BOOTSTRAP — non-scientific (scientific_turn = false)");
  const bootstrapRuntime = await openPhase0RuntimeV0(
    R3_QUAL_SUBJECT_ID,
    buildPhase0SourceForSubjectV0(R3_QUAL_SUBJECT_ID, "QUALIFICATION"),
    "session-r3-bootstrap-0001",
    bundle
  );
  captureLabel = "BOOTSTRAP";
  const bootstrapOutcome = await bootstrapRuntime.submitUserText(P0_QUAL_TURN_TEXT);
  drainLedger();
  const bootstrap = {
    artifact: "RUN3_BOOTSTRAP",
    scientific_turn: false,
    subject_id: R3_QUAL_SUBJECT_ID,
    status: bootstrapOutcome.status,
    passed: bootstrapOutcome.status === "COMPLETE",
    note: "a bootstrap/admission operation; it does NOT enter the scientific denominator"
  };
  await write("RUN3_BOOTSTRAP.json", bootstrap);
  assert(bootstrap.passed, "RUN3_BOOTSTRAP_FAILED", `bootstrap did not complete: ${String(bootstrapOutcome.failure)}`);

  // ---- §8 pre-state freeze --------------------------------------------------------------------
  console.log("PRE-STATE FREEZE");
  const runtime1 = await openPhase0RuntimeV0(R3_SUBJECT_1_ID, source1, "session-r3-7p4n-2185-0001", bundle);
  const runtime2 = await openPhase0RuntimeV0(R3_SUBJECT_2_ID, source2, "session-r3-7p4n-9047-0001", bundle);
  const preState1 = await capturePhase0StateV0(runtime1, R3_SUBJECT_1_ID);
  const preState2 = await capturePhase0StateV0(runtime2, R3_SUBJECT_2_ID);
  const preHashes = {
    "RUN3_PRE_STATE_A.json": await write("RUN3_PRE_STATE_A.json", { scored: false, role: "RUN3_PRE_TRAJECTORY_STATE_A", state: preState1 }),
    "RUN3_PRE_STATE_B.json": await write("RUN3_PRE_STATE_B.json", { scored: false, role: "RUN3_PRE_TRAJECTORY_STATE_B", state: preState2 })
  };

  // ---- §9/§12 the frozen trajectory, stopping at the first invalid required turn ---------------
  const turns: ScientificTurnRecordV0[] = [];
  let invalid = 0;
  let stoppedEarly = false;
  const quarantined: string[] = [];

  for (const [role, subjectId, runtime] of [
    ["ARM_A", R3_SUBJECT_1_ID, runtime1],
    ["ARM_B", R3_SUBJECT_2_ID, runtime2]
  ] as const) {
    if (stoppedEarly) break;
    console.log(`TRAJECTORY ${role}`);
    for (let armTurn = 0; armTurn < R3_SCIENTIFIC_TURNS_PER_ARM; armTurn += 1) {
      const arm = role === "ARM_A" ? "A" : "B";
      const expected = renderPhase0TurnTextV0(arm, armTurn);
      currentScientificId = `${arm}:turn_${armTurn}`;
      currentSubjectId = subjectId;
      currentRole = role;
      const before = await runtime.status();
      currentRuntimeTurn = before.turn_index;
      currentTerminal = null;
      captureLabel = currentScientificId;
      const outcome: InteractiveTurnOutcomeV0 = await runtime.submitUserText(expected);
      const after = await runtime.status();
      const report = (outcome.belief_adaptation ?? null) as BeliefAdaptationTurnReportV0 | null;
      currentTerminal = report?.current?.terminal_kind ?? null;
      drainLedger();

      const valid = outcome.status === "COMPLETE";
      turns.push({
        subject_id: subjectId,
        role,
        arm_turn_index: armTurn,
        scientific_turn_id: currentScientificId,
        scientific_turn: true,
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
        invalid += 1;
        stoppedEarly = true;
        quarantined.push(subjectId);
        console.log("  INVALID required scientific turn — RUN-3 SCIENTIFIC EXECUTION ENDS");
        console.log("  the other arm is NOT finished");
        break;
      }
    }
  }

  const allValid = invalid === 0 && turns.length === R3_SCIENTIFIC_TURNS_PLANNED;

  // ---- §16 post-state freeze, ONLY when all 10 were valid -------------------------------------
  let postHashes: Record<string, string> = {};
  let postState1: unknown = null;
  let postState2: unknown = null;
  if (allValid) {
    console.log("POST-STATE FREEZE");
    postState1 = await capturePhase0StateV0(runtime1, R3_SUBJECT_1_ID);
    postState2 = await capturePhase0StateV0(runtime2, R3_SUBJECT_2_ID);
    postHashes = {
      "RUN3_POST_STATE_A.json": await write("RUN3_POST_STATE_A.json", { scored: false, role: "RUN3_POST_TRAJECTORY_STATE_A", state: postState1 }),
      "RUN3_POST_STATE_B.json": await write("RUN3_POST_STATE_B.json", { scored: false, role: "RUN3_POST_TRAJECTORY_STATE_B", state: postState2 })
    };
  } else {
    console.log("POST-STATE NOT FROZEN (invalid required turn occurred)");
    await write("RUN3_DIAGNOSTIC_STATES.json", {
      role: "DIAGNOSTIC_EVIDENCE_ONLY_NOT_AN_ENDPOINT",
      quarantined_subjects: quarantined,
      note:
        "§14 — a FAILED turn may already have changed canonical revision/state, so the post-failure state may enter DIAGNOSTIC artifacts only: never the post-state endpoint, state delta, belief divergence, the scorer, or restart evidence",
      state_A: quarantined.includes(R3_SUBJECT_1_ID) ? null : await capturePhase0StateV0(runtime1, R3_SUBJECT_1_ID),
      state_B: quarantined.includes(R3_SUBJECT_2_ID) ? null : await capturePhase0StateV0(runtime2, R3_SUBJECT_2_ID)
    });
  }

  // ---- §11/§24 ledger -------------------------------------------------------------------------
  drainLedger();
  const byFamily = (family: string): number => attempts.filter((attempt) => attempt.call_family === family).length;
  const tally = bundle.tally;
  const ledger = {
    artifact: "RUN3_PROVIDER_ATTEMPT_LEDGER",
    fields: [
      "subject_id",
      "scientific_turn_id",
      "runtime_turn_index",
      "call_family",
      "request_hash",
      "provider_model",
      "provider_status",
      "parser_result",
      "semantic_result"
    ],
    total_provider_attempts: attempts.length,
    cognition_attempts: byFamily("cognition"),
    language_attempts: byFamily("language"),
    appraisal_attempts: byFamily("appraisal"),
    belief_semantic_attempts: byFamily("belief_semantic"),
    families_sum_to_total:
      byFamily("cognition") + byFamily("language") + byFamily("appraisal") + byFamily("belief_semantic") === attempts.length,
    reconciles_with_runtime_tally:
      attempts.length === tally.cognition + tally.language + tally.appraisal + tally.belief_semantic,
    invalid_provider_attempts: attempts.filter((attempt) => String(attempt["provider_status"]).startsWith("THREW")).length,
    every_scientific_attempt_carries_a_turn_id: attempts
      .filter((attempt) => attempt["scientific_turn"] === true)
      .every((attempt) => typeof attempt["scientific_turn_id"] === "string"),
    bootstrap_attempts_are_flagged_non_scientific: attempts
      .filter((attempt) => attempt["subject_role"] === "BOOTSTRAP")
      .every((attempt) => attempt["scientific_turn"] === false),
    attempts
  };
  await write("RUN3_PROVIDER_ATTEMPT_LEDGER.json", ledger);

  const accounting = {
    scientific_subject_turns_planned: R3_SCIENTIFIC_TURNS_PLANNED,
    scientific_subject_turns_executed: turns.length,
    scientific_subject_turns_valid: turns.filter((turn) => turn.valid).length,
    invalid_scientific_turns: invalid,
    non_scientific_runtime_operations: R3_BOOTSTRAP_OPERATIONS,
    provider_attempts_total: attempts.length,
    cognition_attempts: byFamily("cognition"),
    language_attempts: byFamily("language"),
    appraisal_attempts: byFamily("appraisal"),
    belief_semantic_attempts: byFamily("belief_semantic"),
    invalid_provider_attempts: ledger.invalid_provider_attempts,
    units_are_never_merged: true
  };

  const integrity = {
    artifact: "RUN3_COLLECTION_INTEGRITY",
    accounting,
    all_required_turns_valid: allValid,
    stopped_early_on_invalid: stoppedEarly,
    quarantined_subjects: quarantined,
    integrity_failures: turns.filter((turn) => !turn.valid).map((turn) => `${turn.scientific_turn_id}: ${String(turn.failure).slice(0, 160)}`),
    artifact_hashes: { ...preHashes, ...postHashes },
    run1_run2_gate_evidence_excluded:
      "no run-1 call, run-1 state, run-1 partial observation, run-2 bootstrap failure or readiness probe is admitted to this dataset; they are provenance evidence only"
  };
  await write("RUN3_COLLECTION_INTEGRITY.json", integrity);
  await write("RUN3_SCIENTIFIC_TURNS.json", { planned: R3_SCIENTIFIC_TURNS_PLANNED, executed: turns.length, all_valid: allValid, turns });

  // ---- §17 dataset, frozen with scored:false BEFORE any scoring --------------------------------
  const dataset = {
    scored: false,
    dataset_identity: "PHASE0_RUN3",
    scientific_turn_identities: turns.map((turn) => ({
      scientific_turn_id: turn.scientific_turn_id,
      subject_id: turn.subject_id,
      arm_turn_index: turn.arm_turn_index,
      status: turn.status,
      valid: turn.valid
    })),
    adaptation_resolutions: turns.map((turn) => ({
      scientific_turn_id: turn.scientific_turn_id,
      terminal_kind: turn.belief_adaptation?.current?.terminal_kind ?? null,
      prior_credence: turn.belief_adaptation?.current?.prior_credence ?? null,
      next_credence: turn.belief_adaptation?.current?.next_credence ?? null,
      provider_calls: turn.belief_adaptation?.current?.provider_calls ?? null,
      workflow_id: turn.belief_adaptation?.current?.workflow_id ?? null
    })),
    canonical_pre_states: allValid ? { A: preState1, B: preState2 } : null,
    canonical_post_states: allValid ? { A: postState1, B: postState2 } : null,
    per_turn_canonical_transitions: turns.map((turn) => ({
      scientific_turn_id: turn.scientific_turn_id,
      state_revision_before: turn.state_revision_before,
      state_revision_after: turn.state_revision_after,
      repository_revision_before: turn.repository_revision_before,
      repository_revision_after: turn.repository_revision_after
    })),
    provider_ledger_reference: "RUN3_PROVIDER_ATTEMPT_LEDGER.json",
    collection_integrity_reference: "RUN3_COLLECTION_INTEGRITY.json",
    accounting
  };
  const datasetHash = await hashPhase0(`${JSON.stringify(dataset, null, 2)}\n`, "PHASE0_RUN3_DATASET.json");
  await write("PHASE0_RUN3_DATASET.json", dataset);
  const datasetSha = sha256(`${JSON.stringify(dataset, null, 2)}\n`);
  await write("PHASE0_RUN3_DATASET_SHA256.json", {
    artifact: "PHASE0_RUN3_DATASET_SHA256",
    dataset_sha256: `sha256:${datasetSha}`,
    hash_function: "sha256 over the exact serialized PHASE0_RUN3_DATASET.json bytes",
    advanced_hash_envelope: datasetHash,
    frozen_before_scoring: true,
    scored_flag: false
  });

  // ---- §20/§21/§22 scoring is done by the SEPARATE program -------------------------------------
  if (!allValid) {
    await write("PHASE0_RUN3_VERDICT.json", {
      run: "PHASE0_RUN3",
      outcome: "INCONCLUSIVE",
      tokens: ["HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE", "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"],
      evidence_level: "L1",
      reason: "a required scientific turn was invalid",
      accounting,
      integrity_failures: integrity.integrity_failures,
      quarantined_subjects: quarantined,
      no_retry_no_run4: "STOP — no retry, no restore-and-continue, no run-4 this round"
    });
  }
  void scorePhase0V0;
  void P0_TURNS_PER_ARM;
  void R3_SUBJECT_DISPLAY_NAME;
  void R3_SCIENTIFIC_TURNS_PLANNED;

  console.log("");
  console.log(`RUN-3 EXECUTION ${allValid ? "COMPLETE" : "ENDED EARLY"}`);
  console.log(`  scientific turns: ${turns.length}/${R3_SCIENTIFIC_TURNS_PLANNED} executed, invalid ${invalid}`);
  console.log(`  provider attempts: ${attempts.length}`);
  console.log("STOP — scoring is a separate program.");

  return {
    allRequiredTurnsValid: allValid,
    scientificTurnsExecuted: turns.length,
    invalidScientificTurns: invalid,
    stoppedEarly,
    quarantined
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  assert(outdir !== undefined, "RUN3_USAGE", "usage: run3.ts <outdir>");
  await runRun3V0(frozenBundle(), outdir);
}

if (process.argv[1] !== undefined && process.argv[1].replaceAll("\\", "/").endsWith("/run3.ts")) {
  await main();
}
