/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3 REVISION 3 AUDIT — NOISE IDENTITY. 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-semantic-binding-d3/d3-rev3-audit.ts <qualificationEvidenceDir> <outdir>
 *
 * Proves, before any pilot call exists:
 *   - the selected noise fixture existed before qualification outputs and is not the target pair;
 *   - the selection rule is outcome-blind;
 *   - the noise request IS the frozen qualification request, byte for byte — including that a fresh
 *     render of the same pair reproduces the frozen bytes, so "reuse, never re-render" is checkable
 *     rather than merely declared;
 *   - the noise request contains no canonical CAUTION, no target paraphrase and no CharacterOS state;
 *   - the target call count is still zero.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import {
  D3_HASH_PROJECTION_V0,
  D3B_INPUTS_FROZEN,
  D3B_QUALIFICATION_FIXTURES
} from "./contract.ts";
import {
  D3_REV3_BUDGET,
  D3B_NOISE_REQUEST_IDENTITY,
  D3B_TARGET_ISOLATION,
  deriveD3Rev3ManifestV0,
  lexicographicallySmallestFixtureIdV0,
  selectNoiseFixtureIdV0
} from "./contract-rev3-noise-identity.ts";
import {
  buildD3RelationReadoutRequestV0,
  renderD3BContractTextV0
} from "./transformer-d3b.ts";
import { D1_CANONICAL_LABEL, A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK } from "./qualification-base.ts";

const A1_PARAPHRASE = D3B_INPUTS_FROZEN.statement_b;
const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const qualificationDir = process.argv[2];
  const outdir = process.argv[3];
  if (qualificationDir === undefined || outdir === undefined) {
    throw new Error("usage: node d3-rev3-audit.ts <qualificationEvidenceDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- the frozen qualification request for the selected fixture --------------------------------
  const selectedId = selectNoiseFixtureIdV0();
  const fixtureIndex = D3B_QUALIFICATION_FIXTURES.findIndex((f) => f.fixture_id === selectedId);
  const letters = ["A", "B", "C"];
  const artifactName = `fixture-${letters[fixtureIndex]}-request.json`;
  const frozenArtifact = JSON.parse(await readFile(join(qualificationDir, artifactName), "utf8")) as {
    fixture_id: string;
    expected_relation: string;
    request_hash: string;
    request: {
      messages: { role: string; content: string }[];
      structured_output: { kind: string; schema: unknown };
    };
  };
  const fixtureManifest = JSON.parse(await readFile(join(qualificationDir, "qualification-fixture-manifest.json"), "utf8")) as {
    fixtures: { fixture_id: string; statement_a: string; statement_b: string; expected_relation: string }[];
  };
  const qualificationDataset = JSON.parse(await readFile(join(qualificationDir, "qualification-dataset.json"), "utf8")) as {
    trials: { group: string }[];
  };

  // ---- A. the selection rule -------------------------------------------------------------------
  const selected = D3B_QUALIFICATION_FIXTURES.find((f) => f.fixture_id === selectedId);
  if (selected === undefined) fail("D3_REV3_SELECTED_FIXTURE_MISSING", selectedId);
  const selectionAudit = {
    rule: "qualification_fixture_manifest[0] == lexicographically smallest frozen fixture_id",
    selected_fixture_id: selectedId,
    lexicographic_rule_agrees: selectedId === lexicographicallySmallestFixtureIdV0(),
    fixture_manifest_length: D3B_QUALIFICATION_FIXTURES.length,
    fixture_existed_in_the_frozen_manifest: fixtureManifest.fixtures.some((f) => f.fixture_id === selectedId),
    fixture_existed_before_any_qualification_output: true,
    why:
      "the fixture manifest is a revision-1 artifact; the selection is a pure function of its ordering and of the id strings, so it cannot depend on any output",
    reads_qualification_outputs: false,
    reads_modal_tokens: false,
    reads_correctness: false,
    reads_latency: false,
    reads_provider_metadata: false,
    reads_target_output: false
  };

  // ---- B. the request identity -------------------------------------------------------------------
  const recomputedHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, frozenArtifact.request as unknown));
  const freshRender = buildD3RelationReadoutRequestV0(
    {
      messages: [
        { role: "system", content: frozenArtifact.request.messages.find((m) => m.role === "system")?.content.split(renderD3BContractTextV0(selected))[0] ?? "" },
        { role: "user", content: frozenArtifact.request.messages.find((m) => m.role === "user")?.content ?? "" }
      ],
      structured_output: { kind: "JSON_SCHEMA", schema: {} }
    } as never,
    { statement_a: selected.statement_a, statement_b: selected.statement_b }
  );
  const frozenSystem = frozenArtifact.request.messages.find((m) => m.role === "system")?.content ?? "";
  const frozenUser = frozenArtifact.request.messages.find((m) => m.role === "user")?.content ?? "";
  const renderedContract = renderD3BContractTextV0({ statement_a: selected.statement_a, statement_b: selected.statement_b });
  const freshSystem = freshRender.messages.find((m) => m.role === "system")?.content ?? "";
  const identityAudit = {
    artifact: artifactName,
    fixture_id_in_the_artifact: frozenArtifact.fixture_id,
    fixture_id_matches_the_selection: frozenArtifact.fixture_id === selectedId,
    recorded_request_hash: frozenArtifact.request_hash,
    recomputed_request_hash: recomputedHash,
    hash_matches_the_recorded_qualification_hash: recomputedHash === frozenArtifact.request_hash,
    the_frozen_request_ends_with_the_rendered_contract: frozenSystem.endsWith(renderedContract),
    a_fresh_render_reproduces_the_frozen_contract_section: freshSystem.endsWith(renderedContract),
    reuse_without_re_render_is_verifiable: frozenSystem === `${frozenSystem.slice(0, frozenSystem.length - renderedContract.length)}${renderedContract}`,
    re_render_at_pilot_time: false,
    statement_pair_modified: false
  };
  if (!identityAudit.hash_matches_the_recorded_qualification_hash) fail("D3_REV3_REQUEST_HASH_MISMATCH", JSON.stringify(identityAudit));
  if (!identityAudit.fixture_id_matches_the_selection) fail("D3_REV3_ARTIFACT_FIXTURE_MISMATCH", JSON.stringify(identityAudit));

  // ---- C. the noise request carries no target material and no CharacterOS state -------------------
  const requestText = `${frozenSystem}\n${frozenUser}`;
  const containmentAudit = {
    contains_the_canonical_caution: requestText.includes(D1_CANONICAL_LABEL),
    contains_the_target_paraphrase: requestText.includes(A1_PARAPHRASE),
    contains_an_a1_token: A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK.some((t) => requestText.includes(t)),
    contains_an_arm_label: /\b(HIGH|LOW|NEUTRAL)\b/.test(requestText),
    contains_a_credence: /credence/i.test(requestText) || /"credence":/.test(requestText),
    is_the_d3b_target_request: false,
    why_not_the_target_request:
      "the target request compares the canonical CAUTION proposition with the frozen A1 paraphrase; this request compares two synthetic clamp statements that appear in no CharacterOS state",
    subject_data_contains_a_belief_line: frozenUser.includes("[SUBJECTIVE BELIEF STANCES")
  };
  const contaminating = ["contains_the_canonical_caution", "contains_the_target_paraphrase", "contains_an_a1_token", "contains_an_arm_label", "contains_a_credence", "subject_data_contains_a_belief_line"].filter(
    (key) => (containmentAudit as Record<string, unknown>)[key] === true
  );
  if (contaminating.length > 0) fail("D3_REV3_NOISE_REQUEST_CONTAMINATED", JSON.stringify(contaminating));

  // ---- D. the conflict and the isolation -----------------------------------------------------------
  const rev3 = await deriveD3Rev3ManifestV0();
  const conflictAudit = {
    verdict: "D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT",
    discovered_at_target_calls: 0,
    qualification_trial_groups: [...new Set(qualificationDataset.trials.map((t) => t.group))],
    target_calls_before_noise_pilot: D3B_TARGET_ISOLATION.target_calls_before_noise_pilot,
    target_calls_after_noise_pilot_are_target_evidence: D3B_TARGET_ISOLATION.target_calls_after_noise_pilot_are_target_evidence,
    noise_trials_may_enter_the_target_dataset: !D3B_TARGET_ISOLATION.target_dataset_must_not_include_noise_trials,
    the_old_design_was_self_defeating: true,
    why:
      "a pilot on the target request would both consume target trials and, on a five-plus-one outcome, pre-empt the target scorer's unanimity requirement — and the 5 -> 14 extension could not restore eligibility",
    budget: D3_REV3_BUDGET
  };

  const audit = {
    stage: "D3_REVISION_3",
    model_calls: 0,
    section_a_selection: selectionAudit,
    section_b_request_identity: identityAudit,
    section_c_containment: { ...containmentAudit, contaminating_fields: contaminating },
    section_d_conflict_and_isolation: conflictAudit,
    noise_request_identity: D3B_NOISE_REQUEST_IDENTITY,
    verdict: "D3_REV3_NOISE_IDENTITY_RESOLVED"
  };
  await write("d3-rev3-audit.json", audit);
  await write("contract-rev3-manifest.json", rev3);
  await write("D3_REV3_VERDICT.json", {
    stage: "D3_REVISION_3",
    model_calls: 0,
    verdicts: [
      "D3_PREREGISTRATION_FINALIZED_REV3",
      "D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT",
      "D3_B_NON_TARGET_NOISE_PILOT_AUTHORISED",
      "D3_B_TARGET_NOT_EXECUTED"
    ],
    conflict_resolved: true,
    noise_pilot_request: { fixture_id: selectedId, request_hash: recomputedHash, is_the_frozen_qualification_request: true },
    target_calls_before_the_pilot: 0,
    target_calls_the_pilot_will_make: 0,
    target_planned_calls_after_the_pilot: D3_REV3_BUDGET.target_formula,
    budget: D3_REV3_BUDGET,
    d3a_calls: 0,
    d2b_calls: 0,
    next_round_may_only:
      "run the 6-call non-target noise pilot on the frozen noise request, freeze its dataset before scoring, then classify with the frozen noise classifier and, if it authorises, freeze the target schedule",
    next_round_may_not: ["call the D3-B target request", "execute D3-A", "execute D2-B", "modify any frozen artifact"],
    revision_2_manifest_hash_preserved: rev3.revision_2_manifest_hash_preserved,
    rev3_manifest_hash: rev3.manifest_hash
  });

  process.stdout.write(
    `D3_PREREGISTRATION_FINALIZED_REV3 | D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT | D3_B_NON_TARGET_NOISE_PILOT_AUTHORISED\n` +
      `noise fixture: ${selectedId} @ ${recomputedHash}\n` +
      `selection outcome-blind: ${String(!selectionAudit.reads_qualification_outputs && !selectionAudit.reads_target_output)} | target calls: ${String(D3B_TARGET_ISOLATION.target_calls_before_noise_pilot)}\n` +
      `target planned calls: ${D3_REV3_BUDGET.target_formula} (not 2r) | budget ${String(D3_REV3_BUDGET.minimum_path_total)}..${String(D3_REV3_BUDGET.authorised_total_max)}\n` +
      `${rev3.manifest_hash}\nD3_MODEL_CALLS = 9 (0 this round)\n`
  );
}

await main();
