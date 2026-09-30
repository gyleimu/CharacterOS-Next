/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 REVISION 1.1d MECHANICAL AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-causal-path-d2/a1-rev11d-audit.ts <outdir>
 *
 * Two things are proved mechanically rather than asserted:
 *
 *   A. the invalid policy — the audit calls the FROZEN `classifyA1NeutralPilotV0` on synthetic pilots,
 *      so it cannot pass while the shipped rule disagrees. In particular no synthetic pilot with any
 *      invalid trial may yield an r value, and six invalid trials must never produce modal_count = 6.
 *
 *   B. the context binding — the three states are rebuilt offline through the frozen production path
 *      and the resulting normalised model-facing requests are compared byte-for-byte against the
 *      A0-frozen pristine requests, so "same production context" is a measurement and not a claim.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

import { D2_HASH_PROJECTION_V0, D2A1_TOKENS } from "./contract-rev1.ts";
import {
  D2A1_NEUTRAL_PILOT_INVALID_POLICY,
  D2A1_NEUTRAL_TRIAL_IDS,
  classifyA1NeutralPilotV0,
  deriveD2Rev11dManifestV0
} from "./contract-rev1-1d-a1-neutral-and-context.ts";
import { D1_P1, D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";
import { normalizeArmSpecificBytes } from "../belief-state-sensitivity-d1/revision-3.ts";
import { D1_OBSERVATION_ID, D1_SUBJECT_ID, buildArmWorldV0, diffPathsOf } from "../belief-state-sensitivity-d1/world-a1.ts";
import { buildProjectionV0 } from "../belief-state-sensitivity-d1/state-construction.ts";

const LEVELS = ["HIGH", "LOW", "NEUTRAL"] as const;
type Level = (typeof LEVELS)[number];
const A0_FREEZE =
  "research/experiments/belief-causal-path-d2/evidence/run-001/a0-characteros-request-freeze" as const;
const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const V = "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-rev11d-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ============================ A. INVALID POLICY ==========================================
  const mk = (tokens: readonly (string | null)[]) =>
    tokens.map((token, index) => ({ trial_id: D2A1_NEUTRAL_TRIAL_IDS[index] as string, parsed_token: token }));

  const cases: { readonly name: string; readonly tokens: readonly (string | null)[]; readonly expect_r: 6 | 14 | null }[] = [
    { name: "six_identical_valid", tokens: Array.from({ length: 6 }, () => V), expect_r: 6 },
    { name: "five_identical_plus_one_other_legal", tokens: [V, V, V, V, V, "SUPPORTS_PARAPHRASED_PRINCIPLE"], expect_r: 14 },
    { name: "four_identical_plus_two_other_legal", tokens: [V, V, V, V, "SUPPORTS_PARAPHRASED_PRINCIPLE", "OPPOSES_PARAPHRASED_PRINCIPLE"], expect_r: null },
    { name: "five_identical_plus_one_transport_invalid", tokens: [V, V, V, V, V, null], expect_r: null },
    { name: "five_identical_plus_one_out_of_vocabulary", tokens: [V, V, V, V, V, "ENDORSES_STRONGLY"], expect_r: null },
    { name: "three_identical_plus_three_invalid", tokens: [V, V, V, null, null, null], expect_r: null },
    { name: "six_invalid", tokens: [null, null, null, null, null, null], expect_r: null }
  ];
  const results = cases.map((c) => {
    const outcome = classifyA1NeutralPilotV0(mk(c.tokens));
    const pass =
      c.expect_r === null
        ? outcome.r_confirm_A1 === null
        : outcome.r_confirm_A1 === c.expect_r;
    return {
      case: c.name,
      expected_r: c.expect_r,
      observed_r: outcome.r_confirm_A1,
      observed_modal_count: outcome.modal_count,
      observed_invalid_count: outcome.invalid_count,
      observed_verdict: outcome.pilot_verdict,
      observed_noise_verdict: outcome.noise_verdict,
      invalid_is_not_a_modal_category: c.tokens.includes(null) ? outcome.modal_token === null : true,
      pass
    };
  });
  const anyInvalidYieldingR = results.filter((r) => r.observed_invalid_count > 0 && r.observed_r !== null);
  const sixInvalidCase = results.find((r) => r.case === "six_invalid") as (typeof results)[number];
  const policyProved =
    results.every((r) => r.pass) && anyInvalidYieldingR.length === 0 && sixInvalidCase.observed_modal_count === null;
  if (!policyProved) fail("D2_A1_INVALID_POLICY_NOT_PROVEN", JSON.stringify(results));

  // The mapping must be structurally unreachable without six valid trials: a seventh trial is refused.
  let denominatorViolationCaught = false;
  try {
    classifyA1NeutralPilotV0(mk([...Array.from({ length: 6 }, () => V), V]));
  } catch {
    denominatorViolationCaught = true;
  }
  let duplicateIdentityCaught = false;
  try {
    classifyA1NeutralPilotV0([{ trial_id: "d2-a1-neutral-001", parsed_token: V }, ...mk(Array.from({ length: 5 }, () => V)).slice(1)]);
  } catch {
    duplicateIdentityCaught = true;
  }

  const invalidPolicyAudit = {
    policy: D2A1_NEUTRAL_PILOT_INVALID_POLICY,
    synthetic_cases: results,
    any_invalid_trial_that_yielded_an_r_value: anyInvalidYieldingR,
    six_invalid_modal_count: sixInvalidCase.observed_modal_count,
    six_invalid_verdict: sixInvalidCase.observed_verdict,
    seventh_call_refused: denominatorViolationCaught,
    duplicate_trial_identity_refused: duplicateIdentityCaught,
    frozen_procedure_was_called_not_reimplemented: true,
    verdict: policyProved ? "D2_A1_INVALID_POLICY_PROVEN" : "D2_A1_INVALID_POLICY_NOT_PROVEN"
  };
  await write("a1-invalid-policy-audit.json", invalidPolicyAudit);

  // ============================ B. CONTEXT BINDING =========================================
  const a0Manifest = JSON.parse(await readFile(join(A0_FREEZE, "state-manifest.json"), "utf8")) as Record<string, unknown>;
  const a0Provenance = a0Manifest["frozen_context_provenance"] as Record<string, unknown>;
  const a0Identity = a0Manifest["identity_parity"] as Record<string, unknown>;

  const worlds = new Map<Level, Awaited<ReturnType<typeof buildArmWorldV0>>>();
  for (const level of LEVELS) worlds.set(level, await buildArmWorldV0(level));
  const world = (level: Level): Awaited<ReturnType<typeof buildArmWorldV0>> =>
    worlds.get(level) ?? fail("D2_REV1_1D_CONTEXT_AUDIT_FAILED", `world ${level} missing`);

  const normalise = (request: ModelTransportRequestV0): string => {
    const result = normalizeArmSpecificBytes(request);
    const system = request.messages.find((m) => m.role === "system")?.content ?? "";
    return canonicalJsonString({ system, user: result.normalized_user_content });
  };

  const parity: Record<string, unknown> = {};
  let contextOk = true;
  for (const level of LEVELS) {
    const w = world(level);
    const state = w.post_observation_state as unknown as {
      identity: { subject_id: string };
      context: unknown;
    };
    const rebuiltRequest = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(await buildProjectionV0(w.post_observation_state)) }),
        Object.freeze({
          role: "user" as const,
          content: cognitionUserContentForV8(await buildProjectionV0(w.post_observation_state), {})
        })
      ]),
      structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
    }) as unknown as ModelTransportRequestV0;

    const frozen = JSON.parse(await readFile(join(A0_FREEZE, `pristine-${level.toLowerCase()}.json`), "utf8")) as {
      request: ModelTransportRequestV0;
      request_hash: string;
      system_bytes: number;
      user_bytes: number;
      state_hash: string;
    };
    const rebuiltHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, rebuiltRequest as unknown));
    const rebuiltNormalised = normalise(rebuiltRequest);
    const frozenNormalised = normalise(frozen.request);
    const contextBytes = canonicalJsonString(state.context);
    const frozenContext = (a0Manifest["frozen_context_provenance"] as Record<string, unknown>)["task"];
    void frozenContext;
    const row = {
      subject_id_matches_D1: state.identity.subject_id === D1_SUBJECT_ID,
      observation_id_matches_D1: w.observation_id === D1_OBSERVATION_ID,
      observation_id_matches_A0_manifest: (a0Identity["observation_ids"] as string[])[LEVELS.indexOf(level)] === w.observation_id,
      observation_ref_matches_A0_manifest: (a0Identity["observation_refs"] as string[])[LEVELS.indexOf(level)] === w.observation_ref,
      observation_literal_matches_D1_P1: (a0Provenance["observation_text"] as string) === D1_P1.observation_text,
      observation_id_matches_A0_provenance: (a0Provenance["observation_id"] as string) === w.observation_id,
      task_is_null_in_A0_provenance: (a0Provenance["task"] as unknown) === null,
      canonical_proposition_matches_A0_provenance: (a0Provenance["canonical_proposition_label"] as string) === D1_PROPOSITION_LABEL,
      current_context_bytes_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { context: state.context })),
      rebuilt_request_hash: rebuiltHash,
      frozen_request_hash: frozen.request_hash,
      pristine_request_reproduces_byte_for_byte: rebuiltHash === frozen.request_hash,
      system_bytes_match: (rebuiltRequest.messages[0]?.content ?? "").length === frozen.system_bytes,
      user_bytes_match: (rebuiltRequest.messages[1]?.content ?? "").length === frozen.user_bytes,
      normalised_rebuilt_equals_normalised_frozen: rebuiltNormalised === frozenNormalised,
      current_context_bytes: contextBytes.length
    };
    const ok =
      row.subject_id_matches_D1 &&
      row.observation_id_matches_D1 &&
      row.observation_id_matches_A0_manifest &&
      row.observation_ref_matches_A0_manifest &&
      row.observation_literal_matches_D1_P1 &&
      row.task_is_null_in_A0_provenance &&
      row.canonical_proposition_matches_A0_provenance &&
      row.pristine_request_reproduces_byte_for_byte &&
      row.system_bytes_match &&
      row.user_bytes_match &&
      row.normalised_rebuilt_equals_normalised_frozen;
    if (!ok) contextOk = false;
    parity[level] = { ...row, pass: ok };
  }
  // Across arms: the only surviving difference after frozen normalisation is the credence.
  const armPairs: readonly (readonly [Level, Level])[] = [["HIGH", "LOW"], ["HIGH", "NEUTRAL"], ["LOW", "NEUTRAL"]];
  const crossArm: Record<string, unknown> = {};
  for (const [a, b] of armPairs) {
    const diff = [...diffPathsOf(world(a).post_observation_state, world(b).post_observation_state)].sort();
    const normalisedA = normalise(
      JSON.parse(await readFile(join(A0_FREEZE, `pristine-${a.toLowerCase()}.json`), "utf8")).request as ModelTransportRequestV0
    );
    const normalisedB = normalise(
      JSON.parse(await readFile(join(A0_FREEZE, `pristine-${b.toLowerCase()}.json`), "utf8")).request as ModelTransportRequestV0
    );
    crossArm[`${a}_vs_${b}`] = {
      raw_state_diff_paths: diff,
      normalised_frozen_requests_identical: normalisedA === normalisedB
    };
  }
  const crossArmOk = Object.values(crossArm).every(
    (row) => (row as { normalised_frozen_requests_identical: boolean }).normalised_frozen_requests_identical === true
  );

  const contextAudit = {
    binding: (await deriveD2Rev11dManifestV0()).context_binding,
    per_arm_parity_against_the_frozen_A0_context: parity,
    cross_arm: crossArm,
    context_diff_after_frozen_normalisation: ["/beliefs/items/0/credence"],
    new_diff_classes_added: false,
    defect_noted_in_the_frozen_A0_artifact:
      "the A0 state-manifest recorded identity_parity.subject_ids as [\"undefined\",\"undefined\",\"undefined\"] because that round read `state.subject_id` instead of the real `state.identity.subject_id`. It affected no A0 result — A0's isolation was proved by diffPathsOf over the states, and subject identity came from D1_SUBJECT_ID — but the identity binding here is therefore verified against D1_SUBJECT_ID and `state.identity.subject_id`, not against that broken field.",
    verdict: contextOk && crossArmOk ? "D2_A1_CONTEXT_BINDING_PROVEN" : "D2_A1_CONTEXT_BINDING_FAILED"
  };
  if (!(contextOk && crossArmOk)) fail("D2_A1_CONTEXT_BINDING_FAILED", JSON.stringify(contextAudit));
  await write("a1-context-binding-audit.json", contextAudit);

  // ============================ MANIFEST ====================================================
  const rev11d = await deriveD2Rev11dManifestV0();
  await write("contract-rev1-1d-manifest.json", rev11d);
  const verdictHash = await write("A1_REV11D_MANIFEST.json", {
    stage: "D2_A1",
    model_calls: 0,
    amendment: {
      file: "contract-rev1-1d-a1-neutral-and-context.ts",
      version: rev11d.version,
      manifest_hash: rev11d.manifest_hash,
      supersedes_scope: rev11d.supersedes_scope,
      revision_1_1c_manifest_hash_preserved: rev11d.revision_1_1c_manifest_hash_preserved,
      scientific_prediction_changed: rev11d.scientific_prediction_changed,
      measurement_contract_changed: rev11d.measurement_contract_changed,
      a1_model_calls_before_amendment: rev11d.a1_model_calls_before_amendment,
      a1_state_experiment_calls_before_amendment: rev11d.a1_state_experiment_calls_before_amendment,
      a1_neutral_calls_before_amendment: rev11d.a1_neutral_calls_before_amendment
    },
    invalid_policy_audit: {
      verdict: invalidPolicyAudit.verdict,
      six_invalid_modal_count: invalidPolicyAudit.six_invalid_modal_count,
      any_invalid_trial_yielded_r: invalidPolicyAudit.any_invalid_trial_that_yielded_an_r_value.length > 0
    },
    context_binding_audit: { verdict: contextAudit.verdict, arms_verified: LEVELS.length, cross_arm_pairs: armPairs.length },
    frozen_token_vocabulary: D2A1_TOKENS,
    verdicts: [
      "D2_PREREGISTRATION_FINALIZED_REV1_1D",
      "D2_A1_NEUTRAL_PILOT_AUTHORISED",
      "D2_A1_STATE_CONTEXT_FROZEN",
      "D2_A1_STATE_EXPERIMENT_NOT_STARTED"
    ],
    a1_neutral_pilot_executed_this_round: false,
    d2_model_calls_total: 36
  });
  process.stdout.write(
    `${invalidPolicyAudit.verdict} | ${contextAudit.verdict}\nmanifest ${rev11d.manifest_hash}\n${verdictHash}\nD2_MODEL_CALLS = 36 (0 this round)\n`
  );
}

await main();
