/**
 * PERSONALITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — bounded experiment.
 *
 * Pre-registered, single-run, no retries. Two cognition projections identical in
 * every behaviourally relevant field except CURRENT acquired Personality are
 * rendered through the PRODUCTION cognition prompt builder and sent once each to
 * the repository's local real provider (Ollama / qwen3.5:9b). Outputs are captured
 * and classified transparently. No production code is modified.
 *
 * The acquired-Personality contrast P0 → P1 is derived from the FROZEN
 * PersonalityPlasticityProducerV0 (openness INCREASE, default engineering policy),
 * i.e. the same lawful numeric authority the production chain uses.
 *
 * Usage:  node run.mjs
 * Env:    OLLAMA_BASE_URL (default http://127.0.0.1:11434)
 *         CHARACTEROS_MODEL (default qwen3.5:9b)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OllamaNativeCognitionTransportV0, buildCognitivePromptMessages } from "../../../packages/runtime/dist/index.js";
import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0
} from "../../../packages/personality/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.CHARACTEROS_MODEL ?? "qwen3.5:9b";
const RUN_LABEL = process.env.CHARACTEROS_EXPERIMENT_RUN ?? "run-1";
const SETTINGS = Object.freeze({
  base_url: BASE_URL,
  model: MODEL,
  timeout_ms: 240000,
  num_predict: 1024,
  context_window_tokens: 8192
});

/** EXPERIMENT FIXTURE ONLY — never defaults. */
const P0_DIMENSIONS = [
  { dimension_id: "agreeableness", value: 0.5 },
  { dimension_id: "conscientiousness", value: 0.5 },
  { dimension_id: "extraversion", value: 0.5 },
  { dimension_id: "openness", value: 0.4 }
];

const SCENARIOS = Object.freeze([
  {
    id: "novel-vs-familiar",
    scene: "There is a familiar routine available, and separately an unfamiliar option has just appeared.",
    task: "Decide how to proceed and state your intent."
  },
  {
    id: "alternative-interpretation",
    scene: "The situation could be read the usual way, but an unexpected alternative interpretation is also possible.",
    task: "Decide how to proceed and state your intent."
  },
  {
    id: "proven-vs-unproven",
    scene: "A well-known approach is safe, while an unproven approach might be more interesting.",
    task: "Decide how to proceed and state your intent."
  }
]);

const NOVELTY_MARKERS = [
  "explor",
  "novel",
  "unfamiliar",
  "new ",
  "new approach",
  "experiment",
  "try the",
  "alternative",
  "investigat",
  "curious",
  "curiosity",
  "discover",
  "innov",
  "diverge"
];
const FAMILIAR_MARKERS = [
  "familiar",
  "routine",
  "known",
  "safe",
  "stick",
  "habit",
  "convention",
  "cautious",
  "avoid",
  "predictable",
  "proven",
  "stable",
  "well-known"
];

function countMarkers(text, markers) {
  const lower = text.toLowerCase();
  return markers.reduce((total, marker) => total + (lower.includes(marker) ? 1 : 0), 0);
}

function sortedDimensions(dimensions) {
  return [...dimensions].sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0));
}

/** Lawfully derive P1 from the frozen producer (no host-authored numeric delta). */
async function deriveP1() {
  const result = await proposePersonalityPlasticityV0(
    {
      subject_id: "experiment-subject",
      expected_state_revision: 0,
      current_personality: { schema_version: "personality-state-v0", dimensions: sortedDimensions(P0_DIMENSIONS) }
    },
    [0.9, 0.9, 0.9].map((activation, index) => ({
      memory_ref: `episode:${String(index + 1).repeat(64)}`,
      age_logical: 0,
      decay_factor: 1,
      activation_strength: activation
    })),
    { dimension_id: "openness", direction: "INCREASE" },
    ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
  );
  if (result.kind !== "PROPOSED") {
    throw new Error(`frozen producer did not propose: ${JSON.stringify(result)}`);
  }
  const next = result.proposal.updates[0].next_value;
  const dimensions = P0_DIMENSIONS.map((d) => (d.dimension_id === "openness" ? { ...d, value: next } : { ...d }));
  return { dimensions: sortedDimensions(dimensions), next_value: next, step: result.step };
}

/** Both projections are identical except `personality_dimensions`. */
function projection(scenario, personalityDimensions) {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "experiment-subject",
    current_logical_time: 4,
    state_revision: 4,
    traits_dimensions: Object.fromEntries(P0_DIMENSIONS.map((d) => [d.dimension_id, d.value])),
    personality_dimensions: Object.fromEntries(personalityDimensions.map((d) => [d.dimension_id, d.value])),
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.25, activation: 0.5 },
    regulation: { energy: 1, stress: 0.2, arousal: 0.5, fatigue: 0.1 },
    context: {
      scene: scenario.scene,
      task: scenario.task,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: null
    },
    memory_working_refs: [],
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [],
    allowed_actions: [],
    // Fixed experiment placeholder so the ONLY differing request line is the
    // acquired-Personality projection (no production validator participates).
    projection_hash: `sha256:${"e".repeat(64)}`
  };
}

function userContent(projectionValue) {
  return buildCognitivePromptMessages(projectionValue).find((m) => m.role === "user").content;
}

function normalize(requestText) {
  return requestText
    .split("\n")
    .filter((line) => !line.startsWith("[current acquired personality"))
    .join("\n");
}

function parseBehavior(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match === null) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      current_intent: typeof parsed.current_intent === "string" ? parsed.current_intent : null,
      action_intent: parsed.action_intent ?? null,
      confidence: parsed.confidence ?? null,
      reasoning_summary: typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary : null
    };
  } catch {
    return null;
  }
}

function classify(a, b) {
  if (a === null || b === null) return "PROVIDER_FAILURE";
  const textA = `${a.current_intent ?? ""} ${a.reasoning_summary ?? ""}`;
  const textB = `${b.current_intent ?? ""} ${b.reasoning_summary ?? ""}`;
  const sameIntent = (a.current_intent ?? "") === (b.current_intent ?? "");
  const sameAction = JSON.stringify(a.action_intent) === JSON.stringify(b.action_intent);
  if (sameIntent && sameAction) return "NO_MEANINGFUL_BEHAVIOR_DIFFERENCE";
  const noveltyB = countMarkers(textB, NOVELTY_MARKERS);
  const noveltyA = countMarkers(textA, NOVELTY_MARKERS);
  const familiarB = countMarkers(textB, FAMILIAR_MARKERS);
  const familiarA = countMarkers(textA, FAMILIAR_MARKERS);
  // Higher openness (branch B) should trend toward novelty / away from the familiar.
  const consistent = noveltyB > noveltyA || familiarB < familiarA;
  return consistent ? "MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE" : "DIFFERENCE_NOT_CLEARLY_PERSONALITY_RELATED";
}

async function main() {
  const p1 = await deriveP1();
  const transport = new OllamaNativeCognitionTransportV0(SETTINGS);
  const results = [];
  const ledger = [];

  for (const scenario of SCENARIOS) {
    const projectionA = projection(scenario, P0_DIMENSIONS);
    const projectionB = projection(scenario, p1.dimensions);
    const requestA = userContent(projectionA);
    const requestB = userContent(projectionB);
    const requestEquivalentExceptPersonality = normalize(requestA) === normalize(requestB);
    const personalityDiffers =
      JSON.stringify(projectionA.personality_dimensions) !== JSON.stringify(projectionB.personality_dimensions);
    if (!requestEquivalentExceptPersonality || !personalityDiffers) {
      throw new Error(`experiment isolation violated for scenario ${scenario.id}`);
    }

    const messagesA = buildCognitivePromptMessages(projectionA);
    const messagesB = buildCognitivePromptMessages(projectionB);
    let rawA = null;
    let rawB = null;
    let failureA = null;
    let failureB = null;
    try {
      rawA = (await transport.complete({ messages: messagesA })).content;
    } catch (error) {
      failureA = error instanceof Error ? error.message : String(error);
    }
    ledger.push({ scenario: scenario.id, branch: "A", call: 1, ok: failureA === null });
    try {
      rawB = (await transport.complete({ messages: messagesB })).content;
    } catch (error) {
      failureB = error instanceof Error ? error.message : String(error);
    }
    ledger.push({ scenario: scenario.id, branch: "B", call: 1, ok: failureB === null });

    const behaviorA = rawA === null ? null : parseBehavior(rawA);
    const behaviorB = rawB === null ? null : parseBehavior(rawB);
    const classification =
      failureA !== null || failureB !== null ? "PROVIDER_FAILURE" : classify(behaviorA, behaviorB);
    results.push({
      scenario_id: scenario.id,
      event: { scene: scenario.scene, task: scenario.task },
      personality_a: projectionA.personality_dimensions,
      personality_b: projectionB.personality_dimensions,
      request_equivalent_except_personality: requestEquivalentExceptPersonality,
      behavior_a: behaviorA,
      behavior_b: behaviorB,
      raw_a: rawA,
      raw_b: rawB,
      failure_a: failureA,
      failure_b: failureB,
      classification
    });
  }

  const meaningful = results.filter((r) => r.classification === "MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE").length;
  const verdict = meaningful >= 1 ? "LEVEL_6_PASS" : "LEVEL_6_NOT_DEMONSTRATED";
  const evidence = {
    schema_version: "personality-behavioral-differentiation-real-provider-v0",
    provider: "OLLAMA_NATIVE",
    settings: SETTINGS,
    seed_control: "PROVIDER_SEED_CONTROL_UNAVAILABLE",
    personality_contrast: {
      source: "FROZEN PersonalityPlasticityProducerV0 (openness INCREASE, ENGINEERING_REFERENCE_V0)",
      p0: Object.fromEntries(P0_DIMENSIONS.map((d) => [d.dimension_id, d.value])),
      p1: Object.fromEntries(p1.dimensions.map((d) => [d.dimension_id, d.value])),
      step: p1.step
    },
    scenarios: results,
    call_ledger: ledger,
    meaningful_scenario_count: meaningful,
    verdict,
    seed: null
  };
  const outDir = join(HERE, "evidence", RUN_LABEL);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));
  process.stdout.write(JSON.stringify({ verdict, meaningful, classifications: results.map((r) => r.classification) }, null, 2));
  process.stdout.write("\n");
}

main().catch((error) => {
  process.stderr.write(`EXPERIMENT_FAILED: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
