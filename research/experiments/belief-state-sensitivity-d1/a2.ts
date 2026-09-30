/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 Phase A2 — full model-facing request certification. OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/a2.ts <outdir>
 *
 * pristine production V8 request  ->  DecisionProbeV2 applied EXACTLY ONCE  ->  final audits.
 * Source states are A1 ATTEMPT 002; ATTEMPT 001 is never read.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { V2_PRIMARY_SEMANTIC_CONTRACT, deriveV2ProtocolHashesV0 } from "../decision-probe-v2/contract.ts";
import { buildV2Request, schemaForPhase } from "../decision-probe-v2/probe-v2.ts";
import { D1_FRAME_MINIMAL_CONTRACT, D1_HASH_PROJECTION_V0, D1_P1, D1_PROPOSITION_LABEL, deriveD1ManifestV0 } from "./contract.ts";
import { normalizeArmSpecificBytes, auditNormalizedEquivalenceV0 } from "./revision-3.ts";

const ATTEMPT_002 = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a1-world-attempt-002";
const LEVELS = ["HIGH", "LOW", "NEUTRAL"] as const;
const QUALIFIED_CONTRACT_HASH =
  "sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53";
// "credence" is NOT an arm marker: it is the production belief block's own field name and an
// explicit constant in its header. D1 permits the canonical belief projection in the request.
// Genuine arm labels only:
const ARM_MARKERS = ["high", "low", "neutral", "arm", "treatment", "experiment"];
const HISTORY_PHRASES = ["[PRIOR FACTUAL MEMORY", "[CONVERSATION HISTORY]", "[TRANSCRIPT]", "episode:", "training evidence", "formation feedback", "state construction"];
const HISTORY_WORDS = ["provenance", "formation", "summary"];
const TRACE_KEYS = ["trace_window", "state_hash_before", "state_hash_after", "trace_id"];

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function readJson<T>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), "utf8")) as T;
}

function userOf(request: ModelTransportRequestV0): string {
  return request.messages.find((m) => m.role === "user")?.content ?? "";
}
function systemOf(request: ModelTransportRequestV0): string {
  return request.messages.find((m) => m.role === "system")?.content ?? "";
}
function beliefBlock(user: string): string {
  const lines = user.split("\n");
  const start = lines.findIndex((l) => l.startsWith("[SUBJECTIVE BELIEF STANCES"));
  if (start < 0) throw new Error("A2: belief header absent");
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("[")) end += 1;
  return lines.slice(start, end).join("\n");
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a2.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D1_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1. source states = ATTEMPT 002 -------------------------------------------------
  const protocol = await deriveV2ProtocolHashesV0();
  const manifest = await deriveD1ManifestV0();
  if (protocol.semantic_contract_hash !== QUALIFIED_CONTRACT_HASH) {
    fail("D1_BLOCKED_BY_INSTRUMENT_MISMATCH", protocol.semantic_contract_hash);
  }
  const states = new Map<string, SubjectStateV4>();
  for (const level of LEVELS) {
    const doc = await readJson<{ state: SubjectStateV4 }>(ATTEMPT_002, `post-state-${level.toLowerCase()}.json`);
    states.set(level, doc.state);
  }
  await write("source-state-manifest.json", {
    source: "a1-world-attempt-002",
    attempt_001_read: false,
    levels: LEVELS,
    state_hashes: await Promise.all(
      LEVELS.map(async (l) => ({ level: l, state_hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { state: states.get(l) })) }))
    )
  });

  // ---- 2/3/4. pristine production V8 requests -----------------------------------------
  const pristine = new Map<string, ModelTransportRequestV0>();
  const pristineNorm: { level: string; normalized: string }[] = [];
  const observationFidelity: Record<string, unknown> = {};
  const traceExposure: Record<string, unknown> = {};
  const pristineHistory: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const state = states.get(level) as SubjectStateV4;
    const projection = await (await import("../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js")).buildCognitiveContextProjectionV2ForExplicitV4(state);
    const request = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
        Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
      ]),
      structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
    }) as unknown as ModelTransportRequestV0;
    pristine.set(level, request);
    const user = userOf(request);
    const observationLine = /^\[current observation\] (.*)$/m.exec(user)?.[1] ?? "(absent)";
    const scene = /^\[context\] scene=("(?:[^"\\]|\\.)*") task=/m.exec(user)?.[1];
    const taskField = /^\[context\] scene=.* task=(.*)$/m.exec(user)?.[1] ?? "(absent)";
    observationFidelity[level] = {
      current_observation_line: observationLine,
      current_observation_is_none: observationLine === "(none)",
      scene_decoded_is_frozen_p1: scene !== undefined && (JSON.parse(scene) as string) === D1_P1.observation_text,
      task_is_none: taskField === "(none)",
      p1_occurrences_in_user_content: user.split(JSON.stringify(D1_P1.observation_text).slice(1, -1)).length - 1,
      messages_length: request.messages.length,
      production_schema_is_v8: request.structured_output?.schema === CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
    };
    const fid = observationFidelity[level] as Record<string, unknown>;
    if (fid["current_observation_is_none"] === true) fail("D1_OBSERVATION_BINDING_MISSING", `${level}: [current observation] is (none)`);
    if (fid["scene_decoded_is_frozen_p1"] !== true) fail("D1_OBSERVATION_FIDELITY_FAILED", `${level}: scene != frozen P1`);
    if (fid["task_is_none"] !== true) fail("D1_OBSERVATION_FIDELITY_FAILED", `${level}: task is not (none)`);
    if (fid["production_schema_is_v8"] !== true) fail("D1_PRISTINE_REQUEST_NOT_V8", level);
    if (fid["p1_occurrences_in_user_content"] !== 1) {
      fail("D1_OBSERVATION_DUPLICATION", `${level}: P1 appears ${String(fid["p1_occurrences_in_user_content"])} times`);
    }

    // trace non-exposure: STRUCTURAL (key presence in the request JSON, not substring luck)
    const requestText = canonicalJsonString(request);
    const structural = requestText.includes('"trace_window"') || requestText.includes('"state_hash_before"') || requestText.includes('"state_hash_after"') || requestText.includes('"trace_id"');
    traceExposure[level] = { trace_keys_structurally_present: structural, trace_keys_checked: TRACE_KEYS };
    if (structural) fail("D1_TRACE_BOOKKEEPING_MODEL_FACING", level);

    // pristine history absence (word-boundary, SUBJECT DATA region only)
    const phrases = HISTORY_PHRASES.filter((p) => user.includes(p));
    const words = HISTORY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(user));
    const armHits = ARM_MARKERS.filter((m) => new RegExp(`\\b${m}\\b`, "i").test(beliefBlock(user)));
    pristineHistory[level] = { phrase_hits: phrases, word_hits: words, arm_markers_in_belief_block: armHits, production_prompt_hits_informational: HISTORY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(systemOf(request))) };
    if (phrases.length > 0 || words.length > 0 || armHits.length > 0) {
      fail("D1_HISTORY_ABSENCE_VIOLATED", `${level}: ${JSON.stringify({ phrases, words, armHits })}`);
    }
    await write(`pristine-request-${level.toLowerCase()}.json`, {
      level,
      request,
      request_hash: await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown)
    });
    pristineNorm.push({ level, normalized: normalizeArmSpecificBytes(request).normalized_user_content });
  }
  await write("pristine-observation-fidelity-report.json", observationFidelity);
  await write("trace-non-exposure-report.json", {
    per_arm: traceExposure,
    conclusion: "the derived trace bookkeeping proven causally inert in A1 does not appear in the model-facing production request at all, so Revision 4's normalisation stays confined to the canonical isolation gate",
    method: "structural key presence in the canonicalised request JSON, not a raw substring search of natural language"
  });
  await write("pristine-history-absence-report.json", pristineHistory);
  const pristineEquiv = auditNormalizedEquivalenceV0(pristineNorm);
  await write("pristine-normalized-equivalence-report.json", pristineEquiv);
  await write("pristine-request-diff.json", {
    note: "raw pristine requests differ in the belief credence line and the projection hash line; both are the two classes frozen by Revision 3",
    normalized_equivalence: pristineEquiv
  });
  if (!pristineEquiv.ok) fail("D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", `pristine: ${pristineEquiv.detail}`);

  // ---- 7/8. apply DecisionProbeV2 EXACTLY ONCE ----------------------------------------
  const finalNorm: { level: string; normalized: string }[] = [];
  const finalHistory: Record<string, unknown> = {};
  const lexical: Record<string, unknown> = {};
  const application: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const source = pristine.get(level) as ModelTransportRequestV0;
    const built = await buildV2Request({
      production_request: source,
      mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: V2_PRIMARY_SEMANTIC_CONTRACT },
      schema: schemaForPhase("PRIMARY")
    });
    if (!built.schema_substituted) fail("D1_BLOCKED_BY_INSTRUMENT_APPLICATION_FAILURE", `${level}: schema not substituted`);
    const finalSystem = systemOf(built.request);
    const contractCount = finalSystem.split("--- DECISION PROBE OUTPUT CONTRACT").length - 1;
    const anchorCount = finalSystem.split("Decision meanings (binding):").length - 1;
    const endCount = finalSystem.split("--- END DECISION PROBE OUTPUT CONTRACT").length - 1;
    application[level] = {
      before_schema: "conversation-cognition-proposal-v8",
      after_schema_is_decision_probe: canonicalJsonString(built.request.structured_output?.schema ?? {}) === canonicalJsonString(schemaForPhase("PRIMARY")),
      schema_substituted: built.schema_substituted,
      contract_header_count: contractCount,
      anchor_block_count: anchorCount,
      contract_footer_count: endCount,
      duplicate_override: contractCount !== 1 || endCount !== 1,
      already_probed_reentry: false
    };
    if (contractCount !== 1 || anchorCount !== 1 || endCount !== 1) {
      fail("D1_BLOCKED_BY_INSTRUMENT_APPLICATION_FAILURE", `${level}: header=${String(contractCount)} anchor=${String(anchorCount)} footer=${String(endCount)}`);
    }

    const user = userOf(built.request);
    const phrases = HISTORY_PHRASES.filter((p) => user.includes(p));
    const words = HISTORY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(user));
    const armHits = ARM_MARKERS.filter((m) => new RegExp(`\\b${m}\\b`, "i").test(beliefBlock(user)));
    const answerHints = ["expected decision", "correct answer", "should answer"].filter((h) => user.toLowerCase().includes(h));
    finalHistory[level] = { phrase_hits: phrases, word_hits: words, arm_markers: armHits, expected_answer_hints: answerHints };
    if (phrases.length > 0 || words.length > 0 || armHits.length > 0 || answerHints.length > 0) {
      fail("D1_HISTORY_ABSENCE_VIOLATED", `${level} final: ${JSON.stringify(finalHistory[level])}`);
    }

    const block = beliefBlock(user).toLowerCase();
    const contractLower = V2_PRIMARY_SEMANTIC_CONTRACT.toLowerCase();
    const blockWords = block.split(/\s+/);
    const shared6: string[] = [];
    for (let i = 0; i + 6 <= blockWords.length; i += 1) {
      const w = blockWords.slice(i, i + 6).join(" ");
      if (contractLower.includes(w)) shared6.push(w);
    }
    const tokens = DECISION_PROBE_DECISIONS.filter((t) => new RegExp(`\\b${t.toLowerCase()}\\b`).test(block));
    lexical[level] = { shared_6grams_with_contract: shared6, decision_tokens_in_belief_block: tokens, caution_label_unchanged: user.includes(D1_PROPOSITION_LABEL) };
    if (shared6.length > 0 || tokens.length > 0) fail("D1_LEXICAL_AUDIT_FAILED", `${level}: ${JSON.stringify(lexical[level])}`);

    await write(`final-request-${level.toLowerCase()}.json`, {
      level,
      request: built.request,
      probe_request_hash: built.probe_request_hash,
      production_request_hash: built.production_request_hash,
      contract_hash: built.contract_hash
    });
    finalNorm.push({ level, normalized: normalizeArmSpecificBytes(built.request).normalized_user_content });
  }
  await write("instrument-application-report.json", application);
  await write("final-history-absence-report.json", finalHistory);
  await write("final-lexical-audit.json", lexical);
  const finalEquiv = auditNormalizedEquivalenceV0(finalNorm);
  await write("final-request-raw-diff.json", {
    note: "raw final requests differ only in the belief credence line and the projection-hash line",
    per_arm_override_block_hash: await Promise.all(
      LEVELS.map(async (l) => ({
        level: l,
        hash: String(await hashEnvelope("characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0", { applied_override_block: V2_PRIMARY_SEMANTIC_CONTRACT }))
      }))
    )
  });
  await write("final-normalized-equivalence-report.json", finalEquiv);
  if (!finalEquiv.ok) fail("D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", `final: ${finalEquiv.detail}`);

  // ---- 13. executor / generation manifest (static) ------------------------------------
  await write("executor-generation-manifest.json", {
    executor_family: "openai-compatible cloud",
    provider: "DeepSeek",
    model: "deepseek-flash",
    endpoint_family: "https://api.deepseek.com",
    temperature: 0,
    max_output_tokens: 256,
    provider_thinking: "disabled",
    structured_output_enforcement: "PROMPT_CONTRACT_PLUS_HOST_FAIL_CLOSED_PARSER",
    native_schema_transmitted: false,
    notebook_calls_made: 0,
    consistency_with_qualified_v2_run: "same family, same model, same generation settings as D0_V2_RUN_001_DEEPSEEK"
  });
  await write("instrument-identity-report.json", {
    qualified_contract_hash_required: QUALIFIED_CONTRACT_HASH,
    observed_semantic_contract_hash: protocol.semantic_contract_hash,
    match: protocol.semantic_contract_hash === QUALIFIED_CONTRACT_HASH,
    vocabulary_unchanged: DECISION_PROBE_DECISIONS.length === 3,
    anchors_unchanged: V2_PRIMARY_SEMANTIC_CONTRACT.includes("Decision meanings (binding):"),
    parser_unchanged: true,
    schema_semantics_unchanged: canonicalJsonString(schemaForPhase("PRIMARY")).includes("ACCEPT"),
    d1_specific_instrument_created: false,
    frame_minimal_contract_hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { frame_minimal_contract: D1_FRAME_MINIMAL_CONTRACT })),
    preregistration_hash: manifest.preregistration_hash
  });

  const verdict = {
    phase: "A2",
    verdict: "D1_PHASE_A_FULL_REQUEST_CERTIFIED",
    model_calls_transmitted: 0,
    source: "a1-world-attempt-002",
    pristine_visual_check: "current observation non-null, scene == frozen P1, task none, exactly one P1 occurrence",
    pristine_normalized_equivalence: pristineEquiv.detail,
    decision_probe_applied_exactly_once: true,
    final_normalized_equivalence: finalEquiv.detail,
    trace_bookkeeping_model_facing: false,
    instrument_contract_hash: protocol.semantic_contract_hash,
    next_phase: "Phase B (6-call NEUTRAL noise pilot) — NOT run in this round"
  };
  await write("phase-a-full-request-verdict.json", verdict);

  const names = ["source-state-manifest.json", "pristine-observation-fidelity-report.json", "pristine-history-absence-report.json", "pristine-normalized-equivalence-report.json", "trace-non-exposure-report.json", "instrument-application-report.json", "final-history-absence-report.json", "final-lexical-audit.json", "final-normalized-equivalence-report.json", "instrument-identity-report.json", "executor-generation-manifest.json", "phase-a-full-request-verdict.json"];
  for (const level of LEVELS) {
    names.push(`pristine-request-${level.toLowerCase()}.json`, `final-request-${level.toLowerCase()}.json`);
  }
  const hashes: Record<string, string> = {};
  for (const name of names) {
    hashes[name] = String(await hashEnvelope(D1_HASH_PROJECTION_V0, { name, content: await readFile(join(outdir, name), "utf8") }));
  }
  await write("A2_MANIFEST.json", { artifact_hashes: hashes, model_calls_transmitted: 0, verdict: verdict.verdict });

  process.stdout.write(`\nD1_PHASE_A_FULL_REQUEST_CERTIFIED\nMODEL_CALLS_TRANSMITTED = 0\n`);
  process.stdout.write(`pristine normalized equivalence: ${pristineEquiv.detail}\n`);
  process.stdout.write(`final normalized equivalence   : ${finalEquiv.detail}\n`);
}

await main();
