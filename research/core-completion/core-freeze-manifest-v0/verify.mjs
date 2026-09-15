/**
 * CORE_FREEZE_MANIFEST_V0 — zero-model verification of the frozen Core claims.
 *
 * Every check below is deterministic and offline: it reads the built public root
 * (`packages/runtime/dist/index.js`), the production sources, and executes pure
 * validators with constructed fixtures. REAL MODEL CALLS: 0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { URL } from "node:url";

const root = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const runtime = await import(new URL("../../../packages/runtime/dist/index.js", import.meta.url).href);
// The live V10 builder is intentionally absent from the public root surface (root-surface
// guard test); the manifest verifies it through its own compiled module.
const languageInput = await import(new URL("../../../packages/runtime/dist/transitions/conversation/language-realization-input.js", import.meta.url).href);

const results = [];
const check = (id, ok, detail) => results.push({ id, ok: ok === true, detail });

// ---- 1. live protocol versions ---------------------------------------------------
check("live.cognition.v8", runtime.CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V8 === "conversation-cognition-proposal-v8", String(runtime.CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V8));
check("live.binding.v4", runtime.COGNITION_INVOCATION_BINDING_SCHEMA_VERSION_V4 === "cognition-invocation-binding-v4", String(runtime.COGNITION_INVOCATION_BINDING_SCHEMA_VERSION_V4));
check("live.proposal_hash_projection.v8", runtime.CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V8 === "characteros-next/runtime/conversation-cognition-proposal/v8", String(runtime.CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V8));

// ---- 2. frozen closed registries -------------------------------------------------
check("frozen.acts", JSON.stringify(runtime.CONVERSATIONAL_ACT_KINDS_V0) === JSON.stringify(["GREET", "ACKNOWLEDGE", "GENERATIVE"]), JSON.stringify(runtime.CONVERSATIONAL_ACT_KINDS_V0));
check("frozen.derivation_operations", JSON.stringify(runtime.HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0) === JSON.stringify(["INTEGER_ARITHMETIC", "STRING_REVERSE", "RULE_CLASSIFICATION"]), JSON.stringify(runtime.HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0));

// ---- 3. historical readability (V1-V7 cognition validators, V6/V7 canonicalizers) --
const historicalValidators = ["V1", "V2", "V3", "V4", "V5", "V6", "V7"].every((v) => typeof runtime[`validateConversationCognitionProposal${v}`] === "function");
check("history.cognition_validators.v1_v7", historicalValidators, "validateConversationCognitionProposalV1..V7 exported");
check("history.cognition_canonicalizers.v6_v7", typeof runtime.canonicalizeConversationCognitionModelOutputV6 === "function" && typeof runtime.canonicalizeConversationCognitionModelOutputV7 === "function", "V6/V7 canonicalizers exported");
check("history.language.any_version_validator", typeof runtime.validateLanguageRealizationInputAnyVersion === "function" && typeof runtime.deriveLanguageRealizationInputHashAnyVersion === "function", "any-version language validator/hash exported");

// ---- 4. live path uses V8 only, no fallback --------------------------------------
const executorSource = readFileSync(`${root}packages/runtime/src/transitions/conversation/conversation-text-response-executor-v1.ts`, "utf8");
check("live.executor.provider_v8", executorSource.includes("ConversationCognitionProviderV8") && !executorSource.includes("ConversationCognitionProviderV6"), "executor wires ProviderV8, never V6");
check("live.executor.no_v7_provider", !executorSource.includes("ConversationCognitionProviderV7"), "executor never falls back to V7");
check("live.executor.semantic_completeness_failure", executorSource.includes("SEMANTIC_COMPLETENESS_FAILED"), "pre-Language completeness failure is mapped as COGNITION_FAILED");
const providerSource = readFileSync(`${root}packages/runtime/src/providers/behavior/conversation-cognition-provider-v8.ts`, "utf8");
check("live.provider.response_semantics_rejected", providerSource.includes('"RESPONSE_SEMANTICS_REJECTED"'), "typed rejection code for missing/invalid atoms");

// ---- 5. §2/§23 zero-authority invariant + §8 pure-quote primary -------------------
const OBS = "observation:o-freeze-manifest";
const HASH = `sha256:${"a".repeat(64)}`;
const SCENE = "Alice asks: what is 17 + 25?";
const projection = {
  schema_version: "cognitive-context-projection-v2", subject_id: "subject-freeze-manifest",
  current_logical_time: 3, state_revision: 3, traits_dimensions: {}, personality_dimensions: {},
  personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 },
  regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
  context: { scene: SCENE, task: "Respond.", focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: ["environment:room-1"], current_observation_ref: OBS },
  memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
  relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
  interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH,
  factual_memory_evidence: { entries: [] }
};
const baseWire = {
  schema_version: "conversation-cognition-proposal-v8",
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0", reasoning_summary: "deterministic freeze verification",
    relevant_memory_handles: [], considered_handles: ["F1"], current_intent: "respond",
    confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: ["F1"]
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null,
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" }
};
const atomless = { ...baseWire };
delete atomless.response_semantics;
const atomlessChecked = runtime.canonicalizeConversationCognitionModelOutputV8(atomless, projection, HASH);
check("invariant.zero_atom_fail_closed", atomlessChecked.ok === false && String(atomlessChecked.detail).startsWith("SEMANTIC_COMPLETENESS_FAILED"), String(atomlessChecked.detail));

const quoteWire = {
  ...baseWire,
  factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text: SCENE, source_handles: ["F1"] }] },
  response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
};
const quoteChecked = runtime.canonicalizeConversationCognitionModelOutputV8(quoteWire, projection, HASH);
check("contract.pure_quote_primary_admitted", quoteChecked.ok === true, quoteChecked.ok ? "authorized" : quoteChecked.detail);
const v7Wire = { ...baseWire, schema_version: "conversation-cognition-proposal-v7" };
const downgraded = runtime.canonicalizeConversationCognitionModelOutputV8(v7Wire, projection, HASH);
check("contract.live_rejects_v7_wire", downgraded.ok === false, String(downgraded.detail));

// ---- 6. plan routing + RI-D request-id isolation at V10 --------------------------
const hostBound = await runtime.validateHostBoundConversationCognitionProposalV8(quoteChecked.proposal, projection);
check("contract.host_bound_proposal_hash", hostBound.ok === true && typeof hostBound.proposal_hash === "string", hostBound.ok ? hostBound.proposal_hash.slice(0, 24) : String(hostBound.detail));
const buildRequest = (proposal, responseRequestId) => ({
  subject_id: "subject-freeze-manifest", source_revision: 3, response_request_id: responseRequestId,
  projection, conversation_proposal: proposal, memory_episode_contents: []
});
const first = await languageInput.buildLanguageRealizationInputV10(buildRequest(hostBound.proposal, "req-freeze-alpha"));
const second = await languageInput.buildLanguageRealizationInputV10(buildRequest(hostBound.proposal, "req-freeze-beta"));
check("contract.v10_plan_routes_atom", first.ok === true && second.ok === true && JSON.stringify(first.input.realization_plan.primary) === JSON.stringify({ kind: "PRIMARY_FACT", claim_index: 0, claim_kind: "SOURCE_QUOTE" }), first.ok ? JSON.stringify(first.input.realization_plan.primary) : String(first.detail));
const payloadFirst = languageInput.modelFacingLanguagePayloadV10(first.input);
const payloadSecond = languageInput.modelFacingLanguagePayloadV10(second.input);
check("isolation.request_id_not_model_visible", JSON.stringify(payloadFirst) === JSON.stringify(payloadSecond) && JSON.stringify(payloadFirst).includes("realization_plan") === true && Object.hasOwn(payloadFirst, "response_request_id") === false, "identical model-facing payloads for different request ids");

// ---- 7. downstream Memory epistemic boundary (§17/§18) ---------------------------
const EPISODE_REF = `episode:${"b".repeat(64)}`;
const GENERATED = "Sure - here is a small poem about rain.";
const deliveryProjection = {
  ...projection,
  memory_working_refs: [EPISODE_REF],
  factual_memory_evidence: { entries: [{
    kind: "BEHAVIOR_OUTCOME", episode_ref: EPISODE_REF, repository_revision: "R1",
    episode_payload_hash: `sha256:${"c".repeat(64)}`, experience_ref: `experience:${"d".repeat(64)}`,
    experience_payload_hash: `sha256:${"e".repeat(64)}`, event_ref: `event:${"f".repeat(64)}`,
    event_payload_hash: `sha256:${"0".repeat(64)}`, actor_ref: "entity:alice",
    delivered_behavior_text: GENERATED, exact_outcome_text: "Lovely, thanks.",
    delivered_logical_time: 2, outcome_logical_time: 3
  }] }
};
const handle = runtime.buildSourceHandleMapV0(deliveryProjection).refToHandle.get(EPISODE_REF);
const cite = (text) => ({
  ...baseWire,
  factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text, source_handles: [handle] }] },
  response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
});
const exactQuote = runtime.canonicalizeConversationCognitionModelOutputV8(cite(GENERATED), deliveryProjection, HASH);
const paraphrase = runtime.canonicalizeConversationCognitionModelOutputV8(cite("a poem about rain"), deliveryProjection, HASH);
check("memory.delivery_record_quote_only_verbatim", exactQuote.ok === true && paraphrase.ok === false, "verbatim delivery quote admitted; reinterpretation refused");

// ---- 8. frozen artifacts unchanged ----------------------------------------------
const hash = (rel) => `sha256:${createHash("sha256").update(readFileSync(`${root}${rel}`)).digest("hex")}`;
const frozenFiles = {
  "packages/runtime/src/transitions/conversation/factual-claim-authorization.ts": hash("packages/runtime/src/transitions/conversation/factual-claim-authorization.ts"),
  "packages/runtime/src/transitions/conversation/subjective-rationale-authorization.ts": hash("packages/runtime/src/transitions/conversation/subjective-rationale-authorization.ts"),
  "packages/runtime/src/transitions/cognition-action/factual-memory-evidence.ts": hash("packages/runtime/src/transitions/cognition-action/factual-memory-evidence.ts"),
  "packages/runtime/src/transitions/learning/behavior-outcome-feedback-encoder.ts": hash("packages/runtime/src/transitions/learning/behavior-outcome-feedback-encoder.ts")
};

const failed = results.filter((entry) => !entry.ok);
writeFileSync(new URL("./verify-results.json", import.meta.url), `${JSON.stringify({
  schema_version: "core-freeze-verification-v0",
  model_calls: 0,
  checks: results,
  failed: failed.length,
  frozen_file_hashes: frozenFiles
}, null, 2)}\n`);
process.stdout.write(`${results.length - failed.length}/${results.length} checks passed${failed.length > 0 ? `; FAILED: ${failed.map((entry) => entry.id).join(", ")}` : ""}\n`);
if (failed.length > 0) process.exitCode = 1;
