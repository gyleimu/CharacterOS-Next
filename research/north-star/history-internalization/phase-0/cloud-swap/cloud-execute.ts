/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0, RUN-4 EXECUTION (the swapped executor condition).
 *
 *   MODEL_API_KEY=... npx tsx phase-0/cloud-swap/cloud-execute.ts <outdir>
 *
 * Exactly the frozen schedule, then STOP:
 *   one non-target qualification turn on a fresh subject, then 5 turns for arm A, then the same 5 for
 *   arm B. Pre-state is frozen and hashed before any scientific turn; post-state is frozen with
 *   `scored: false` and hashed after the last turn. Scoring is a SEPARATE program that may only run
 *   once those freezes exist on disk.
 *
 * Two conditions: `run4` (the frozen default, RUN4_PREREGISTRATION.md + contract-run4.ts) and `run5`
 * (RUN5_PREREGISTRATION.md + contract-run5.ts, which adds ONLY the SOURCE_QUOTE citation-discipline
 * augmentation and fresh identities; the invalid policy is unchanged). The trajectories,
 * valence table, target proposition, baseline credence, predicted directions, scorer, predicate,
 * invalid policy and hierarchy ceiling are all imported by reference from `../contract.ts` — none is
 * restated here.
 *
 * The credential is read from the environment ONLY and never reaches an artifact: every string that can
 * be written passes through `redactCsV0`, and the artifacts record presence plus a fingerprint.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  P0_BASELINE_CREDENCE,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_TARGET_PROPOSITION_ID,
  P0_TARGET_PROPOSITION_LABEL,
  P0_TURNS_PER_ARM,
  hashPhase0
} from "../contract.ts";
import { buildPhase0SourceV0 } from "../fixtures.ts";
import { instrumentPhase0BundleV0, runPhase0ScheduleV0 } from "../harness.ts";
import { buildCloudPhase0BundleV0, declareCloudExecutorV0 } from "./cloud-bundle.ts";
import {
  CS_BASE_URL_DEFAULT,
  CS_CREDENTIAL_ENV,
  CS_MODEL_DEFAULT,
  credentialFingerprintV0,
  redactCsV0,
  resolveCloudExecutorConfigV0,
  type CsExecutorConfigV0
} from "./contract-cloud-v0.ts";
import {
  P0_RUN4_FORBIDDEN_INHERITED_IDS,
  P0_RUN4_MAX_TOTAL_MODEL_CALLS,
  P0_RUN4_STOP_RULES,
  P0_RUN4_SUBJECT_IDS
} from "./contract-run4.ts";
import {
  P0_RUN5_AUGMENTATION,
  P0_RUN5_CHANGED_CONDITIONS,
  P0_RUN5_CONDITION,
  P0_RUN5_FORBIDDEN_INHERITED_IDS,
  P0_RUN5_STOP_RULES,
  P0_RUN5_SUBJECT_IDS
} from "./contract-run5.ts";

/**
 * The two conditions this program can run. `run4` is the FROZEN default so the run-4 path stays exactly
 * what the run-4 preregistration froze; an unrecognised condition FAILS CLOSED rather than silently
 * running the wrong one.
 */
type CloudConditionV0 = "run4" | "run5";

function resolveConditionV0(raw: string | undefined): CloudConditionV0 {
  if (raw === undefined || raw === "run4") return "run4";
  if (raw === "run5") return "run5";
  throw new Error(`P0_CONDITION_UNKNOWN: ${raw} — allowed: run4 (default), run5`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  const condition = resolveConditionV0(process.argv[3]);
  if (outdir === undefined) {
    throw new Error("P0_USAGE: usage: cloud-execute.ts <outdir> [run4|run5]");
  }
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  const subjectIds = condition === "run5" ? P0_RUN5_SUBJECT_IDS : P0_RUN4_SUBJECT_IDS;
  const forbiddenIds = condition === "run5" ? P0_RUN5_FORBIDDEN_INHERITED_IDS : P0_RUN4_FORBIDDEN_INHERITED_IDS;
  const stopRules = condition === "run5" ? P0_RUN5_STOP_RULES : P0_RUN4_STOP_RULES;
  const conditionName = condition === "run5" ? P0_RUN5_CONDITION : "SWAPPED_EXECUTOR_CLOUD";
  const bootstrapName = condition === "run5" ? "RUN5_BOOTSTRAP.json" : "RUN4_BOOTSTRAP.json";
  const abortName = condition === "run5" ? "RUN5_ABORT.json" : "RUN4_ABORT.json";

  const apiKey = process.env[CS_CREDENTIAL_ENV] ?? null;
  let config: CsExecutorConfigV0;
  try {
    config = resolveCloudExecutorConfigV0({
      base_url: process.env["CS_BASE_URL"] ?? CS_BASE_URL_DEFAULT,
      model: process.env["CS_MODEL"] ?? CS_MODEL_DEFAULT,
      api_key: apiKey
    });
  } catch (thrown) {
    // Fail closed: an absent credential is a STOP, never a downgrade to the local executor, and never a
    // half-run condition.
    await write(abortName, {
      artifact: abortName.replace(".json", ""),
      reason: redactCsV0(thrown instanceof Error ? thrown.message : String(thrown)),
      provider_attempts: 0,
      credential_present: apiKey !== null,
      credential_value_recorded: false
    });
    console.log("STOP — the swapped executor configuration could not be resolved; no provider call was made.");
    process.exitCode = 1;
    return;
  }

  const declaration = declareCloudExecutorV0(config);
  const credentialFingerprint = await credentialFingerprintV0(config.api_key as string);
  await write(bootstrapName, {
    artifact: bootstrapName.replace(".json", ""),
    phase: `HISTORY_INTERNALIZATION_TEST_V1_PHASE_0_${condition.toUpperCase()}`,
    condition: conditionName,
    preregistration: condition === "run5" ? "RUN5_PREREGISTRATION.md" : "RUN4_PREREGISTRATION.md",
    executor: declaration,
    credential_fingerprint: credentialFingerprint,
    credential_value_recorded: false,
    subject_ids: subjectIds,
    forbidden_inherited_ids: forbiddenIds,
    ...(condition === "run5" ? { changed_conditions: P0_RUN5_CHANGED_CONDITIONS, cognition_augmentation_applied: true, augmentation_text: P0_RUN5_AUGMENTATION, invalid_policy_unchanged: true } : {}),
    baseline_credence: P0_BASELINE_CREDENCE,
    turns_per_arm: P0_TURNS_PER_ARM,
    max_total_model_calls: P0_RUN4_MAX_TOTAL_MODEL_CALLS,
    stop_rules: stopRules,
    packages_modified: false,
    scored: false
  });

  console.log(`${condition} executor: ${declaration.provider} / ${declaration.model} @ ${declaration.base_url}`);
  console.log(`  condition: ${conditionName}`);
  console.log(`  subject A=${subjectIds.armA}  B=${subjectIds.armB}`);
  if (condition === "run5") console.log("  cognition augmentation: APPLIED (system message, cognition family only)");

  const bundle = instrumentPhase0BundleV0(
    buildCloudPhase0BundleV0(config, condition === "run5" ? { cognition_augmentation: P0_RUN5_AUGMENTATION } : {})
  );
  const result = await runPhase0ScheduleV0({
    bundle,
    sourceA: buildPhase0SourceV0(subjectIds.armA),
    sourceB: buildPhase0SourceV0(subjectIds.armB),
    subjectIds,
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
  hashes["target-belief-identity.json"] = await write("target-belief-identity.json", {
    proposition_id: P0_TARGET_PROPOSITION_ID,
    proposition_label: P0_TARGET_PROPOSITION_LABEL,
    baseline_credence: P0_BASELINE_CREDENCE,
    baseline_credence_origin: "frozen production BELIEF_PROPOSITION_FIRST_CREDENCE (stance-zero 0.5 + one plasticity step)",
    predicted_direction_A: P0_PREDICTED_A_DIRECTION,
    predicted_direction_B: P0_PREDICTED_B_DIRECTION,
    identical_for_both_subjects: true,
    subject_never_told_the_conclusion: true,
    proposition_count:
      (result.preStateA as { canonical_state_view?: { beliefs?: readonly unknown[] } }).canonical_state_view?.beliefs
        ?.length ?? null,
    authored_final_credence_nowhere: true
  });
  hashes["raw-trials.json"] = await write("raw-trials.json", {
    turns: result.turns,
    provider_calls: bundle.providerCalls,
    cognition_requests: bundle.cognitionRequests
  });
  hashes["executed-leakage-audit.json"] = await write("executed-leakage-audit.json", {
    ...result.executedLeakage,
    // Recorded, NOT a scoring input: `P0_INCONCLUSIVE_CONDITIONS` is frozen and does not include a
    // leakage finding. A hit would be a serious finding requiring its own handling, and it is declared
    // that way rather than silently folded into the scientific invalid policy.
    is_a_scoring_input: false,
    if_a_hit_were_found: "the run's scientific readout would have to be adjudicated separately; the frozen invalid policy is unchanged"
  });
  hashes["persistence-scope.json"] = await write("persistence-scope.json", {
    claim_tested:
      "the changed credence is a CANONICAL durable belief state, not temporary executor text, not a local prompt variable, and not an ephemeral adaptation result",
    evidence: [
      "the value is read through the runtime's read-only canonical state projection (subjectStateView), which reads the canonical SubjectState and calls no provider",
      "the same read reports state_revision and repository_revision, so the change is bound to a canonical state revision",
      "the durable capture reports subject_head commit_ref / record_checksum / state_hash_after, so the change sits behind a committed canonical bundle",
      "the durable belief workflow store image is captured alongside, so the workflow that produced the change is durable state"
    ],
    NOT_tested_here:
      "process restart and reload. That is a LATER frozen phase; state durability across restart is NOT established by Phase 0.",
    canonical_reads_only: true,
    prompt_text_used_as_evidence: false
  });

  // RUN-5 self-verification: the declared intervention must actually be present in EVERY recorded
  // cognition request. Without this, "the augmentation was applied" would be an unchecked claim, and a
  // silently unaugmented run could be scored as if it were the declared condition.
  if (condition === "run5") {
    const offenders = bundle.cognitionRequests
      .filter((request) => {
        const system = request.messages.find((message) => message.role === "system");
        return system === undefined || !system.content.endsWith(P0_RUN5_AUGMENTATION);
      })
      .map((request) => request.turn);
    await write("RUN5_PROCESS_STOP.json", {
      artifact: "RUN5_PROCESS_STOP",
      classification: "PROCESS_STOP_CONDITION_NOT_ESTABLISHED",
      is_a_scientific_verdict: false,
      borrowed_verdict_forbidden:
        "this is neither INCONCLUSIVE nor FAILURE_A: a condition that could not be established is a process record, never a scientific one",
      raw_material_persisted_before_this_stop: true
    });
    await write("RUN5_AUGMENTATION_SELFCHECK.json", {
      artifact: "RUN5_AUGMENTATION_SELFCHECK",
      cognition_requests: bundle.cognitionRequests.length,
      every_request_carries_the_augmentation: offenders.length === 0,
      offenders,
      augmentation_is_appended_to_the_system_message: true,
      fails_closed_on_absence: true
    });
    if (bundle.cognitionRequests.length === 0 || offenders.length > 0) {
      console.log("");
      console.log("STOP — the declared cognition augmentation is NOT present in every cognition request.");
      console.log(`  offenders: ${offenders.join(", ") || "(no cognition request recorded at all)"}`);
      console.log("  an unaugmented run must never be scored as the declared condition.");
      console.log("  the RAW material is already on disk, so this stop is DIAGNOSABLE.");
      process.exitCode = 1;
      return;
    }
  }
  const totalCalls =
    bundle.tally.cognition + bundle.tally.language + bundle.tally.appraisal + bundle.tally.belief_semantic;
  const integrity = {
    condition: "SWAPPED_EXECUTOR_CLOUD",
    turns_executed_qualification: result.turns.filter((turn) => turn.arm === "QUALIFICATION").length,
    turns_executed_A: result.turns.filter((turn) => turn.arm === "A").length,
    turns_executed_B: result.turns.filter((turn) => turn.arm === "B").length,
    turns_expected_per_arm: P0_TURNS_PER_ARM,
    schedule_followed:
      result.turns.filter((turn) => turn.arm === "A").length === P0_TURNS_PER_ARM &&
      result.turns.filter((turn) => turn.arm === "B").length === P0_TURNS_PER_ARM,
    qualification_passed: result.qualificationPassed,
    integrity_failures: result.integrityFailures,
    call_tally: { ...bundle.tally },
    total_model_calls: totalCalls,
    exact_belief_semantic_calls: bundle.tally.belief_semantic,
    executor_model: bundle.executorModel,
    executor_base_url: bundle.executorBaseUrl,
    transport_substituted: true,
    transport_substitution_note:
      "ALL FOUR families use the OpenAI-compatible transport on the swapped endpoint. NONE uses the local executor. See EXECUTOR_SWAP_AMENDMENT.md for the changed-condition declaration.",
    subject_ids: subjectIds,
    condition_name: conditionName,
    attempted_provider_calls: bundle.attempts.length,
    arms_share_a_byte_identical_opening_turn:
      result.turns.find((turn) => turn.arm === "A" && turn.turn_index === 0)?.user_text ===
      result.turns.find((turn) => turn.arm === "B" && turn.turn_index === 0)?.user_text,
    trajectory_evidence_carries_model_generated_content:
      "yes, and this is inherent to the production ordering law: from turn 1 the evidence offered to belief adaptation is the behaviour-outcome feedback of the PREVIOUS turn, which contains the subject's own delivered reply as well as the user text. Phase 0 therefore does NOT claim a single-byte intervention; it claims matched authored events whose only authored difference is the frozen valence span."
  };
  hashes["collection-integrity.json"] = await write("collection-integrity.json", { integrity, artifact_hashes: hashes });
  await write("execution-manifest.json", {
    phase: `HISTORY_INTERNALIZATION_TEST_V1_PHASE_0_${condition.toUpperCase()}`,
    condition: conditionName,
    scored: false,
    next_step: "run the frozen scorer against the frozen post-state artifacts",
    artifact_hashes: hashes
  });

  console.log("");
  console.log(`${condition.toUpperCase()} EXECUTION COMPLETE — ${String(result.turns.length)} turns`);
  console.log(
    `  calls: cognition=${String(bundle.tally.cognition)} language=${String(bundle.tally.language)} ` +
      `appraisal=${String(bundle.tally.appraisal)} belief_semantic=${String(bundle.tally.belief_semantic)} total=${String(totalCalls)}`
  );
  console.log(`  integrity failures: ${String(result.integrityFailures.length)}`);
  console.log(`  leakage clean: ${String(result.executedLeakage["clean"])}`);
  console.log("STOP — no further turns, no extension, no retry, no scoring in this program.");
}

await main();
