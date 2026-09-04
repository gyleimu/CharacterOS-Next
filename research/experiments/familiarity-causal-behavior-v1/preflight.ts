/* eslint-disable no-restricted-imports -- Read-only assertions against frozen built public roots. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { allowedEvidenceSet, buildCognitivePromptMessages } from "../../../packages/runtime/dist/index.js";
import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { buildWorld, restoreBundle, check, equal, neutralWorld } from "./fixtures.ts";
import { observeResponse, fakeTransports, objectHash, type Observation } from "./observe.ts";
import { ALICE, BOB, CONVENTION_REF, SCENARIO, HISTORY_SCENES, ORDER, EXPERIMENT_ID, RUBRIC, NEUTRAL, type Arm } from "./contract.ts";

export function assertCognition(o: Observation, arm: Arm, empty = false) {
  const p = o.projection;
  check(p, "production projection captured");
  const expected = arm === "B" && !empty ? [CONVENTION_REF] : [];
  check(p.interaction_familiarity.find(f => f.counterpart_ref === ALICE)?.canonical_value === (arm === "A" ? 1 : 16) / 32, "exact familiarity");
  check(equal(p.interaction_familiarity_cognition_influences.map(i => [i.counterpart_ref, i.context_resolution_strategy]),
    [[ALICE, arm === "A" ? "BASIC_CONTEXT_FIRST" : "COUNTERPART_CONTEXT_SEARCH_FIRST"]]), "exact active strategy");
  check(p.context.scene === SCENARIO && equal(p.context.active_entity_refs, [ALICE]), "frozen scene and active counterpart");
  check(equal(p.memory_working_refs, []) && equal(p.recent_retrieval_refs, expected), "only expected Memory evidence");
  check(equal([...allowedEvidenceSet(p)].sort(), [ALICE, ...expected].sort()), "no added evidence authority");
  check(equal(p.allowed_actions, []), "empty action space");
  const trace = o.retrieval_trace;
  check(trace.queries.length === (arm === "A" ? 0 : 1) && trace.results.length === trace.queries.length, "exact observed query count");
  if (arm === "B") {
    check(equal(trace.queries[0], { schema_version: "memory-retrieval-query-v0", subject_id: p.subject_id,
      repository_revision: "R0", semantic_reference: ALICE,
      temporal: { now_logical_time: 0, window_start: null }, entity_refs: [ALICE], relationship_refs: [], current_context_refs: [],
      salience_constraints: { min_declared_score: null, max_candidates: 16 } }), "exact Alice query");
    check(equal(trace.results[0]?.selected_memory_refs, expected), "exact retrieval result");
  }
  if (o.cognition_stage.request) check(equal(o.cognition_stage.request.messages, buildCognitivePromptMessages(p)), "unchanged production cognition messages");
}

export function assertNoExperimentContract(o: Observation) {
  for (const stage of [o.cognition_stage, o.language_stage]) {
    if (!stage.request) continue;
    const text = JSON.stringify(stage.request);
    check(!text.includes(EXPERIMENT_ID) && !text.includes("EXPERIMENT OBSERVATION ENVELOPE") &&
      !/arm_id|trial_id|expected_class|success_threshold|evaluator|rubric/i.test(text), "host metadata absent from production prompts");
    for (const rubric of Object.keys(RUBRIC)) check(!text.includes(rubric), "no rubric class in production prompts");
  }
}

export async function assertLanguage(o: Observation, arm: Arm, empty = false) {
  assertCognition(o, arm, empty);
  const language = o.language;
  check(language && o.validated_cognition, "actual language input and validated cognition captured");
  const input = language.input;
  const expected = arm === "B" && !empty ? [CONVENTION_REF] : [];
  check(equal(input.evidence_refs, expected) && equal(input.memory_episode_contents.map(c => c.ref), expected), "lawful language evidence");
  check(input.cognition_projection_hash === o.projection?.projection_hash &&
    input.cognition_proposal_binding.current_intent === o.validated_cognition.current_intent, "actual production cognition binding");
  check(await hashEnvelope("characteros-next/runtime/language-realization-input/v1", input) === language.input_hash, "actual production input hash");
  check(o.memory_reads.length === expected.length, "production reader invoked only for lawful episode refs");
  if (expected.length) {
    check(o.memory_reads[0]?.result.ok && equal(o.memory_reads[0].result.contents, input.memory_episode_contents), "production Memory reader content reaches input");
    check(input.memory_episode_contents[0]?.scene === HISTORY_SCENES[7], "unchanged convention scene");
  } else check(!JSON.stringify(language).includes("no unnecessary apology"), "no B-only evidence in A/empty input");
  check(input.scene === SCENARIO && !Object.hasOwn(input, "reasoning_summary"), "same scene; no reasoning endpoint");
  assertNoExperimentContract(o);
}

export async function assertComplete(o: Observation, arm: Arm, empty = false) {
  await assertLanguage(o, arm, empty);
  check(o.entry === "ConversationTextResponseExecutorV0.execute" && o.validity === "VALID_BEHAVIOR" &&
    o.result?.kind === "OUTPUT_READY" && o.canonical_unchanged, "unchanged canonical state and deliverable behavior");
  check(o.cognition_stage.calls === 1 && o.language_stage.calls === 1, "one call per production stage");
  check(o.result.behavior.text === o.validated_draft?.text && o.result.behavior.input_hash === o.language?.input_hash, "validated artifact endpoint binding");
}

export const preview = (world: Parameters<typeof observeResponse>[0], empty = false) => observeResponse(world, fakeTransports(), { empty });

/** A real cognition result may change current_intent; every other language field
 * is fixed by history/evidence. Never compare real intent to the fake response. */
export function fixedLanguage(input: NonNullable<Observation["language"]>["input"]) {
  return { ...input, cognition_proposal_binding: { ...input.cognition_proposal_binding, current_intent: null } };
}
export async function assertActual(o: Observation, expected: Observation, arm: Arm, stage: "cognition" | "language") {
  assertCognition(o, arm);
  check(equal(o.projection, expected.projection) && equal(o.retrieval_trace, expected.retrieval_trace) && equal(o.source, expected.source), "actual host treatment equals preregistration");
  if (stage === "language") {
    await assertLanguage(o, arm);
    check(o.language && expected.language && equal(fixedLanguage(o.language.input), fixedLanguage(expected.language.input)), "actual language controlled fields match freeze");
    check(equal(o.memory_reads, expected.memory_reads), "actual reader results match frozen evidence");
  }
  assertNoExperimentContract(o);
}

export async function preflight() {
  const worlds = { A: await buildWorld(1), B: await buildWorld(16) };
  check(equal(worlds.A.genesis, worlds.B.genesis), "identical initial subject fixture");
  for (const w of Object.values(worlds)) {
    for (const key of Object.keys(w.genesis) as (keyof typeof w.genesis)[]) {
      if (!["relationships", "trace_window", "runtime_metadata"].includes(key)) check(equal(w.genesis[key], w.snapshot[key]), `unrelated state unchanged: ${key}`);
    }
  }
  const restore = { A: await restoreBundle(worlds.A), B: await restoreBundle(worlds.B) };
  const arms = { A: await preview(worlds.A), B: await preview(worlds.B) };
  await assertComplete(arms.A, "A"); await assertComplete(arms.B, "B");
  check(arms.A.projection && arms.B.projection && arms.A.language && arms.B.language, "both stage inputs");
  const projectionDifferences = Object.keys(arms.A.projection).filter(k => !equal(arms.A.projection?.[k as keyof typeof arms.A.projection], arms.B.projection?.[k as keyof typeof arms.B.projection]));
  check(equal(projectionDifferences.sort(), ["state_revision", "interaction_familiarity", "interaction_familiarity_cognition_influences", "recent_retrieval_refs", "projection_hash"].sort()), "only frozen downstream cognition differences");
  const a = arms.A.language.input, b = arms.B.language.input;
  const languageDifferences = Object.keys(a).filter(k => !equal(a[k as keyof typeof a], b[k as keyof typeof b]));
  check(equal(languageDifferences.sort(), ["source_revision", "cognition_projection_hash", "cognition_proposal_binding", "interaction_familiarity", "interaction_familiarity_cognition_influences", "evidence_refs", "memory_episode_contents"].sort()), "only downstream language differences");
  check(arms.A.cognition_stage.request?.messages[0]?.content === arms.B.cognition_stage.request?.messages[0]?.content &&
    arms.A.language_stage.request?.messages[0]?.content === arms.B.language_stage.request?.messages[0]?.content, "same production system contracts");
  const repeats = [];
  for (const item of ORDER) {
    const again = await preview(await buildWorld(item.arm === "A" ? 1 : 16));
    await assertComplete(again, item.arm);
    check(equal(again, arms[item.arm]), "same-state reconstruction exact observer/input/behavior equality");
    repeats.push({ ...item, host_valid: true, cognition_request_hash: again.cognition_stage.request_hash, language_input_hash: again.language?.input_hash });
  }
  const bob = await preview(await buildWorld(1, 16));
  await assertComplete(bob, "A");
  check(bob.projection?.interaction_familiarity.find(f => f.counterpart_ref === BOB)?.canonical_value === 16 / 32, "real high-Bob history");
  check(equal(bob.projection.interaction_familiarity_cognition_influences, arms.A.projection.interaction_familiarity_cognition_influences), "Bob cannot set Alice strategy");
  const empty = await preview(await buildWorld(16), true);
  await assertComplete(empty, "B", true);
  const freshRestore: Partial<Record<Arm, Observation>> = {};
  for (const arm of ["A", "B"] as const) {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL("./restore-worker.ts", import.meta.url))], {
      input: JSON.stringify(restore[arm]), encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024, windowsHide: true
    });
    check(child.status === 0, `fresh authoritative restore: ${child.stderr || child.error?.message || ""}`);
    const restored = JSON.parse(child.stdout) as Observation;
    await assertComplete(restored, arm);
    // Restored assembly has no in-process commit history; persisted canonical head
    // is supplied by the worker from the validated bundle, not recomputed history.
    check(equal(restored, arms[arm]), "fresh restore preserves exact production path");
    freshRestore[arm] = restored;
  }
  const neutral = await observeResponse(await neutralWorld(), fakeTransports(), { requestId: NEUTRAL.response_request_id });
  check(neutral.validity === "VALID_BEHAVIOR" && neutral.cognition_stage.calls === 1 && neutral.language_stage.calls === 1, "neutral production fixture works offline");
  return { status: "PASS" as const, real_model_calls: 0, arms, repeats,
    accounting: { controlled_projection_fields: Object.keys(arms.A.projection).filter(k => !projectionDifferences.includes(k)),
      downstream_projection_differences: projectionDifferences, downstream_language_differences: languageDifferences,
      real_cognition_current_intent: "May additionally differ downstream of actual cognition; never fixed to fake intent.",
      provider_inputs_byte_identical: false, deterministic_fake_output_is_behavioral_evidence: false },
    controls: { same_state: "PASS", wrong_counterpart: bob, empty_retrieval: empty },
    fresh_restore: freshRestore, restore_bundles: restore, neutral_fixture: neutral };
}
export type Preflight = Awaited<ReturnType<typeof preflight>>;
export const preflightHash = (p: Preflight) => objectHash(p);
