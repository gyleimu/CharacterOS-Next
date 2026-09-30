/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 PRE_TREATMENT_INTEGRITY_FINALIZATION. OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/pre-treatment-finalize.ts <outdir>
 *
 * FIX 1: mechanically determine the real seed-collision groups of the frozen generator and correct
 *        the earlier erroneous limitation record; verify the frozen 60-entry schedule regenerates
 *        to the exact same hash.
 * FIX 2: freeze the STATE_REVERSAL interpretation boundary before any HIGH/LOW output exists.
 *
 * Nothing here regenerates, reorders, re-randomises or modifies the schedule or any request.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import { planScheduleV0 } from "./amendment.ts";
import { D1_HASH_PROJECTION_V0, deriveD1ManifestV0 } from "./contract.ts";

const REQUEST_DIR = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/treatment-request-freeze";
const SCHEDULE_FILE = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/schedule-amendment/D1_CORE_TREATMENT_SCHEDULE_V2.json";
const FROZEN_CORE_HASH = "sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371";
const R_CONFIRM = 6;
const CORE_BLOCKS = ["P1_FULL", "P2_FULL", "P3_NEGATIVE_CONTROL", "P1_FRAME_MINIMAL", "STATE_REVERSAL"] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node pre-treatment-finalize.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const manifest = await deriveD1ManifestV0();
  const frozenDoc = JSON.parse(await readFile(SCHEDULE_FILE, "utf8")) as {
    schedule: { schedule_hash: string; trials: { ordinal: number; block: string; arm: string }[]; blocks: { block: string; arms: string[] }[] };
  };
  if (frozenDoc.schedule.schedule_hash !== FROZEN_CORE_HASH) {
    fail("D1_CORE_SCHEDULE_HASH_CHANGED", frozenDoc.schedule.schedule_hash);
  }

  // ---- FIX 1a: what does the frozen generator's `block.length` actually mean? ----------
  // In amendment.ts the seed is `(baseSeed ^ (block.length * 2654435761) ^ r_confirm) >>> 0`
  // where `block: D1BlockId` is a STRING LITERAL union type, so `block.length` is the literal
  // JavaScript string length of the block name.
  const literalLengths = CORE_BLOCKS.map((b) => ({ block: b, literal_length: b.length }));

  // ---- FIX 1b: derive each block's arm ordering MECHANICALLY, via the frozen generator ---
  // Recomputing a block's seed requires module-private helpers, so the collision groups are
  // established empirically instead: plan each block alone and compare the produced arm orderings.
  const perBlock: { block: string; literal_length: number; arms: string[]; arm_ordering_hash: string }[] = [];
  for (const block of CORE_BLOCKS) {
    const single = await planScheduleV0({
      preregistration_hash: manifest.preregistration_hash,
      r_confirm: R_CONFIRM,
      blocks: [block]
    });
    const arms = single.blocks[0]?.arms ?? [];
    perBlock.push({
      block,
      literal_length: block.length,
      arms: [...arms],
      // The ordering hash covers ONLY the arm sequence: including the block name here would make two
      // blocks with identical orderings hash differently and hide a real seed collision.
      arm_ordering_hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { arms }))
    });
  }
  const groups = new Map<string, string[]>();
  for (const entry of perBlock) {
    const key = entry.arm_ordering_hash;
    groups.set(key, [...(groups.get(key) ?? []), entry.block]);
  }
  const collisionGroups = [...groups.values()].filter((g) => g.length > 1);

  // ---- FIX 1c: the frozen 60-entry schedule must regenerate identically -----------------
  const regenerated = await planScheduleV0({
    preregistration_hash: manifest.preregistration_hash,
    r_confirm: R_CONFIRM,
    blocks: CORE_BLOCKS
  });
  const regenerationExact = regenerated.schedule_hash === FROZEN_CORE_HASH;
  const trialsExact =
    regenerated.trials.length === frozenDoc.schedule.trials.length &&
    regenerated.trials.every((t, i) => {
      const f = frozenDoc.schedule.trials[i];
      return f !== undefined && f.ordinal === t.ordinal && f.block === t.block && f.arm === t.arm;
    });
  if (!regenerationExact || !trialsExact) {
    await write("schedule-generator-collision-correction.json", {
      verdict: "D1_CORE_SCHEDULE_REGENERATION_MISMATCH",
      frozen_hash: FROZEN_CORE_HASH,
      regenerated_hash: regenerated.schedule_hash,
      trials_exact: trialsExact
    });
    fail("D1_CORE_SCHEDULE_REGENERATION_MISMATCH", `${regenerated.schedule_hash} trials_exact=${String(trialsExact)}`);
  }

  await write("schedule-generator-collision-correction.json", {
    verdict: "SCHEDULE_GENERATOR_COLLISION_RECORD_CORRECTED",
    the_corrected_error: {
      earlier_claim: "the five core block names have the same length",
      why_it_was_wrong:
        "`block.length` in the frozen generator is the literal JavaScript string length of the block name, and three of the five core block names have distinct lengths; the earlier record generalised from a coincidental pair",
      earlier_file: "evidence/run-001/treatment-request-freeze/schedule-generator-limitation.json",
      earlier_file_preserved_not_rewritten: true
    },
    generator_semantics_confirmed: {
      expression: "(baseSeed ^ (block.length * 2654435761) ^ r_confirm) >>> 0",
      block_operand_type: "the block identifier, a string literal union, so `block.length` is a string length",
      was_it_a_string_length: true,
      why_the_earlier_phrasing_was_still_wrong: "it asserted all five names share a length; only two do"
    },
    literal_lengths: literalLengths,
    per_block_arm_ordering: perBlock,
    true_collision_groups: collisionGroups,
    collision_group_count: collisionGroups.length,
    blocks_in_collision_groups: collisionGroups.flat(),
    derivation_method:
      "empirical: each block was planned ALONE through the frozen generator and the produced arm orderings were compared by hash; no generator internals were modified and no seed was guessed",
    regeneration_verification: {
      frozen_core_schedule_hash: FROZEN_CORE_HASH,
      regenerated_core_schedule_hash: regenerated.schedule_hash,
      exact_match: regenerationExact,
      trials_structurally_identical: trialsExact,
      schedule_remains_valid: true
    },
    actions_forbidden_and_not_taken: [
      "regenerating the schedule file",
      "reordering or re-randomising any block",
      "modifying the frozen generator",
      "modifying any frozen request"
    ]
  });

  // ---- FIX 2: STATE_REVERSAL interpretation boundary ------------------------------------
  const [p1h, p1l, rvh, rvl] = await Promise.all(
    ["P1_FULL_HIGH.json", "P1_FULL_LOW.json", "STATE_REVERSAL_HIGH.json", "STATE_REVERSAL_LOW.json"].map(
      async (name) => JSON.parse(await readFile(join(REQUEST_DIR, name), "utf8")) as { final_model_facing_request_hash: string; provenance_source: string }
    )
  );
  const observed = {
    p1_high_equals_reversal_high: p1h.final_model_facing_request_hash === rvh.final_model_facing_request_hash,
    p1_low_equals_reversal_low: p1l.final_model_facing_request_hash === rvl.final_model_facing_request_hash,
    p1_high_hash: p1h.final_model_facing_request_hash,
    reversal_high_hash: rvh.final_model_facing_request_hash,
    p1_low_hash: p1l.final_model_facing_request_hash,
    reversal_low_hash: rvl.final_model_facing_request_hash
  };
  if (!observed.p1_high_equals_reversal_high || !observed.p1_low_equals_reversal_low) {
    fail("D1_STATE_REVERSAL_NOT_BYTE_IDENTICAL", JSON.stringify(observed));
  }
  await write("STATE_REVERSAL_INTERPRETATION_CONTRACT.json", {
    frozen_before_any_high_low_output: true,
    treatment_outputs_seen_at_freeze: false,
    mechanically_observed: observed,
    what_state_reversal_does_prove: [
      "a fresh independent canonical world reconstruction occurred",
      "the same canonical identity and the same frozen CAUTION proposition were used",
      "HIGH = 0.80 and LOW = 0.20 were re-materialised independently",
      "a fresh production observation lifecycle was executed (commit + post-observation isolation)",
      "deterministic regeneration of the same model-facing HIGH/LOW treatment representation",
      "repeated executor behaviour under an independently reconstructed but byte-identical contrast"
    ],
    therefore_it_can_support: [
      "WITHIN_IDENTITY_RECONSTRUCTION_REPLICATION",
      "STATE_EFFECT_REPLICATED_AFTER_FRESH_RECONSTRUCTION (if the result tracks the belief direction)"
    ],
    what_it_does_NOT_prove: [
      "a second independent model-facing intervention",
      "an information-independent causal contrast",
      "cross-identity mediation",
      "a separate behavioural mechanism",
      "independent evidence equivalent to a different probe family"
    ],
    reason_for_the_boundary: "the final executor input is byte-identical to the corresponding P1_FULL arm, so it cannot carry information P1_FULL did not already carry",
    scoring: {
      scorer_modified: false,
      uses: "the frozen classifyContrastV0",
      still_assessed_for: "whether the decision tracks the belief value",
      scientific_role_in_the_final_report: "confirmatory reconstruction replication, NOT a second independent estimand",
      forbidden: [
        "multiplying, pooling or summing P1_FULL and STATE_REVERSAL as two statistically independent pieces of evidence",
        "claiming double independent verification",
        "reporting it as an additional independent probe family"
      ]
    },
    frozen_evidence_families: {
      primary: "P1_FULL",
      near_transfer: "P2_FULL",
      specificity_control: "P3_NEGATIVE_CONTROL",
      measurement_frame_diagnostic: "P1_FRAME_MINIMAL",
      reconstruction_replication: "STATE_REVERSAL"
    }
  });

  await write("pre-treatment-final-integrity-manifest.json", {
    verdict: "D1_PRE_TREATMENT_INTEGRITY_FINALIZED",
    treatment_outputs_seen_before_correction: false,
    high_low_calls_before_correction: 0,
    schedule_regeneration_exact: regenerationExact,
    collision_record_corrected: true,
    state_reversal_interpretation_frozen: true,
    schedule_unchanged: true,
    requests_unchanged: true,
    core_treatment_calls_authorised: 60,
    high_low_treatment_started: false,
    model_calls_transmitted_total: 6,
    model_calls_this_round: 0,
    no_new_pre_treatment_gate_added: true
  });

  process.stdout.write(`\nD1_PRE_TREATMENT_INTEGRITY_FINALIZED\n`);
  process.stdout.write(`schedule regeneration exact = ${String(regenerationExact)}\n`);
  process.stdout.write(`true collision groups = ${JSON.stringify(collisionGroups)}\n`);
  process.stdout.write(`literal lengths = ${JSON.stringify(literalLengths.map((l) => l.block + ":" + String(l.literal_length)))}\n`);
  process.stdout.write(`CORE_TREATMENT_CALLS_AUTHORISED = 60\nHIGH_LOW_TREATMENT_NOT_STARTED\nMODEL_CALLS_TRANSMITTED = 6\n`);
}

await main();
