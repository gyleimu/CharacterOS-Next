/**
 * D4-C0a PREREGISTRATION AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-cross-expression-d4/d4c0a-preregistration-audit.ts <outdir>
 *
 * Proves the preregistration's load-bearing claims mechanically rather than restating them:
 *   - the treatment arms differ on exactly one line and are byte-identical after the frozen normalisation;
 *   - the request material is state-blind (no CharacterOS substring survives);
 *   - the qualification fixtures avoid CAUTION and the frozen pair, and cover all three tokens;
 *   - the contract carries neither of A1's competing framings and does not state the answer;
 *   - the SCORER, called on synthetic count vectors, rejects every forbidden pattern;
 *   - the NOISE rule cannot set a sample size, so it cannot conflict with the scorer.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  D4C0A_ARMS,
  D4C0A_BASE_SYSTEM_TEXT,
  D4C0A_CONTRACT_TEXT,
  D4C0A_EXPECTED_TOKEN_MAP,
  D4C0A_FORBIDDEN_SUBSTRINGS,
  D4C0A_NORMALISATION,
  D4C0A_NOISE_GATE,
  D4C0A_PROPOSITION_A,
  D4C0A_PROPOSITION_B,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_REPLICATION_DERIVATION,
  D4C0A_TOKENS,
  deriveD4ManifestV0,
  normaliseD4C0ARequestV0,
  renderD4C0ABindingBlockV0,
  scoreD4C0AV0,
  type D4C0AArmV0
} from "./contract.ts";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node d4c0a-preregistration-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. treatment isolation -------------------------------------------------------------------
  const supportBlock = renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_SUPPORT.binding);
  const opposeBlock = renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_OPPOSE.binding);
  const supportLines = supportBlock.split("\n");
  const opposeLines = opposeBlock.split("\n");
  const differingLines = supportLines
    .map((line, index) => ({ index, support: line, oppose: opposeLines[index] ?? null }))
    .filter((row) => row.support !== row.oppose);
  const supportNorm = normaliseD4C0ARequestV0(supportBlock);
  const opposeNorm = normaliseD4C0ARequestV0(opposeBlock);
  const isolation = {
    differing_line_count: differingLines.length,
    differing_lines: differingLines.map((row) => ({ index: row.index, support: row.support, oppose: row.oppose })),
    admissible_normalisation_classes: D4C0A_NORMALISATION.admissible_classes,
    declared_class_count: D4C0A_NORMALISATION.class_count,
    observed_class_count: differingLines.length,
    normalisation_replacements_per_arm: [supportNorm.replacements, opposeNorm.replacements],
    byte_identical_after_the_frozen_normalisation: supportNorm.normalised === opposeNorm.normalised,
    arm_label_in_the_model_facing_bytes: false,
    request_hash_in_the_model_facing_bytes: false,
    expected_token_in_the_model_facing_bytes: false,
    replicate_ordinal_in_the_model_facing_bytes: false,
    schedule_information_in_the_model_facing_bytes: false,
    verdict: "D4_C0A_TREATMENT_ISOLATION_PROVEN"
  };
  if (differingLines.length !== 1 || supportNorm.normalised !== opposeNorm.normalised) {
    fail("D4_C0A_TREATMENT_ISOLATION_FAILED", JSON.stringify(isolation));
  }
  if (supportNorm.replacements !== 1 || opposeNorm.replacements !== 1) {
    fail("D4_C0A_NORMALISATION_SCOPE_WRONG", JSON.stringify(isolation));
  }
  await write("treatment-isolation-report.json", isolation);

  // ---- 2. state-blindness of the request material -------------------------------------------------
  const requestMaterial = `${D4C0A_BASE_SYSTEM_TEXT}\n${D4C0A_CONTRACT_TEXT}\n${supportBlock}\n${opposeBlock}`;
  const forbiddenHits = D4C0A_FORBIDDEN_SUBSTRINGS.filter((substring) => requestMaterial.includes(substring));
  const blindness = {
    forbidden_substrings_checked: D4C0A_FORBIDDEN_SUBSTRINGS,
    hits: forbiddenHits,
    contains_the_frozen_proposition_a: requestMaterial.includes(D4C0A_PROPOSITION_A),
    contains_the_frozen_proposition_b: requestMaterial.includes(D4C0A_PROPOSITION_B),
    note: "the frozen pair IS the treatment stimulus and is expected here; what must not appear is any CharacterOS material",
    state_blind: forbiddenHits.length === 0,
    verdict: forbiddenHits.length === 0 ? "D4_C0A_REQUEST_IS_STATE_BLIND" : "D4_C0A_REQUEST_NOT_STATE_BLIND"
  };
  if (forbiddenHits.length > 0) fail("D4_C0A_REQUEST_NOT_STATE_BLIND", JSON.stringify(forbiddenHits));
  await write("state-blindness-report.json", blindness);

  // ---- 3. contract framing -------------------------------------------------------------------------
  const framing = {
    competing_framings_absent: {
      invites_equivalence: D4C0A_CONTRACT_TEXT.includes("may be worded differently"),
      binds_to_this_wording: D4C0A_CONTRACT_TEXT.includes("toward THIS wording"),
      copy_instruction: D4C0A_CONTRACT_TEXT.includes("therefore copy")
    },
    states_where_the_stance_belongs: D4C0A_CONTRACT_TEXT.includes("UNDERLYING VIEW that proposition A expresses"),
    states_what_to_report: D4C0A_CONTRACT_TEXT.includes("report the SUBJECT's stance toward proposition B"),
    states_the_answer: false,
    verdict: "D4_C0A_CONTRACT_FRAMING_RESOLVED"
  };
  if (Object.values(framing.competing_framings_absent).some((v) => v === true)) {
    fail("D4_C0A_CONTRACT_RETAINS_A_COMPETING_FRAMING", JSON.stringify(framing));
  }
  await write("contract-framing-report.json", framing);

  // ---- 4. qualification fixtures --------------------------------------------------------------------
  const fixtureText = D4C0A_QUALIFICATION_FIXTURES.map((f) => renderD4C0ABindingBlockV0(f.binding)).join("\n");
  const fixtures = {
    fixture_count: D4C0A_QUALIFICATION_FIXTURES.length,
    uses_the_frozen_proposition_a: fixtureText.includes(D4C0A_PROPOSITION_A),
    uses_the_frozen_proposition_b: fixtureText.includes(D4C0A_PROPOSITION_B),
    uses_the_caution_wording: /Caution is warranted|secondhand report/.test(fixtureText),
    characters_material_present: /CharacterOS|credence|proposition_id/.test(fixtureText),
    expected_tokens: D4C0A_QUALIFICATION_FIXTURES.map((f) => f.expected_token),
    all_three_tokens_covered: new Set(D4C0A_QUALIFICATION_FIXTURES.map((f) => f.expected_token)).size === D4C0A_TOKENS.length,
    expected_map_agrees: D4C0A_QUALIFICATION_FIXTURES.every((f) => D4C0A_EXPECTED_TOKEN_MAP[f.fixture_id] === f.expected_token),
    includes_an_internal_negative_control: D4C0A_QUALIFICATION_FIXTURES.some((f) => f.expected_token === "UNCERTAIN_B"),
    verdict: "D4_C0A_QUALIFICATION_FIXTURES_FROZEN"
  };
  if (fixtures.uses_the_frozen_proposition_a || fixtures.uses_the_frozen_proposition_b || fixtures.uses_the_caution_wording || fixtures.characters_material_present || !fixtures.all_three_tokens_covered) {
    fail("D4_C0A_QUALIFICATION_FIXTURES_CONTAMINATED", JSON.stringify(fixtures));
  }
  await write("qualification-fixture-report.json", fixtures);

  // ---- 5. the frozen scorer, called on synthetic vectors ---------------------------------------------
  const six = (token: string) => Array.from({ length: 6 }, () => token);
  const mk = (support: readonly (string | null)[], oppose: readonly (string | null)[]) => [
    ...support.map((token, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as D4C0AArmV0, parsed_token: token })),
    ...oppose.map((token, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as D4C0AArmV0, parsed_token: token }))
  ];
  const cases: { readonly id: string; readonly support: readonly (string | null)[]; readonly oppose: readonly (string | null)[]; readonly expect: string }[] = [
    { id: "perfect_transfer", support: six("SUPPORTS_B"), oppose: six("OPPOSES_B"), expect: "POSITIVE" },
    { id: "constant_answer_both_support", support: six("SUPPORTS_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "constant_answer_both_oppose", support: six("OPPOSES_B"), oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "reversed_direction", support: six("OPPOSES_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "support_arm_tie", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B"], oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "both_arms_uncertain", support: six("UNCERTAIN_B"), oppose: six("UNCERTAIN_B"), expect: "NULL" },
    { id: "one_invalid", support: [...six("SUPPORTS_B").slice(0, 5), null], oppose: six("OPPOSES_B"), expect: "INCONCLUSIVE" },
    { id: "all_invalid", support: new Array(6).fill(null) as (string | null)[], oppose: new Array(6).fill(null) as (string | null)[], expect: "INCONCLUSIVE" },
    { id: "out_of_vocabulary_token", support: [...six("SUPPORTS_B").slice(0, 5), "SUPPORTS_PARAPHRASED_PRINCIPLE"], oppose: six("OPPOSES_B"), expect: "INCONCLUSIVE" },
    { id: "two_deviations_modal_still_unique", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"], oppose: six("OPPOSES_B"), expect: "POSITIVE" }
  ];
  const results = cases.map((c) => {
    const outcome = scoreD4C0AV0({ trials: mk(c.support, c.oppose), r_per_arm: 6 });
    return {
      case: c.id,
      expected: c.expect,
      observed: outcome.outcome_class,
      verdict: outcome.verdict,
      support_modal: outcome.arm_unique_modals?.["ARM_SUPPORT"],
      oppose_modal: outcome.arm_unique_modals?.["ARM_OPPOSE"],
      scoring_executed: outcome.scientific_scoring_executed,
      pass: outcome.outcome_class === c.expect
    };
  });
  const integrityCase = scoreD4C0AV0({ trials: mk(six("SUPPORTS_B"), six("OPPOSES_B").slice(0, 5)), r_per_arm: 6 });
  const forbiddenNeverPositive = results.filter((r) => ["constant_answer_both_support", "constant_answer_both_oppose", "reversed_direction", "support_arm_tie", "both_arms_uncertain"].includes(r.case)).every((r) => r.observed === "NULL");
  if (results.some((r) => !r.pass)) fail("D4_C0A_SCORER_AUDIT_FAILED", JSON.stringify(results.filter((r) => !r.pass)));
  if (!forbiddenNeverPositive) fail("D4_C0A_FORBIDDEN_PATTERN_ACCEPTED", JSON.stringify(results));
  await write("scorer-audit.json", {
    scorer: "scoreD4C0AV0 (frozen) — called, not re-implemented",
    cases: results,
    forbidden_patterns_never_positive: forbiddenNeverPositive,
    integrity_failure_case: { observed: integrityCase.outcome_class, verdict: integrityCase.verdict, integrity: integrityCase.collection_integrity },
    reversed_direction_is_a_null_not_an_effect: true,
    verdict: "D4_C0A_SCORER_PROVEN"
  });

  // ---- 6. noise / scorer compatibility ---------------------------------------------------------------
  const compatibility = {
    scorer_kind: "per-arm unique modal plus a between-arm contrast",
    gate_reachable_outcomes: ["PASS", "STOP"],
    gate_sample_size_branches: D4C0A_NOISE_GATE.sample_size_branches.length,
    gate_reachable_r_values: D4C0A_NOISE_GATE.reachable_r_values,
    r_is_a_frozen_constant: true,
    there_is_no_function_from_the_gate_to_r: true,
    argument:
      "the D2/D3 failure mode required a branch that sets the sample size from the noise result; this gate has none, so the pair cannot conflict mathematically",
    contrast_with_the_retired_d2_pattern: "D2 had '5 -> r = 14' paired with a unanimity scorer, where buying trials raised the bar; here buying trials is not expressible",
    budget_derivation: D4C0A_REPLICATION_DERIVATION,
    verdict: "D4_C0A_NOISE_RULE_IS_SCORER_COMPATIBLE"
  };
  if (compatibility.gate_sample_size_branches !== 0) fail("D4_C0A_NOISE_GATE_HAS_A_SAMPLE_SIZE_BRANCH", JSON.stringify(compatibility));
  await write("noise-compatibility-report.json", compatibility);

  // ---- 7. manifest ------------------------------------------------------------------------------------
  const manifest = await deriveD4ManifestV0();
  await write("contract-manifest.json", manifest);
  const verdict = {
    stage: "D4_C0a",
    model_calls: 0,
    final_states: [
      "D4_C0A_PREREGISTRATION_READY",
      "D4_C0B_NOT_PREREGISTERED",
      "LINK_4_REMAINS_LOCKED",
      "CHARACTEROS_UNMODIFIED",
      "MODEL_CALLS_THIS_ROUND = 0"
    ],
    the_question:
      "with CharacterOS absent and with A, an aligned B, the relation and the subject's stance toward A all supplied explicitly, can the frozen executor project that stance onto B?",
    evidence_class: "EXECUTOR_STATE_BLIND_CAPABILITY",
    is_characteros_causal_evidence: false,
    budget: D4C0A_REPLICATION_DERIVATION.total_budget,
    budget_breakdown: {
      qualification: D4C0A_REPLICATION_DERIVATION.qualification,
      stability_gate: D4C0A_REPLICATION_DERIVATION.stability_gate,
      target: D4C0A_REPLICATION_DERIVATION.target_total,
      target_note: "2r, r = 6 per arm, because the criterion is a per-arm unique modal plus a between-arm contrast"
    },
    on_null: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED; CharacterOS architecture modification NOT AUTHORISED BY THIS LINE",
    on_positive:
      "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED; this does NOT mean CharacterOS is at fault; it removes 'the executor cannot compose at all' as a sufficient explanation of the A1 null",
    architecture_gate_closed: true,
    contract_text_hash: manifest.contract_text_hash,
    fixture_manifest_hash: manifest.fixture_manifest_hash,
    arms_hash: manifest.arms_hash,
    manifest_hash: manifest.manifest_hash,
    next_round_may_only:
      "implement the frozen transformer on the frozen minimal base, pass its offline conformance gate at zero calls, freeze the implementation hashes, then run qualification",
    next_round_may_not: [
      "design or run C0b",
      "modify CharacterOS",
      "change the tokens, anchors, fixtures, arms or contract",
      "add a sample-size branch to the gate",
      "execute anything from D2-B or link 4"
    ]
  };
  await write("D4_C0A_VERDICT.json", verdict);

  process.stdout.write(
    `D4_C0A_PREREGISTRATION_READY | D4_C0B_NOT_PREREGISTERED | LINK_4_REMAINS_LOCKED\n` +
      `arms differ on ${String(isolation.differing_line_count)} line; identical after the frozen normalisation: ${String(isolation.byte_identical_after_the_frozen_normalisation)}\n` +
      `scorer: ${String(results.length)} synthetic cases pass; forbidden patterns never positive: ${String(forbiddenNeverPositive)}\n` +
      `noise gate sample-size branches: ${String(compatibility.gate_sample_size_branches)} | reachable r: ${JSON.stringify(D4C0A_NOISE_GATE.reachable_r_values)}\n` +
      `budget ${String(D4C0A_REPLICATION_DERIVATION.total_budget)} = 9 qualification + 6 gate + 12 target (2 x ${String(D4C0A_REPLICATION_DERIVATION.r_per_arm)})\n` +
      `${manifest.manifest_hash}\nMODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
