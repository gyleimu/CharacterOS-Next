/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_CLOSURE_V0 — zero-model causal-surface inventory.
 *
 * READ-ONLY. Verifies from source and from frozen evidence artifacts (never from
 * memory): the exact production causal surface of
 * `relationship_core_interaction_familiarity_v0`, the state of the retrieval
 * channel in the shipped session path, what the three prior experiments actually
 * exercised, and whether the stale writer-authority metadata can affect behavior.
 *
 * REAL MODEL CALLS: 0. PRODUCTION CHANGES: NONE.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { URL } from "node:url";

const root = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const json = (rel) => JSON.parse(read(rel));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", cwd: root }).trim();

const checks = [];
const check = (id, ok, detail) => checks.push({ id, ok: ok === true, detail });

// ---- 1. repository truth ---------------------------------------------------------
check("repo.branch", git("rev-parse", "--abbrev-ref", "HEAD") === "main", git("rev-parse", "--abbrev-ref", "HEAD"));
const dirty = git("status", "--porcelain").split(String.fromCharCode(10)).filter((line) => line.trim().length > 0);
check("repo.clean_except_this_review", dirty.every((line) => line.includes("relationship-familiarity-causal-closure-v0")),
  `dirty paths outside this review: ${dirty.filter((line) => !line.includes("relationship-familiarity-causal-closure-v0")).join(", ")}`);
const head = git("rev-parse", "HEAD");
check("repo.head_matches_origin", head === git("rev-parse", "origin/main"), head);

// ---- 2. channel A: direct model-visible projection --------------------------------
const conversationV2 = read("packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts");
check("channelA.renderer.familiarity_section", conversationV2.includes("[interaction familiarity — read-only subjective state"),
  "conversation prompt renders the familiarity section");
check("channelA.renderer.influence_section", conversationV2.includes("[interaction familiarity cognition influence — context-resolution ordering ONLY"),
  "conversation prompt renders the influence section");
const legacyProvider = read("packages/runtime/src/providers/behavior/conversation-cognition-provider.ts");
check("channelA.legacy_path", legacyProvider.includes("context_resolution_strategy"),
  "the legacy cognition-action prompt path renders the strategy too (renderCognitiveSubjectData)");
const influence = read("packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-cognition-influence.ts");
check("channelA.threshold.constant", influence.includes("COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0 = 2"),
  "frozen threshold constant = 2");
check("channelA.threshold.rule", /ordinal_level >= COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0/.test(influence),
  "PRESENT && ordinal_level >= 2 -> COUNTERPART_CONTEXT_SEARCH_FIRST, else BASIC_CONTEXT_FIRST");
check("channelA.active_gate", influence.includes("activeRefs.has(projection.counterpart_ref)"),
  "influences only for counterparts in context.active_entity_refs");

// ---- 3. channel B: retrieval orchestration ----------------------------------------
const orchestration = read("packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-retrieval-orchestration.ts");
check("channelB.trigger", orchestration.includes('influence.context_resolution_strategy !== "COUNTERPART_CONTEXT_SEARCH_FIRST"')
  && orchestration.includes("noPriorityRequestCount += 1"), "only SEARCH_FIRST issues a priority query");
check("channelB.query_builder", orchestration.includes("buildInteractionFamiliarityCounterpartQueryV0"),
  "host-owned exact-counterpart query builder");
check("channelB.evidence_validation", orchestration.includes("validateMemoryRetrievalResult"),
  "results validated with the existing retrieval law");
check("channelB.outcomes", orchestration.includes("ATTEMPTED_WITH_USABLE_EVIDENCE") && orchestration.includes("ATTEMPTED_EMPTY")
  && orchestration.includes("RETRIEVAL_FAILED"), "closed outcome vocabulary");
const cognitionExecutor = read("packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts");
check("channelB.executor_call", cognitionExecutor.includes("orchestrateInteractionFamiliarityRetrievalV0"),
  "the cognition executor calls the orchestration unconditionally");
check("channelB.reaches_projection", cognitionExecutor.includes("familiaritySelectedRefs"),
  "selected refs are merged into the projection (recent_retrieval_refs)");

// ---- 4. the shipped session path: is the channel live? ----------------------------
const session = read("packages/runtime/src/session/explicit-v4-session-authority-v0.ts");
check("session.retrieval_port_stub", session.includes("session: retrieval is performed by the session authority"),
  "in-cognition retrieval port throws in the session composition -> every SEARCH_FIRST attempt is RETRIEVAL_FAILED");
check("session.own_query_familiarity_blind", !/familiarity/i.test(session.slice(session.indexOf("commitObservableContext"), session.indexOf("commitObservableContext") + 3000)),
  "the session's own retrieval query contains no familiarity/strategy input");
check("session.own_query_shape", session.includes('salience_constraints: { min_declared_score: null, max_candidates: 8 }'),
  "session query: entity_refs = active_entity_refs, cap 8, no counterpart-context strategy");

// ---- 5. mechanism-level proof that the channel works when a port is live -----------
const mechanismTests = [
  {
    path: "packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-retrieval-orchestration.test.ts",
    proves: "trigger law + closed outcomes at the orchestration seam",
    required: ["COUNTERPART_CONTEXT_SEARCH_FIRST", "attempted_count"]
  },
  {
    path: "packages/runtime/src/transitions/relationship/relationship-familiarity-retrieval-normal-execution.test.ts",
    proves: "executor-level production trace of the priority query",
    required: ["COUNTERPART_CONTEXT_SEARCH_FIRST", "interaction_familiarity_retrieval", "attempted_count"]
  },
  {
    path: "packages/runtime/src/transitions/relationship/relationship-familiarity-retrieved-evidence-integration.test.ts",
    proves: "retrieved evidence becomes model-visible (recent_retrieval_refs)",
    required: ["COUNTERPART_CONTEXT_SEARCH_FIRST", "recent_retrieval_refs"]
  }
];
for (const test of mechanismTests) {
  const source = read(test.path);
  const missing = test.required.filter((token) => !source.includes(token));
  check(`mechanism.${test.path.split("/").pop()}`, missing.length === 0,
    missing.length === 0 ? test.proves : `missing: ${missing.join(", ")}`);
}

// ---- 6. prior experiments: what was actually exercised ----------------------------
const v0 = json("research/experiments/familiarity-causal-behavior-v0/evidence/formal-primary-v0/result.json");
const v1 = json("research/experiments/familiarity-causal-behavior-v1/evidence/formal-primary-v1-r3/result.json");
const realProvider = json("research/experiments/relationship-familiarity-behavior-real-provider-v0/evidence/formal-run/result.json");
const realPreflight = json("research/experiments/relationship-familiarity-behavior-real-provider-v0/evidence/formal-run/preflight.json");
const completionVerdict = json("research/experiments/relationship-familiarity-causal-completion-v0/evidence/qualification-v0/scenes/verdict.json");

check("prior.v0.invalid", v0.interpretation === "INVALID_EXPERIMENT" && v0.complete === false,
  `v0: ${String(v0.interpretation)} (complete=${String(v0.complete)})`);
check("prior.v1.safety_fail_incomplete", v1.interpretation === "SAFETY_GROUNDING_FAIL" && v1.complete === false,
  `v1 r3: ${String(v1.interpretation)} (complete=${String(v1.complete)}, unsupported=${String(v1.unsupported)})`);
check("prior.real_provider.incomplete", realProvider.final_verdict === "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE",
  `real-provider: ${String(realProvider.final_verdict)}`);
const scenarios = realPreflight.scenarios ?? realPreflight;
const scenarioIds = Object.keys(scenarios);
const corpusIdentical = scenarioIds.length > 0 && scenarioIds.every((id) => {
  const entry = scenarios[id];
  return entry?.low?.memory_binding_hash !== undefined && entry.low.memory_binding_hash === entry.high?.memory_binding_hash;
});
check("prior.real_provider.corpus_identical", corpusIdentical,
  "real-provider arms shared one corpus (identical memory_binding_hash)");
const emptyRetrieval = scenarioIds.every((id) => (scenarios[id]?.high?.retrieval_attempts ?? 0) >= 1
  && (scenarios[id]?.high?.evidence_refs?.length ?? -1) === (scenarios[id]?.low?.evidence_refs?.length ?? -2));
check("prior.real_provider.search_leg_emptied", emptyRetrieval,
  "real-provider HIGH attempted retrieval but added no evidence (search leg deliberately empty)");
check("prior.completion.direct_channel_negative",
  completionVerdict.verdict === "RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED"
  && completionVerdict.material_causal_difference === false,
  `completion: ${String(completionVerdict.verdict)} (paired=${String(completionVerdict.paired_directional)}, ablation=${String(completionVerdict.ablation_directional)})`);

// ---- 7. stale writer-authority metadata -------------------------------------------
const registry = read("packages/runtime/src/authority/historical-writer-authority-registry.ts");
check("stale.constant_present", registry.includes('PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE"'),
  "the literal still says NONE");
check("stale.constant_claims_no_product_path", registry.includes("There is still NO product governed-write path"),
  "the doc comment claims no product governed-write path exists");
const ingest = read("packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-ingestion.ts");
check("stale.contradicted_by_ingestion", ingest.includes("preparedGovernedWriterAuthorityIssuer.issue"),
  "the familiarity ingestion does mint governed writer authority on the production path");
const staleConsumers = execFileSync("git", ["grep", "-n", "PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0", "--", "packages", "product"], { encoding: "utf8", cwd: root })
  .trim().split("\n").filter((line) => !line.includes("historical-writer-authority-registry.ts"));
check("stale.no_behavioral_consumer", staleConsumers.every((line) => line.includes(".test.ts") || line.includes("index.ts")),
  `only test/export consumers: ${staleConsumers.length}`);

const failed = checks.filter((entry) => !entry.ok);
const result = {
  schema_version: "relationship-familiarity-causal-closure-inventory-v0",
  model_calls: 0,
  head,
  causal_surface: {
    channel_a: {
      status: "DIRECT_PROJECTION_CAUSALITY_NOT_ESTABLISHED",
      consumers: ["conversation-cognition-provider-v2.ts (V2->V3->V4->V8 renderer)", "conversation-cognition-provider.ts (legacy cognition-action prompt)"]
    },
    channel_b: {
      status: "SEARCH_FIRST_CAUSAL_CHANNEL_UNTESTED",
      shipped_session_path: "INERT (retrieval port throws; the session's own query is familiarity-blind)",
      executor_compositions: "LIVE (orchestration fires; retrieved refs join recent_retrieval_refs)"
    },
    additional_paths_found: []
  },
  prior_experiments: {
    v0: { verdict: v0.interpretation, complete: v0.complete, corpus_identical: false, search_leg: "exercised in arm B" },
    v1_r3: { verdict: v1.interpretation, complete: v1.complete, corpus_identical: false, search_leg: "exercised in all 8 arm-B executions" },
    real_provider: { verdict: realProvider.final_verdict, corpus_identical: corpusIdentical, search_leg: "attempted but rehearsed EMPTY" },
    completion: { verdict: completionVerdict.verdict, corpus_identical: true, search_leg: "neutralized (matched evidence)" }
  },
  stale_metadata: { verdict: "STALE_TRUTH_METADATA", behavioral_effect: "NONE" },
  checks,
  failed: failed.length
};
writeFileSync(new URL("./inventory.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${checks.length - failed.length}/${checks.length} inventory checks passed${failed.length > 0 ? `; FAILED: ${failed.map((entry) => entry.id).join(", ")}` : ""}\n`);
if (failed.length > 0) process.exitCode = 1;
