/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 PRE_TREATMENT_SCHEDULE_AMENDMENT. OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/schedule-amendment.ts <outdir>
 *
 * Creates the corrected 60-trial core treatment schedule (five unconditional blocks, no restart
 * entry), freezes the future restart derivation rule, and stops. The old 72-entry schedule is
 * preserved untouched as failure evidence.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import { D1_AMENDMENT_VERSION, planScheduleV0 } from "./amendment.ts";
import { D1_DELTA_MIN, D1_HASH_PROJECTION_V0, deriveD1ManifestV0 } from "./contract.ts";

const OLD_SCHEDULE_DIR = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/noise-pilot";
const OLD_SCHEDULE_HASH = "sha256:11b32f96fe4d43688cadd5ca5347c2ed144b9f1954a3696be71e154e3c89729c";
const R_CONFIRM = 6;
const CORE_BLOCKS = ["P1_FULL", "P2_FULL", "P3_NEGATIVE_CONTROL", "P1_FRAME_MINIMAL", "STATE_REVERSAL"] as const;
const CONDITIONAL_BLOCK = "RESTART_CONTRAST" as const;
const RESTART_RULE_VERSION = "d1-restart-schedule-derivation-v1" as const;
const REV_2_HASH = "sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b";
const REV_3_HASH = "sha256:1781b3458fd760a73c27adb224e29e4c9d156ac60815383ac1d65e2dd298b60c";
const REV_4_HASH = "sha256:ed8e6949f9b4cf2b393e3ec57d6b87682dd05ef03507edc3bb42dc2ab327f885";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/**
 * The frozen future restart derivation rule: a pure function of the protocol identity, the block
 * name, r_confirm and the rule version. It takes NO treatment output — not the decision counts,
 * not the effect size, not any sample statistic — so the restart ordering cannot be influenced by
 * how the core treatment turned out.
 */
export async function deriveRestartScheduleSeedV0(input: {
  readonly current_protocol_identity: string;
  readonly r_confirm: number;
}): Promise<string> {
  return String(
    await hashEnvelope("characteros-next/research/d1-belief-state-sensitivity/restart-seed/v1", {
      rule_version: RESTART_RULE_VERSION,
      current_protocol_identity: input.current_protocol_identity,
      block: CONDITIONAL_BLOCK,
      r_confirm: input.r_confirm
    })
  );
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node schedule-amendment.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const manifest = await deriveD1ManifestV0();
  const protocolChain = {
    revision_2: REV_2_HASH,
    revision_3: REV_3_HASH,
    revision_4: REV_4_HASH,
    current_effective_preregistration_hash: manifest.preregistration_hash
  };

  // ---- 1/2/11.1 old schedule preserved untouched -------------------------------------
  const oldRaw = await readFile(join(OLD_SCHEDULE_DIR, "D1_EXECUTION_SCHEDULE_ACTUAL.json"), "utf8");
  const oldDoc = JSON.parse(oldRaw) as { schedule: { schedule_hash: string; trials: unknown[] } };
  if (oldDoc.schedule.schedule_hash !== OLD_SCHEDULE_HASH || oldDoc.schedule.trials.length !== 72) {
    fail("D1_SCHEDULE_EVIDENCE_CHANGED", "the old schedule no longer matches the recorded failure evidence");
  }
  await write("invalid-schedule-reference.json", {
    artifact: "evidence/run-001/noise-pilot/D1_EXECUTION_SCHEDULE_ACTUAL.json",
    recorded_hash: OLD_SCHEDULE_HASH,
    recorded_entries: 72,
    retained_as_failure_evidence: true,
    rewritten: false,
    entries_deleted: false,
    on_disk_content_hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { content: oldRaw })),
    on_disk_hash_matches_recorded_schedule_hash: oldDoc.schedule.schedule_hash === OLD_SCHEDULE_HASH
  });

  // ---- 3/4/5. the corrected CORE schedule ---------------------------------------------
  const core = await planScheduleV0({
    preregistration_hash: manifest.preregistration_hash,
    r_confirm: R_CONFIRM,
    blocks: CORE_BLOCKS
  });
  const coreBlocks = core.blocks.map((b) => b.block);
  const audit = {
    total_entries: core.trials.length,
    block_count: coreBlocks.length,
    block_list: coreBlocks,
    restart_entries_present: core.trials.some((t) => t.block === CONDITIONAL_BLOCK),
    per_block: core.blocks.map((b) => ({ block: b.block, HIGH: b.high_count, LOW: b.low_count, max_run_length: b.max_run_length })),
    deterministic: true,
    balanced: core.blocks.every((b) => b.high_count === R_CONFIRM && b.low_count === R_CONFIRM),
    max_run_length: Math.max(...core.blocks.map((b) => b.max_run_length)),
    frozen_max_run_bound: 2,
    outcome_dependency: false,
    replicate_ordinal_model_facing: false,
    generator_semantics_unchanged: true,
    only_the_block_list_changed: true
  };
  if (audit.total_entries !== 60) fail("D1_CORE_SCHEDULE_CARDINALITY_FAILED", String(audit.total_entries));
  if (coreBlocks.length !== 5) fail("D1_CORE_SCHEDULE_CARDINALITY_FAILED", `blocks=${String(coreBlocks.length)}`);
  if (audit.restart_entries_present) fail("D1_CORE_SCHEDULE_CONTAINS_RESTART", "restart entry present");
  if (!audit.balanced || audit.max_run_length > 2) fail("D1_CORE_SCHEDULE_AUDIT_FAILED", JSON.stringify(audit));

  // determinism: regenerate and compare
  const again = await planScheduleV0({
    preregistration_hash: manifest.preregistration_hash,
    r_confirm: R_CONFIRM,
    blocks: CORE_BLOCKS
  });
  if (again.schedule_hash !== core.schedule_hash) {
    fail("D1_CORE_SCHEDULE_NOT_DETERMINISTIC", "regeneration produced a different hash");
  }

  // the correction changed only the block set: each core block's arm order is unchanged, because a
  // block's seed depends only on the block NAME length, the base seed and r_confirm.
  const oldByBlock = new Map((oldDoc as unknown as { schedule: { blocks: { block: string; arms: string[] }[] } }).schedule.blocks.map((b) => [b.block, b.arms]));
  const orderingPreserved: Record<string, boolean> = {};
  for (const b of core.blocks) {
    orderingPreserved[b.block] = JSON.stringify(oldByBlock.get(b.block)) === JSON.stringify(b.arms);
  }

  await write("D1_CORE_TREATMENT_SCHEDULE_V2.json", {
    schedule_spec_version: D1_AMENDMENT_VERSION,
    amendment_kind: "PRE_TREATMENT_SCHEDULE_AMENDMENT",
    created_before_first_treatment_call: true,
    treatment_calls_made_at_freeze: 0,
    r_confirm: R_CONFIRM,
    block_list: coreBlocks,
    superseded_invalid_schedule_hash: OLD_SCHEDULE_HASH,
    protocol_chain: protocolChain,
    audit,
    ordering_preserved_versus_the_invalid_schedule_per_block: orderingPreserved,
    schedule: core
  });
  await write("core-treatment-schedule-hash.json", {
    core_schedule_hash: core.schedule_hash,
    r_confirm: R_CONFIRM,
    block_list: coreBlocks,
    superseded_invalid_schedule_hash: OLD_SCHEDULE_HASH,
    protocol_chain: protocolChain
  });
  await write("core-treatment-schedule-audit.json", { ...audit, ordering_preserved_versus_the_invalid_schedule_per_block: orderingPreserved });

  // ---- 6/7. freeze the future restart derivation rule now ----------------------------
  const restartSeed = await deriveRestartScheduleSeedV0({
    current_protocol_identity: manifest.preregistration_hash,
    r_confirm: R_CONFIRM
  });
  const hypothetical = await planScheduleV0({
    preregistration_hash: restartSeed,
    r_confirm: R_CONFIRM,
    blocks: [CONDITIONAL_BLOCK]
  });
  const hypotheticalOk =
    hypothetical.trials.length === 12 &&
    hypothetical.blocks[0]?.high_count === R_CONFIRM &&
    hypothetical.blocks[0]?.low_count === R_CONFIRM;
  if (!hypotheticalOk) fail("D1_RESTART_DERIVATION_RULE_FAILED", "the frozen rule does not produce a balanced 12-entry schedule");

  await write("restart-schedule-derivation-rule.json", {
    rule_version: RESTART_RULE_VERSION,
    seed_projection: "characteros-next/research/d1-belief-state-sensitivity/restart-seed/v1",
    seed_function_inputs: ["rule_version", "current_protocol_identity", "block", "r_confirm"],
    forbidden_inputs: ["treatment decisions", "treatment counts", "effect size", "any sample statistic", "timestamps", "human-selected seed"],
    generator: "the same frozen planScheduleV0 with balancing and max-run semantics unchanged",
    restart_r_confirm: R_CONFIRM,
    restart_block_list: [CONDITIONAL_BLOCK],
    restart_entries_if_unlocked: 12,
    frozen_seed_for_this_protocol: restartSeed,
    hypothetical_check_when_unlocked: { entries: hypothetical.trials.length, balanced: hypotheticalOk },
    can_consume_treatment_output: false,
    materialized_now: false
  });
  await write("restart-unlock-contract.json", {
    restart_unlocked: false,
    restart_schedule_materialized: false,
    restart_currently_executable_trials: 0,
    unlock_predicate: "the frozen direct-positive predicate on the core treatment contrast (P1_FULL): modal_HIGH=VERIFY AND modal_LOW=ACCEPT AND delta_verify>=delta_min AND delta_accept>=delta_min AND both deltas exceed the frozen Wilson ceiling",
    if_gate_fails: "the restart schedule is never materialised",
    if_gate_passes: "generate 12 entries (HIGH=6, LOW=6) via the frozen derivation rule above",
    observed_neutral_pilot_informs_the_gate: false
  });

  // ---- 8/9. budget and noise preservation --------------------------------------------
  await write("PRE_TREATMENT_SCHEDULE_AMENDMENT.json", {
    amendment_kind: "PRE_TREATMENT_SCHEDULE_AMENDMENT",
    not_a_global_pre_data_amendment: true,
    neutral_calls_before_amendment: 6,
    high_low_calls_before_amendment: 0,
    treatment_outputs_seen: false,
    reason_for_amendment: "the conditional restart block was incorrectly serialized into the immediately executable treatment queue",
    amendment_trigger: "schedule integrity audit",
    amendment_depends_on_high_low_outcomes: false,
    must_not_claim_model_calls_before_amendment_zero: "6 NEUTRAL calls already exist",
    scope: "schedule execution semantics only",
    unmodified: [
      "CAUTION proposition", "HIGH/LOW/NEUTRAL", "P1/P2/P3", "DecisionProbeV2",
      "Revision 3", "Revision 4", "noise rule", "Wilson ceiling", "delta_min = 0.50",
      "r_confirm = 6", "scorer", "positive predicate", "frame logic", "state reversal",
      "restart unlock predicate", "history absence", "request certification"
    ],
    budget: {
      neutral_pilot_executed: 6,
      core_treatment_pending: 60,
      cumulative_after_core: 66,
      conditional_restart_if_unlocked: 12,
      maximum_total: 78,
      matches_frozen_formula: "6 + 10r = 66; restart addon 2r = 12"
    },
    noise_rule_preserved: {
      observed_same_request_disagreement: 0.0,
      frozen_wilson_upper_bound_at_n6: 0.3903,
      delta_min: D1_DELTA_MIN,
      pilot_rerun: false,
      neutral_replicates_appended: false,
      pilot_result_used_to_change_schedule_ordering: false
    }
  });

  await write("schedule-amendment-manifest.json", {
    amendment_kind: "PRE_TREATMENT_SCHEDULE_AMENDMENT",
    verdict: "PRE_TREATMENT_SCHEDULE_AMENDMENT_FROZEN",
    core_schedule_verdict: "D1_CORE_TREATMENT_SCHEDULE_REFROZEN",
    core_schedule_hash: core.schedule_hash,
    superseded_invalid_schedule_hash: OLD_SCHEDULE_HASH,
    core_treatment_calls_authorised: 60,
    restart_contrast_locked: true,
    high_low_treatment_started: false,
    model_calls_transmitted: 6
  });

  process.stdout.write(`\nPRE_TREATMENT_SCHEDULE_AMENDMENT_FROZEN\nD1_CORE_TREATMENT_SCHEDULE_REFROZEN\n`);
  process.stdout.write(`CORE_TREATMENT_CALLS_AUTHORISED = 60\nRESTART_CONTRAST_LOCKED\nHIGH_LOW_TREATMENT_NOT_STARTED\nMODEL_CALLS_TRANSMITTED = 6\n`);
  process.stdout.write(`core_schedule_hash = ${core.schedule_hash}\n`);
  process.stdout.write(`old hash preserved = ${OLD_SCHEDULE_HASH}\n`);
  process.stdout.write(`ordering preserved per core block = ${JSON.stringify(orderingPreserved)}\n`);
}

await main();
