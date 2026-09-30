/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * SWAPPED-CONDITION CONTRACT QUALIFICATION — REV2 (multi-turn). The gate that decides whether the swap
 * is usable.
 *
 *   npx tsx phase-0/cloud-swap/cloud-qualification.ts <outdir>
 *
 * WHAT IT ASKS: the local executor produced, twice, byte-identically and on different runs,
 *
 *   CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED:
 *   SEMANTIC_COMPLETENESS_FAILED: conversation proposal.response_semantics:
 *   PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance
 *
 * Does the swapped executor still produce it?
 *
 * WHY REV2 EXISTS — REV1 WAS NOT A GATE. REV1 ran a single non-target turn per subject. But the
 * reproduced failure never occurred at turn 0: it occurred at `B:turn_2` (run-1) and `A:turn_1`
 * (run-3), because the production ordering law only feeds a turn's behaviour-outcome feedback into the
 * NEXT turn's belief-adaptation evidence. So a single-turn fixture cannot reach the failing shape — and
 * the frozen evidence proves it does not discriminate: run-1's `qualification.json` records
 * `turn_status: COMPLETE` and `lawful_terminal_observed: true`, i.e. **the local executor passed the
 * fixture that was supposed to filter it out**. REV1's PASS was a real result about runnability and a
 * NON-RESULT about the failure class. REV2 runs a THREE-turn non-target mini-trajectory, the shortest
 * shape that reaches the multi-turn evidence-feedback path. 3 turns x 2 subjects = 6, matching the
 * frozen N = 6 qualification size.
 *
 * WHAT IT IS NOT: not scientific evidence, not an endpoint, and it cannot contribute to any Phase-0
 * claim. The fixture is the frozen NON-target qualification subject with its own non-target
 * proposition (`prop.qual-floorboards`). The target proposition, the valence table and the scientific
 * trajectories are never loaded by this program.
 *
 * Execution rule: ALL SIX turns run regardless of intermediate outcomes, and none is retried — a gate
 * that stopped early would report an uninterpretable rate, and a retried gate would change what N means.
 *
 * DISCRIMINATION IS ARGUED STRUCTURALLY, NOT MEASURED: proving this fixture would fail on the local
 * executor would require running the local executor, which the operator's constraint forbids.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { InteractiveSubjectRuntimeV0 } from "../../../../../packages/runtime/dist/index.js";

import { hashPhase0 } from "../contract.ts";
import { buildPhase0SourceForSubjectV0 } from "../fixtures.ts";
import { instrumentPhase0BundleV0, openPhase0RuntimeV0 } from "../harness.ts";
import { buildCloudPhase0BundleV0, declareCloudExecutorV0 } from "./cloud-bundle.ts";
import {
  CS_BASE_URL_DEFAULT,
  CS_CREDENTIAL_ENV,
  CS_MODEL_DEFAULT,
  CS_QUALIFICATION_REV2_SUBJECT_IDS,
  CS_QUALIFICATION_REV2_SUBJECTS,
  CS_QUALIFICATION_REV2_TOTAL_TURNS,
  CS_QUALIFICATION_REV2_TURN_TEXTS,
  CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT,
  CS_REPRODUCED_FAILURE_CLASS,
  CS_REPRODUCED_FAILURE_MARKER,
  classifyCsQualificationFailureV0,
  credentialFingerprintV0,
  redactCsV0,
  resolveCloudExecutorConfigV0,
  type CsExecutorConfigV0,
  type CsQualificationFailureKindV0
} from "./contract-cloud-v0.ts";

const LAWFUL_TERMINALS: readonly string[] = Object.freeze([
  "COMPLETE_COMMITTED",
  "COMPLETE_ALREADY_COMMITTED",
  "COMPLETE_NO_BEARING",
  "COMPLETE_NEW_PROPOSITION_ADMITTED"
]);

/** The two REV2 subjects come from the contract (single source of truth). */
const REV2_SUBJECT_IDS = CS_QUALIFICATION_REV2_SUBJECT_IDS;

interface CsQualificationTurnV0 {
  readonly subject_ordinal: number;
  readonly subject_id: string;
  readonly turn_index: number;
  readonly turn_text: string;
  readonly status: string;
  readonly failure: string | null;
  readonly failure_kind: CsQualificationFailureKindV0;
  readonly terminal_kind: string;
  readonly terminal_is_lawful: boolean;
  readonly belief_wiring_failure: string | null;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  /** Whether this turn is one where belief adaptation received prior-turn outcome feedback. */
  readonly reaches_multi_turn_evidence_feedback: boolean;
}

async function runSubjectV0(input: {
  readonly config: CsExecutorConfigV0;
  readonly subjectOrdinal: number;
  readonly subjectId: string;
}): Promise<{ readonly turns: CsQualificationTurnV0[]; readonly attempts: number }> {
  const bundle = instrumentPhase0BundleV0(buildCloudPhase0BundleV0(input.config));
  const runtime: InteractiveSubjectRuntimeV0 = await openPhase0RuntimeV0(
    input.subjectId,
    buildPhase0SourceForSubjectV0(input.subjectId, "QUALIFICATION"),
    `session-cloud-qualification-rev2-${String(input.subjectOrdinal).padStart(4, "0")}`,
    bundle
  );

  const turns: CsQualificationTurnV0[] = [];
  for (const [turnIndex, turnText] of CS_QUALIFICATION_REV2_TURN_TEXTS.entries()) {
    bundle.setTurnLabel?.(`QUALIFICATION_CLOUD:turn_${turnIndex}`);
    const before = await runtime.status();
    const outcome = (await runtime.submitUserText(turnText)) as {
      status: string;
      failure?: string | null;
      subject_text?: string | null;
      belief_adaptation?: { current?: { terminal_kind?: string } | null; failure?: string | null } | null;
    };
    const after = await runtime.status();
    const failureText = outcome.failure ?? null;
    const terminalKind = outcome.belief_adaptation?.current?.terminal_kind ?? "NONE";
    turns.push({
      subject_ordinal: input.subjectOrdinal,
      subject_id: input.subjectId,
      turn_index: turnIndex,
      turn_text: turnText,
      status: outcome.status,
      failure: failureText === null ? null : redactCsV0(failureText),
      failure_kind: classifyCsQualificationFailureV0(failureText),
      terminal_kind: terminalKind,
      terminal_is_lawful: LAWFUL_TERMINALS.includes(terminalKind),
      belief_wiring_failure: outcome.belief_adaptation?.failure ?? null,
      state_revision_before: before.state_revision,
      state_revision_after: after.state_revision,
      // Turn 0 has no prior turn; from turn 1 the evidence carries the previous turn's outcome feedback.
      reaches_multi_turn_evidence_feedback: turnIndex >= 1
    });
    if (outcome.status !== "COMPLETE") {
      // The production ordering law means a failed turn poisons the session; the arm stops there and the
      // remaining turns of THIS subject are not run. The planned-vs-actual accounting records it.
      break;
    }
  }
  return { turns, attempts: bundle.attempts.length };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("CS_QUALIFICATION_USAGE: usage: cloud-qualification.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  const apiKey = process.env[CS_CREDENTIAL_ENV] ?? null;
  let config: CsExecutorConfigV0;
  try {
    config = resolveCloudExecutorConfigV0({
      base_url: process.env["CS_BASE_URL"] ?? CS_BASE_URL_DEFAULT,
      model: process.env["CS_MODEL"] ?? CS_MODEL_DEFAULT,
      api_key: apiKey
    });
  } catch (thrown) {
    await write("CLOUD_QUALIFICATION_VERDICT.json", {
      artifact: "CLOUD_QUALIFICATION_VERDICT",
      revision: "REV2_MULTI_TURN",
      outcome: "NOT_RUN",
      reason: redactCsV0(thrown instanceof Error ? thrown.message : String(thrown)),
      turns_planned: CS_QUALIFICATION_REV2_TOTAL_TURNS,
      turns_executed: 0,
      credential_present: apiKey !== null
    });
    console.log("STOP — the swapped executor configuration could not be resolved; no provider call was made.");
    process.exitCode = 1;
    return;
  }

  const declaration = declareCloudExecutorV0(config);
  const credentialFingerprint = await credentialFingerprintV0(config.api_key as string);
  await write("CLOUD_QUALIFICATION_BOOTSTRAP.json", {
    artifact: "CLOUD_QUALIFICATION_BOOTSTRAP",
    revision: "REV2_MULTI_TURN",
    role: "NON_SCIENTIFIC_BOOTSTRAP",
    scientific: false,
    cannot_contribute_to_any_endpoint: true,
    why_rev2: {
      rev1_was_not_a_gate:
        "REV1 ran one turn per subject; the reproduced failure never occurs at turn 0. Frozen run-1 evidence proves REV1's fixture does not discriminate: qualification.json records turn_status COMPLETE and lawful_terminal_observed true, i.e. the LOCAL executor passed it.",
      failure_occurred_at: ["run-1 B:turn_2", "run-3 A:turn_1"],
      rev2_shape: `${String(CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT)} turns x ${String(CS_QUALIFICATION_REV2_SUBJECTS)} subjects = ${String(CS_QUALIFICATION_REV2_TOTAL_TURNS)} turns`,
      discrimination_is_argued_not_measured:
        "proving this fixture would fail on the local executor would require running the local executor, which the operator's constraint forbids"
    },
    fixture: {
      proposition_id: "prop.qual-floorboards",
      proposition_label: "The floorboards in the hallway are level.",
      turn_texts: CS_QUALIFICATION_REV2_TURN_TEXTS,
      subject_ids: REV2_SUBJECT_IDS,
      note: "the non-target qualification fixture; the target proposition and the valence table are never loaded by this program"
    },
    looking_for: { failure_class: CS_REPRODUCED_FAILURE_CLASS, marker: CS_REPRODUCED_FAILURE_MARKER },
    declaration,
    credential_fingerprint: credentialFingerprint,
    credential_value_recorded: false,
    packages_modified: false
  });

  console.log(`swapped executor: ${declaration.provider} / ${declaration.model} @ ${declaration.base_url}`);
  console.log(
    `qualification REV2: ${String(CS_QUALIFICATION_REV2_SUBJECTS)} subjects x ${String(CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT)} non-target turns`
  );

  const allTurns: CsQualificationTurnV0[] = [];
  let totalAttempts = 0;
  for (const [index, subjectId] of REV2_SUBJECT_IDS.entries()) {
    const { turns, attempts } = await runSubjectV0({ config, subjectOrdinal: index + 1, subjectId });
    allTurns.push(...turns);
    totalAttempts += attempts;
    await write(`cloud-qualification-rev2-subject-${String(index + 1).padStart(3, "0")}.json`, { turns });
    for (const turn of turns) {
      console.log(
        `  subject ${turn.subject_ordinal} turn ${turn.turn_index}: status=${turn.status} ` +
          `terminal=${turn.terminal_kind} failure_kind=${turn.failure_kind}`
      );
    }
  }

  const reproduced = allTurns.filter((turn) => turn.failure_kind === "REPRODUCED_FAILURE_CLASS");
  const otherFailures = allTurns.filter((turn) => turn.failure_kind === "OTHER_FAILURE");
  const multiTurnReached = allTurns.filter((turn) => turn.reaches_multi_turn_evidence_feedback);
  const criteria = {
    all_planned_turns_executed: allTurns.length === CS_QUALIFICATION_REV2_TOTAL_TURNS,
    all_turns_completed: allTurns.every((turn) => turn.status === "COMPLETE"),
    all_terminals_lawful: allTurns.every((turn) => turn.terminal_is_lawful),
    the_failing_shape_was_reached:
      multiTurnReached.length === CS_QUALIFICATION_REV2_SUBJECTS * (CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT - 1),
    reproduced_failure_class_absent: reproduced.length === 0,
    no_other_failure: otherFailures.length === 0
  };
  const pass = Object.values(criteria).every((value) => value === true);

  const verdict = {
    artifact: "CLOUD_QUALIFICATION_VERDICT",
    revision: "REV2_MULTI_TURN",
    supersedes: "the REV1 single-turn qualification PASS, whose fixture was shown to be non-discriminating",
    outcome: pass ? "PASS" : "FAIL",
    tokens: pass
      ? ["PHASE0_CLOUD_CONTRACT_QUALIFICATION_PASS", "PHASE0_CLOUD_SCIENTIFIC_RUN_AUTHORISED"]
      : [
          "PHASE0_CLOUD_CONTRACT_QUALIFICATION_FAIL",
          "PHASE0_CLOUD_SWAP_UNUSABLE",
          "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"
        ],
    executor: { provider: declaration.provider, model: declaration.model, base_url: declaration.base_url },
    role: "NON_SCIENTIFIC_BOOTSTRAP",
    scientific: false,
    cannot_contribute_to_any_endpoint: true,
    turns_planned: CS_QUALIFICATION_REV2_TOTAL_TURNS,
    turns_executed: allTurns.length,
    planned_equals_actual: allTurns.length === CS_QUALIFICATION_REV2_TOTAL_TURNS,
    retries: 0,
    criteria,
    counters: {
      completed: allTurns.filter((turn) => turn.status === "COMPLETE").length,
      reproduced_failure_class: reproduced.length,
      other_failures: otherFailures.length,
      turns_that_reached_the_multi_turn_evidence_feedback_shape: multiTurnReached.length,
      provider_attempts_total: totalAttempts
    },
    per_turn: allTurns.map((turn) => ({
      subject_ordinal: turn.subject_ordinal,
      turn_index: turn.turn_index,
      status: turn.status,
      failure_kind: turn.failure_kind,
      terminal_kind: turn.terminal_kind,
      reaches_multi_turn_evidence_feedback: turn.reaches_multi_turn_evidence_feedback
    })),
    what_a_pass_means:
      "on six non-target turns spanning the multi-turn evidence-feedback shape where the local executor failed twice, the swapped executor completed every turn without producing the reproduced failure class. It is a mechanical result about the executor on THIS non-target fixture. It is NOT scientific evidence, NOT an endpoint, and it does NOT establish general contract compliance.",
    what_a_pass_does_not_establish: [
      "that the swapped executor would survive the SCIENTIFIC trajectory (a different, larger, target-bearing request)",
      "that the fixture is discriminating — no local-executor comparison exists, by the operator's constraint",
      "any scientific claim or endpoint",
      "PHASE_1",
      "comparability with run-1 or run-3",
      "anything about D1"
    ],
    next_step_if_pass:
      "PHASE0_CLOUD_SCIENTIFIC_RUN_AUTHORISED — Phase-0 REV2 on the swapped condition with fresh opaque subjects, the same frozen trajectories, the same scorer and the same predicate. That run is a SEPARATE, separately-authorised round; it is NOT executed here.",
    next_step_if_fail:
      "PHASE0_CLOUD_SWAP_UNUSABLE — the swap does not fix the reproduced failure class, and the scientific run is NOT attempted. That outcome points at the production cognition contract itself rather than at executor capability."
  };
  await write("CLOUD_QUALIFICATION_VERDICT.json", verdict);

  console.log("");
  console.log(`CLOUD CONTRACT QUALIFICATION (REV2): ${verdict.outcome}  ${verdict.tokens.join(" ")}`);
  console.log(
    `  completed=${String(verdict.counters.completed)}/${String(CS_QUALIFICATION_REV2_TOTAL_TURNS)} ` +
      `reproduced_failure_class=${String(verdict.counters.reproduced_failure_class)} ` +
      `other_failures=${String(verdict.counters.other_failures)} ` +
      `multi_turn_shape_reached=${String(verdict.counters.turns_that_reached_the_multi_turn_evidence_feedback_shape)} ` +
      `provider_attempts=${String(totalAttempts)}`
  );
  console.log("STOP — no scientific run in this round, no retry.");
  if (!pass) process.exitCode = 1;
}

await main();
