/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C0a INSTRUMENT QUALIFICATION — exactly 9 calls, state-blind synthetic fixtures.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-cross-expression-d4/d4c0a-qualification.ts <evidenceDir> <outdir>
 *
 * Order: forbidden-substring re-audit -> offline conformance with a MUTATION FALSIFIABILITY test for every
 * identity check -> SUPPORT/OPPOSE isolation audit -> freeze implementation identities -> 9 calls ->
 * freeze the dataset -> score with the frozen qualification scorer.
 *
 * NO target call, NO noise call, NO C0b: this round executes qualification only.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ANCHORS,
  D4C0A_ARMS,
  D4C0A_BASE_SYSTEM_TEXT,
  D4C0A_CONTRACT_TEXT,
  D4C0A_FORBIDDEN_SUBSTRINGS,
  D4C0A_JSON_SCHEMA,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_QUALIFICATION_RULE,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0,
  normaliseD4C0ARequestV0,
  renderD4C0ABindingBlockV0,
  type D4C0AArmV0,
  type D4C0ABindingV0
} from "./contract.ts";
import { D4C0A_TRANSFORMER_CONTRACT, deriveD4Rev2ManifestV0 } from "./contract-rev2-transformer.ts";
import {
  D4C0A_CONTRACT_OPENING_LINE,
  buildD4C0ABaseRequestV0,
  buildD4C0AStanceTransferRequestV0
} from "./transformer-d4c0a.ts";
import { scoreD4C0AQualificationV0, type D4C0AQualificationTrialV0 } from "./scorers-d4c0a.ts";
import { scoreD4C0ARev1V0 } from "./contract-rev1-directional-majority.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const TRANSFORMER_SOURCE = "research/experiments/belief-cross-expression-d4/transformer-d4c0a.ts";
const SCORERS_SOURCE = "research/experiments/belief-cross-expression-d4/scorers-d4c0a.ts";
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface ConformanceInputs {
  readonly request: ModelTransportRequestV0;
  readonly expectedBinding: D4C0ABindingV0;
}

/** Every identity check the frozen transformer contract implies, evaluated against one request. */
function conformanceChecks(input: ConformanceInputs): Record<string, boolean> {
  const system = input.request.messages[0]?.content ?? "";
  const user = input.request.messages[1]?.content ?? "";
  const whole = `${system}\n${user}`;
  return {
    frozen_schema_exact: canonicalJsonString(input.request.structured_output?.schema ?? {}) === canonicalJsonString(D4C0A_JSON_SCHEMA),
    anchors_exact: Object.values(D4C0A_ANCHORS).every((a) => system.includes(a)),
    contract_text_exact: countOf(system, D4C0A_CONTRACT_TEXT) === 1,
    output_vocabulary_exact: D4C0A_TOKENS.every((t) => countOf(system, t) >= 1) && !/SUPPORTS_PARAPHRASED|ENDORSES_|DOUBTS_/.test(whole),
    contract_rendered_exactly_once: countOf(system, D4C0A_CONTRACT_OPENING_LINE) === 1,
    stance_input_rendered_exactly_once: countOf(user, "SUBJECT STANCE TOWARD A: ") === 1,
    statement_a_rendered_exactly_once: countOf(user, `PROPOSITION A: ${input.expectedBinding.proposition_a}`) === 1,
    statement_b_rendered_exactly_once: countOf(user, `PROPOSITION B: ${input.expectedBinding.proposition_b}`) === 1,
    semantic_relation_rendered_exactly_once: countOf(user, `RELATION(A,B): ${input.expectedBinding.relation}`) === 1,
    no_expected_output_token_leakage: !user.includes("SUPPORTS_B") && !user.includes("OPPOSES_B") && !user.includes("UNCERTAIN_B"),
    no_treatment_arm_label_leakage: !/ARM_SUPPORT|ARM_OPPOSE/.test(whole),
    no_request_hash_leakage: !/sha256:/.test(whole),
    no_replicate_ordinal: !/\breplicate\b|\bordinal\b/i.test(whole),
    no_schedule_information: !/\bschedule\b|TARGET-00|D4C0A-QF-/.test(whole),
    system_is_the_frozen_base_plus_the_contract: system === `${D4C0A_BASE_SYSTEM_TEXT}${D4C0A_CONTRACT_TEXT}`
  };
}

/** The mutation that each check must be able to fail on, so no check is a tautology. */
function runMutationFalsifiability(input: ConformanceInputs): Record<string, { mutated_check_false: boolean; note: string }> {
  const withSystem = (system: string): ModelTransportRequestV0 =>
    Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: system }),
        Object.freeze({ role: "user" as const, content: input.request.messages[1]?.content ?? "" })
      ]),
      structured_output: input.request.structured_output
    }) as unknown as ModelTransportRequestV0;
  const system = input.request.messages[0]?.content ?? "";
  const user = input.request.messages[1]?.content ?? "";
  const withUser = (content: string): ModelTransportRequestV0 =>
    Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: system }),
        Object.freeze({ role: "user" as const, content })
      ]),
      structured_output: input.request.structured_output
    }) as unknown as ModelTransportRequestV0;
  const baseline = conformanceChecks(input);
  const mutated: Record<string, { mutated_check_false: boolean; note: string }> = {};
  const record = (check: string, request: ModelTransportRequestV0, note: string) => {
    const result = conformanceChecks({ request, expectedBinding: input.expectedBinding });
    mutated[check] = { mutated_check_false: result[check] === false, note };
  };

  record("frozen_schema_exact", { ...input.request, structured_output: { kind: "JSON_SCHEMA", schema: {} } } as never, "schema replaced by an empty one");
  record("anchors_exact", withSystem(system.replace(D4C0A_ANCHORS.SUPPORTS_B, "…")), "one anchor's meaning removed");
  record("contract_text_exact", withSystem(system.replace(D4C0A_CONTRACT_TEXT, "")), "contract text removed");
  record("output_vocabulary_exact", withSystem(system.replaceAll("OPPOSES_B", "OPPOSES_PARAPHRASED_PRINCIPLE")), "every occurrence of one token replaced by an A1 token");
  record("contract_rendered_exactly_once", withSystem(`${system}\n${D4C0A_CONTRACT_TEXT}`), "the contract text appended a second time");
  record("stance_input_rendered_exactly_once", withUser(`${user}\nSUBJECT STANCE TOWARD A: SUPPORTS`), "the stance line duplicated");
  record("statement_a_rendered_exactly_once", withUser(user.replace("PROPOSITION A: ", "PROPOSITION A(?) : ")), "the statement A line reworded");
  record("statement_b_rendered_exactly_once", withUser(user.replace("PROPOSITION B: ", "PROPOSITION B(?) : ")), "the statement B line reworded");
  record("semantic_relation_rendered_exactly_once", withUser(user.replace("RELATION(A,B): ", "RELATION(A,B)(?) : ")), "the relation line reworded");
  record("no_expected_output_token_leakage", withUser(`${user}\nSUPPORTS_B`), "the expected token appended to the user content");
  record("no_treatment_arm_label_leakage", withUser(`${user}\nARM_SUPPORT`), "an arm label appended");
  record("no_request_hash_leakage", withUser(`${user}\n# sha256:deadbeef`), "a hash-shaped string appended");
  record("no_replicate_ordinal", withUser(`${user}\nreplicate ordinal 3`), "a replicate ordinal appended");
  record("no_schedule_information", withUser(`${user}\nTARGET-001`), "a schedule identity appended");
  record("system_is_the_frozen_base_plus_the_contract", withSystem(`${system} `), "a single trailing byte added to the system message");

  const unfalsifiable = Object.entries(mutated).filter(([, v]) => !v.mutated_check_false).map(([k]) => k);
  if (unfalsifiable.length > 0) fail("D4_C0A_CHECK_NOT_FALSIFIABLE", JSON.stringify(unfalsifiable));
  const allBaselineTrue = Object.values(baseline).every((v) => v === true);
  if (!allBaselineTrue) fail("D4_C0A_CONFORMANCE_FAILED", JSON.stringify(baseline));
  return mutated;
}

function parseD4C0A(content: string): { ok: true; token: string } | { ok: false; reason: string } {
  if (content.trim().length === 0) return { ok: false, reason: "empty output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, reason: `malformed output: ${(error as Error).message.slice(0, 40)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "output is not a JSON object" };
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["d4_c0a_schema_version", "stance_toward_b", "explanation"].includes(key)) return { ok: false, reason: `unknown member: ${key}` };
  }
  if (record["d4_c0a_schema_version"] !== "d4-c0a-stance-transfer-readout-v0") return { ok: false, reason: "schema version mismatch" };
  const token = record["stance_toward_b"];
  if (typeof token !== "string") return { ok: false, reason: "stance_toward_b is not a string" };
  if (!(D4C0A_TOKENS as readonly string[]).includes(token)) return { ok: false, reason: "token outside the frozen D4-C0a vocabulary" };
  return { ok: true, token };
}

async function main(): Promise<void> {
  const evidenceDir = process.argv[2];
  const outdir = process.argv[3];
  if (evidenceDir === undefined || outdir === undefined) fail("D4_C0A_USAGE", "usage: <evidenceDir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1/2. forbidden-substring re-audit on the frozen request material --------------------------
  const allBindings: D4C0ABindingV0[] = [
    D4C0A_ARMS.ARM_SUPPORT.binding,
    D4C0A_ARMS.ARM_OPPOSE.binding,
    ...D4C0A_QUALIFICATION_FIXTURES.map((f) => f.binding)
  ];
  const material = [D4C0A_BASE_SYSTEM_TEXT, D4C0A_CONTRACT_TEXT, ...allBindings.map((b) => renderD4C0ABindingBlockV0(b))].join("\n");
  const forbiddenHits = D4C0A_FORBIDDEN_SUBSTRINGS.filter((s) => material.includes(s));
  const stateBlindness = {
    forbidden_substrings_checked: D4C0A_FORBIDDEN_SUBSTRINGS,
    hits: forbiddenHits,
    material_covers: { base: 1, contract: 1, target_arms: 2, qualification_fixtures: D4C0A_QUALIFICATION_FIXTURES.length },
    state_blind: forbiddenHits.length === 0,
    verdict: forbiddenHits.length === 0 ? "D4_C0A_REQUEST_MATERIAL_IS_STATE_BLIND" : "D4_C0A_REQUEST_MATERIAL_NOT_STATE_BLIND"
  };
  if (forbiddenHits.length > 0) fail("D4_C0A_REQUEST_MATERIAL_NOT_STATE_BLIND", JSON.stringify(forbiddenHits));
  await write("state-blindness-report.json", stateBlindness);

  // ---- 3. transformer conformance + mutation falsifiability --------------------------------------
  const firstFixture = D4C0A_QUALIFICATION_FIXTURES[0] as { fixture_id: string; binding: D4C0ABindingV0 };
  const probeBase = buildD4C0ABaseRequestV0(firstFixture.binding);
  const probeRequest = buildD4C0AStanceTransferRequestV0(probeBase);
  const baseline = conformanceChecks({ request: probeRequest, expectedBinding: firstFixture.binding });
  const mutation = runMutationFalsifiability({ request: probeRequest, expectedBinding: firstFixture.binding });
  const failClosed: Record<string, boolean> = {};
  const attempt = (id: string, fn: () => unknown) => {
    try {
      fn();
      failClosed[id] = false;
    } catch {
      failClosed[id] = true;
    }
  };
  attempt("teacher_on_transformer", () => buildD4C0AStanceTransferRequestV0(probeRequest));
  attempt("already_transformed_schema", () =>
    buildD4C0AStanceTransferRequestV0({
      ...probeBase,
      structured_output: { kind: "JSON_SCHEMA", schema: D4C0A_JSON_SCHEMA }
    } as never)
  );
  attempt("wrong_message_count", () =>
    buildD4C0AStanceTransferRequestV0({ ...probeBase, messages: [probeBase.messages[0]] } as never)
  );
  attempt("non_frozen_system_text", () =>
    buildD4C0AStanceTransferRequestV0({
      ...probeBase,
      messages: [{ role: "system", content: "you are helpful" }, probeBase.messages[1]]
    } as never)
  );
  attempt("missing_binding_line", () =>
    buildD4C0AStanceTransferRequestV0({
      ...probeBase,
      messages: [probeBase.messages[0], { role: "user", content: "PROPOSITION A: x" }]
    } as never)
  );
  attempt("foreign_contract_present", () =>
    buildD4C0AStanceTransferRequestV0({
      ...probeBase,
      messages: [{ role: "system", content: `${D4C0A_BASE_SYSTEM_TEXT}\nDECISION PROBE SEMANTIC READOUT CONTRACT` }, probeBase.messages[1]]
    } as never)
  );
  if (Object.values(failClosed).some((v) => v !== true)) fail("D4_C0A_FAIL_CLOSED_NOT_EXERCISED", JSON.stringify(failClosed));
  await write("transformer-conformance-report.json", {
    transformer: D4C0A_TRANSFORMER_CONTRACT.name,
    baseline_checks_all_true: true,
    baseline,
    fail_closed_exercised: failClosed,
    verdict: "D4_C0A_TRANSFORMER_CONFORMANT"
  });
  await write("mutation-falsifiability-audit.json", {
    method: "each identity check was re-evaluated on a deliberately mutated request; a check that could not be made false would be a tautology",
    checks_audited: Object.keys(mutation).length,
    mutations: mutation,
    every_check_was_falsifiable: true,
    verdict: "D4_C0A_IDENTITY_CHECKS_ARE_FALSIFIABLE"
  });

  // ---- 4. SUPPORT / OPPOSE isolation (offline; neither request is called this round) ------------
  const supportRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_SUPPORT.binding));
  const opposeRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_OPPOSE.binding));
  const supportSystem = supportRequest.messages[0]?.content ?? "";
  const opposeSystem = opposeRequest.messages[0]?.content ?? "";
  const supportUser = supportRequest.messages[1]?.content ?? "";
  const opposeUser = opposeRequest.messages[1]?.content ?? "";
  const differing = supportUser
    .split("\n")
    .map((line, index) => ({ index, support: line, oppose: opposeUser.split("\n")[index] ?? null }))
    .filter((row) => row.support !== row.oppose);
  const supportNorm = normaliseD4C0ARequestV0(supportUser);
  const opposeNorm = normaliseD4C0ARequestV0(opposeUser);
  const isolation = {
    system_messages_identical: supportSystem === opposeSystem,
    differing_user_line_count: differing.length,
    differing_lines: differing,
    support_occurrences: countOf(supportUser, "SUBJECT STANCE TOWARD A: SUPPORTS"),
    oppose_occurrences: countOf(opposeUser, "SUBJECT STANCE TOWARD A: OPPOSES"),
    normalisation_replacements: [supportNorm.replacements, opposeNorm.replacements],
    byte_identical_after_the_frozen_normalisation: supportNorm.normalised === opposeNorm.normalised,
    forbidden_leakage_count: differing.filter((d) => !d.support.startsWith("SUBJECT STANCE TOWARD A: ")).length,
    target_calls_this_round: 0,
    verdict: "D4_C0A_SUPPORT_OPPOSE_ISOLATION_HOLDS"
  };
  if (!isolation.system_messages_identical || differing.length !== 1 || !isolation.byte_identical_after_the_frozen_normalisation || isolation.forbidden_leakage_count !== 0) {
    fail("D4_C0A_SUPPORT_OPPOSE_ISOLATION_FAILED", JSON.stringify(isolation));
  }
  await write("support-oppose-isolation-audit.json", isolation);

  // ---- 14. frozen target scorer regression (offline, unchanged) ---------------------------------
  const six = (token: string) => Array.from({ length: 6 }, () => token);
  const mkTarget = (support: readonly (string | null)[], oppose: readonly (string | null)[]) => [
    ...support.map((token, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as D4C0AArmV0, parsed_token: token })),
    ...oppose.map((token, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as D4C0AArmV0, parsed_token: token }))
  ];
  const targetCases: { readonly id: string; readonly support: readonly (string | null)[]; readonly oppose: readonly (string | null)[]; readonly expect: string }[] = [
    { id: "perfect_polar_transfer", support: six("SUPPORTS_B"), oppose: six("OPPOSES_B"), expect: "POSITIVE" },
    { id: "five_one_each", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B"], oppose: ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B"], expect: "POSITIVE" },
    { id: "four_two_each", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"], oppose: ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B", "SUPPORTS_B"], expect: "POSITIVE" },
    { id: "three_two_one_predicted_plurality", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "OPPOSES_B"], oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "three_three_tie", support: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B"], oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "constant_support", support: six("SUPPORTS_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "constant_oppose", support: six("OPPOSES_B"), oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "reverse_direction", support: six("OPPOSES_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "one_arm_correct_only", support: six("SUPPORTS_B"), oppose: six("UNCERTAIN_B"), expect: "NULL" },
    { id: "one_invalid", support: [...six("SUPPORTS_B").slice(0, 5), null], oppose: six("OPPOSES_B"), expect: "INCONCLUSIVE" }
  ];
  const targetRows = targetCases.map((c) => {
    const outcome = scoreD4C0ARev1V0({ trials: mkTarget(c.support, c.oppose), r_per_arm: 6 });
    return { case: c.id, expected: c.expect, observed: outcome.outcome_class, predicted_count: outcome.arm_predicted_counts?.ARM_SUPPORT ?? null, meets: outcome.arm_meets_directional_majority?.ARM_SUPPORT ?? null, pass: outcome.outcome_class === c.expect };
  });
  const integrityRow = scoreD4C0ARev1V0({ trials: mkTarget(six("SUPPORTS_B"), six("OPPOSES_B").slice(0, 5)), r_per_arm: 6 });
  if (targetRows.some((r) => !r.pass) || integrityRow.outcome_class !== "INCONCLUSIVE") fail("D4_C0A_TARGET_SCORER_REGRESSION_FAILED", JSON.stringify({ targetRows, integrity: integrityRow.outcome_class }));
  await write("frozen-target-scorer-regression-audit.json", {
    scorer: "scoreD4C0ARev1V0 (frozen revision 1) — called, not re-implemented",
    cases: targetRows,
    integrity_failure_case: integrityRow.outcome_class,
    predicted_count_actually_participates_in_the_positive_predicate:
      (targetRows.find((r) => r.case === "three_two_one_predicted_plurality") as { meets: boolean | null }).meets === false,
    note: "the 3-2-1 row is the one that shows the >= 4 requirement is enforced by the predicate and not merely described in prose",
    verdict: "D4_C0A_TARGET_SCORER_UNCHANGED_AND_ENFORCING"
  });

  // ---- 5. freeze implementation identities BEFORE the first call ---------------------------------
  const sourceHash = async (path: string) => String(await hashEnvelope(D4_HASH_PROJECTION_V0, { source: await readFile(path, "utf8") }));
  const rev2 = await deriveD4Rev2ManifestV0();
  const implementationManifest = {
    transformer: D4C0A_TRANSFORMER_CONTRACT.name,
    transformer_source_hash: await sourceHash(TRANSFORMER_SOURCE),
    transformer_contract_name: D4C0A_TRANSFORMER_CONTRACT.name,
    transformer_contract_hash: rev2.manifest_hash,
    frozen_base_system_text_hash: rev2.frozen_base_system_text_hash,
    frozen_contract_text_hash: rev2.frozen_contract_text_hash,
    schema_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { schema: D4C0A_JSON_SCHEMA })),
    anchors_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { anchors: D4C0A_ANCHORS })),
    vocabulary_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { tokens: D4C0A_TOKENS })),
    qualification_scorer_source_hash: await sourceHash(SCORERS_SOURCE),
    target_scorer_source_hash: "unchanged from revision 1: contract-rev1-directional-majority.ts",
    noise_stability_classifier_source_hash: "NOT YET IMPLEMENTED — the noise round's first offline step",
    qualification_outputs_seen_before_implementation_freeze: false,
    target_outputs_seen_before_implementation_freeze: false,
    implementation_frozen: true,
    rule_if_a_bug_is_found: "stop the whole qualification; a fixed implementation may not continue the remaining calls"
  };
  await write("implementation-manifest.json", implementationManifest);

  // ---- 6/8. fixtures and requests, built once ----------------------------------------------------
  await write("qualification-fixture-manifest.json", {
    source: "contract.ts (revision 0, unchanged since)",
    rewritten_at_runtime: false,
    fixtures: D4C0A_QUALIFICATION_FIXTURES,
    expected_token_map: Object.fromEntries(D4C0A_QUALIFICATION_FIXTURES.map((f) => [f.fixture_id, f.expected_token])),
    qualification_rule: D4C0A_QUALIFICATION_RULE,
    covers_all_three_tokens: new Set(D4C0A_QUALIFICATION_FIXTURES.map((f) => f.expected_token)).size === D4C0A_TOKENS.length
  });
  const requests = new Map<string, ModelTransportRequestV0>();
  const requestManifest: Record<string, unknown> = {};
  for (const [index, fixture] of D4C0A_QUALIFICATION_FIXTURES.entries()) {
    const request = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(fixture.binding));
    const hash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    requests.set(fixture.fixture_id, request);
    requestManifest[["A", "B", "C"][index] as string] = { fixture_id: fixture.fixture_id, expected_token: fixture.expected_token, request_hash: hash };
    await write(`qualification-request-${["A", "B", "C"][index] as string}.json`, { fixture_id: fixture.fixture_id, expected_token: fixture.expected_token, request_hash: hash, request });
  }
  await write("qualification-request-manifest.json", {
    ...requestManifest,
    built_once_per_fixture: true,
    replicates_reuse_the_same_bytes: true,
    replicate_ordinal_in_the_request: false,
    planned_calls: D4C0A_QUALIFICATION_RULE.planned_calls
  });

  // ---- 10. execute qualification only ------------------------------------------------------------
  if (process.env["D4C0A_CONFORMANCE_ONLY"] === "1") {
    process.stdout.write("D4C0A_CONFORMANCE_ONLY: offline gates passed, 0 model calls, stopping before the executor.\n");
    return;
  }
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) fail("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const generationSettings = Object.freeze({ temperature: 0, max_output_tokens: 256, provider_thinking: "disabled", timeout_ms: 120_000, endpoint });
  const transport = new OpenAiCompatibleTransportV0({
    base_url: endpoint,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: 0,
    max_output_tokens: 256,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;
  const executor = { provider: "DeepSeek", model, ...generationSettings };

  const trials: Record<string, unknown>[] = [];
  let ordinal = 0;
  for (const fixture of D4C0A_QUALIFICATION_FIXTURES) {
    const request = requests.get(fixture.fixture_id) as ModelTransportRequestV0;
    const requestHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    for (let replicate = 1; replicate <= D4C0A_QUALIFICATION_RULE.replicates_per_fixture; replicate += 1) {
      ordinal += 1;
      process.stdout.write(`[${String(ordinal)}/9] ${fixture.fixture_id} r=${String(replicate)} ... `);
      const started = Date.now();
      let content: string | null = null;
      let failure: string | null = null;
      try {
        content = (await transport.complete(request)).content;
      } catch (error) {
        failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
      const latency = Date.now() - started;
      const parsed = failure === null ? parseD4C0A(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
      const trial = {
        trial_id: `d4c0a-qf-${String(ordinal).padStart(3, "0")}`,
        fixture_id: fixture.fixture_id,
        replicate_ordinal: replicate,
        request_hash: requestHash,
        expected_token: fixture.expected_token,
        raw_response: content,
        parsed_token: parsed.ok ? parsed.token : null,
        parser_status: parsed.ok ? "VALID" : "INVALID",
        transport_status: failure === null ? "OK" : "FAILED",
        invalid_reason: parsed.ok ? null : parsed.reason,
        executor,
        generation_settings: generationSettings,
        latency_ms: latency
      };
      trials.push(trial);
      await write(`trial-${String(ordinal).padStart(3, "0")}.json`, trial);
      process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
    }
  }

  // ---- 11. freeze the dataset BEFORE scoring ------------------------------------------------------
  const planned = D4C0A_QUALIFICATION_FIXTURES.length * D4C0A_QUALIFICATION_RULE.replicates_per_fixture;
  const datasetDoc = {
    stage: "D4_C0A_INSTRUMENT_QUALIFICATION",
    uses_characteros_canonical_state: false,
    contains_treatment: false,
    planned,
    observed: trials.length,
    scored: false,
    trials
  };
  await writeFile(join(outdir, "qualification-dataset.json"), `${JSON.stringify(datasetDoc, null, 2)}\n`, "utf8");
  const datasetContent = await readFile(join(outdir, "qualification-dataset.json"), "utf8");
  const datasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "qualification-dataset.json", content: datasetContent }));
  const collection = {
    planned,
    records: trials.length,
    duplicate_trial_ids: trials.length - new Set(trials.map((t) => t.trial_id)).size,
    fixture_identities_exact: D4C0A_QUALIFICATION_FIXTURES.every((f) => trials.filter((t) => t.fixture_id === f.fixture_id).length === D4C0A_QUALIFICATION_RULE.replicates_per_fixture),
    request_hashes_exact: trials.every((t) => (requestManifest[["A", "B", "C"][D4C0A_QUALIFICATION_FIXTURES.findIndex((f) => f.fixture_id === t.fixture_id)] as string] as { request_hash: string }).request_hash === t.request_hash),
    invalid_trials: trials.filter((t) => t.parsed_token === null).length,
    transport_failures: trials.filter((t) => t.transport_status !== "OK").length
  };
  if (collection.records !== planned || collection.duplicate_trial_ids !== 0 || !collection.fixture_identities_exact || !collection.request_hashes_exact) {
    fail("D4_C0A_QUALIFICATION_COLLECTION_INCOMPLETE", JSON.stringify(collection));
  }
  await write("collection-integrity-report.json", collection);
  await write("qualification-dataset-hash.json", { D4_C0A_QUALIFICATION_DATASET_SHA256: datasetHash, frozen_before_scoring: true, planned, observed: trials.length });

  // ---- 12/13. the frozen qualification scorer, over the frozen bytes ------------------------------
  const frozen = JSON.parse(await readFile(join(outdir, "qualification-dataset.json"), "utf8")) as { trials: { trial_id: string; fixture_id: string; parsed_token: string | null }[] };
  const records: D4C0AQualificationTrialV0[] = frozen.trials.map((t) => ({ trial_id: t.trial_id, fixture_id: t.fixture_id, parsed_token: t.parsed_token }));
  const outcome = scoreD4C0AQualificationV0(records);
  await write("qualification-scorer-output.json", {
    scorer: "scoreD4C0AQualificationV0 (frozen) — called, not re-implemented",
    input_was_the_frozen_dataset: true,
    output: outcome
  });
  const qualified = outcome.instrument_verdict === "D4_C0A_INSTRUMENT_QUALIFIED";
  await write("D4_C0A_QUALIFICATION_MANIFEST.json", {
    stage: "D4_C0a",
    final_states: qualified
      ? ["D4_C0A_INSTRUMENT_QUALIFIED", "D4_C0A_NOISE_STABILITY_IMPLEMENTATION_AUTHORISED", "D4_C0A_TARGET_NOT_EXECUTED", "D4_C0B_NOT_PREREGISTERED", "LINK_4_REMAINS_LOCKED", "CHARACTEROS_UNMODIFIED"]
      : ["D4_C0A_INSTRUMENT_UNQUALIFIED", "D4_C0A_EXECUTION_STOPPED_AT_QUALIFICATION", "D4_C0A_TARGET_NOT_EXECUTED", "CHARACTEROS_UNMODIFIED"],
    instrument_verdict: outcome.instrument_verdict,
    invalid_trials: outcome.invalid_trials,
    invalid_rule_triggered: outcome.invalid_rule_triggered,
    dataset_hash: datasetHash,
    collection,
    implementation_manifest: implementationManifest,
    model_calls_this_round: 9,
    d4_model_calls_total: 9,
    target_calls_this_round: 0,
    noise_calls_this_round: 0,
    executor,
    forbidden_interpretation_on_failure:
      "a qualification failure is an instrument failure; it is NOT evidence that executor composition failed, because the composition target has not been executed",
    claim_scope_unchanged: "PREREGISTERED POLAR STANCE COMPOSITION remains the future target claim; qualification produces no scientific claim at all",
    establishes:
      "only that the frozen measurement contract can report an explicitly given stance using its pre-registered three-token vocabulary on state-blind synthetic fixtures",
    does_not_establish: ["cross-expression composition", "treatment sensitivity", "any CharacterOS claim"]
  });

  process.stdout.write(`\n${qualified ? "D4_C0A_INSTRUMENT_QUALIFIED" : "D4_C0A_INSTRUMENT_UNQUALIFIED"}\nD4_MODEL_CALLS_THIS_ROUND = 9\n`);
}

await main();
