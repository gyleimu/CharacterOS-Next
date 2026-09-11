/**
 * PERSONALITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V1 — controlled follow-up.
 *
 * Same frozen V0 conditions (scenario texts loaded from the V0 evidence artifact,
 * same contrast, model, transport, settings, branch order, classification law and
 * call budget); the ONLY intended change is the production cognition salience
 * contract (b8384f3): registry semantic anchors + one generic soft-prior rule.
 *
 * One bounded six-call run. No retries, no tuning.
 *
 * Usage:  node run.mjs
 * Env:    OLLAMA_BASE_URL (default http://127.0.0.1:11434)
 *         CHARACTEROS_MODEL (default qwen3.5:9b)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OllamaNativeCognitionTransportV0,
  PERSONALITY_DIMENSION_REGISTRY_V0,
  buildCognitivePromptMessages
} from "../../../packages/runtime/dist/index.js";
import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0
} from "../../../packages/personality/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const V0_EVIDENCE = join(
  HERE,
  "..",
  "personality-behavioral-differentiation-real-provider-v0",
  "evidence",
  "run-2",
  "evidence.json"
);
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

const P0_DIMENSIONS = [
  { dimension_id: "agreeableness", value: 0.5 },
  { dimension_id: "conscientiousness", value: 0.5 },
  { dimension_id: "extraversion", value: 0.5 },
  { dimension_id: "openness", value: 0.4 }
];

const NOVELTY_MARKERS = [
  "explor", "novel", "unfamiliar", "new ", "new approach", "experiment", "try the",
  "alternative", "investigat", "curious", "curiosity", "discover", "innov", "diverge"
];
const FAMILIAR_MARKERS = [
  "familiar", "routine", "known", "safe", "stick", "habit", "convention", "cautious",
  "avoid", "predictable", "proven", "stable", "well-known"
];

function countMarkers(text, markers) {
  const lower = text.toLowerCase();
  return markers.reduce((total, marker) => total + (lower.includes(marker) ? 1 : 0), 0);
}

function sortedDimensions(dimensions) {
  return [...dimensions].sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0));
}

/** Production-equivalent disposition projection from the frozen registry. */
function disposition(dimensions) {
  return Object.fromEntries(
    sortedDimensions(dimensions).flatMap((d) => {
      const definition = PERSONALITY_DIMENSION_REGISTRY_V0.find((entry) => entry.dimension_id === d.dimension_id);
      if (definition === undefined) return [];
      return [
        [
          d.dimension_id,
          { value: d.value, description: definition.description, low_anchor: definition.low_anchor, high_anchor: definition.high_anchor }
        ]
      ];
    })
  );
}

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
  if (result.kind !== "PROPOSED") throw new Error(`frozen producer did not propose: ${JSON.stringify(result)}`);
  const next = result.proposal.updates[0].next_value;
  return {
    dimensions: sortedDimensions(P0_DIMENSIONS.map((d) => (d.dimension_id === "openness" ? { ...d, value: next } : { ...d }))),
    step: result.step
  };
}

function projection(scenario, personalityDimensions) {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "experiment-subject",
    current_logical_time: 4,
    state_revision: 4,
    traits_dimensions: Object.fromEntries(P0_DIMENSIONS.map((d) => [d.dimension_id, d.value])),
    personality_dimensions: Object.fromEntries(personalityDimensions.map((d) => [d.dimension_id, d.value])),
    personality_disposition: disposition(personalityDimensions),
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
    projection_hash: `sha256:${"e".repeat(64)}`
  };
}

function userContent(projectionValue) {
  return buildCognitivePromptMessages(projectionValue).find((m) => m.role === "user").content;
}

/** Replace the ENTIRE acquired-Personality block; nothing else may differ. */
function normalize(requestText) {
  return requestText
    .split("\n")
    .map((line) => (line.startsWith("[current acquired personality") ? "[current acquired personality <PLACEHOLDER>]" : line))
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
  const consistent = noveltyB > noveltyA || familiarB < familiarA;
  return consistent ? "MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE" : "DIFFERENCE_NOT_CLEARLY_PERSONALITY_RELATED";
}

async function main() {
  const v0 = JSON.parse(readFileSync(V0_EVIDENCE, "utf8"));
  const scenarios = v0.scenarios.map((s) => ({
    id: s.scenario_id,
    scene: s.event.scene,
    task: s.event.task,
    v0_classification: s.classification
  }));
  const p1 = await deriveP1();
  const transport = new OllamaNativeCognitionTransportV0(SETTINGS);

  // ---- non-experimental readiness check (not one of the three scenarios) ----
  const readinessStarted = Date.now();
  const readinessRaw = (await transport.complete({
    messages: [
      { role: "system", content: "Reply with one JSON object only." },
      { role: "user", content: 'Return {"ready":true}' }
    ]
  })).content;
  const readiness = {
    reachable: true,
    model: MODEL,
    latency_ms: Date.now() - readinessStarted,
    content: readinessRaw.slice(0, 200),
    transport: "OllamaNativeCognitionTransportV0",
    think_false: true
  };

  const results = [];
  const ledger = [];
  for (const scenario of scenarios) {
    const projectionA = projection(scenario, P0_DIMENSIONS);
    const projectionB = projection(scenario, p1.dimensions);
    const requestA = userContent(projectionA);
    const requestB = userContent(projectionB);
    const isolated = normalize(requestA) === normalize(requestB);
    const personalityDiffers =
      JSON.stringify(projectionA.personality_disposition) !== JSON.stringify(projectionB.personality_disposition);
    const v1_salience_present =
      requestA.includes("[current acquired personality semantics") &&
      requestA.includes("[personality disposition role");

    let behaviorA = null;
    let behaviorB = null;
    let rawA = null;
    let rawB = null;
    let failureA = null;
    let failureB = null;
    let latencyA = null;
    let latencyB = null;

    if (isolated && personalityDiffers && v1_salience_present) {
      const startedA = Date.now();
      try {
        rawA = (await transport.complete({ messages: buildCognitivePromptMessages(projectionA) })).content;
      } catch (error) {
        failureA = error instanceof Error ? error.message : String(error);
      }
      latencyA = Date.now() - startedA;
      ledger.push({ scenario: scenario.id, branch: "A", call: 1, ok: failureA === null, latency_ms: latencyA });

      const startedB = Date.now();
      try {
        rawB = (await transport.complete({ messages: buildCognitivePromptMessages(projectionB) })).content;
      } catch (error) {
        failureB = error instanceof Error ? error.message : String(error);
      }
      latencyB = Date.now() - startedB;
      ledger.push({ scenario: scenario.id, branch: "B", call: 1, ok: failureB === null, latency_ms: latencyB });

      behaviorA = rawA === null ? null : parseBehavior(rawA);
      behaviorB = rawB === null ? null : parseBehavior(rawB);
    }

    const classification =
      !isolated || !personalityDiffers
        ? "INVALID_ISOLATION"
        : failureA !== null || failureB !== null
          ? "PROVIDER_FAILURE"
          : classify(behaviorA, behaviorB);

    results.push({
      scenario_id: scenario.id,
      event: { scene: scenario.scene, task: scenario.task },
      v0_classification: scenario.v0_classification,
      personality_a: projectionA.personality_dimensions,
      personality_b: projectionB.personality_dimensions,
      personality_disposition_a: projectionA.personality_disposition,
      personality_disposition_b: projectionB.personality_disposition,
      v1_salience_present,
      request_isolated: isolated,
      behavior_a: behaviorA,
      behavior_b: behaviorB,
      raw_a: rawA,
      raw_b: rawB,
      failure_a: failureA,
      failure_b: failureB,
      latency_ms_a: latencyA,
      latency_ms_b: latencyB,
      classification
    });
  }

  const meaningful = results.filter((r) => r.classification === "MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE").length;
  const verdict = meaningful >= 1 ? "LEVEL_6_PASS" : "LEVEL_6_NOT_DEMONSTRATED";
  const evidence = {
    schema_version: "personality-behavioral-differentiation-real-provider-v1",
    baseline_commit: "b8384f3",
    provider: "OLLAMA_NATIVE",
    settings: SETTINGS,
    seed_control: "PROVIDER_SEED_CONTROL_UNAVAILABLE",
    readiness,
    personality_contrast: {
      source: "FROZEN PersonalityPlasticityProducerV0 (openness INCREASE, ENGINEERING_REFERENCE_V0)",
      p0: Object.fromEntries(P0_DIMENSIONS.map((d) => [d.dimension_id, d.value])),
      p1: Object.fromEntries(p1.dimensions.map((d) => [d.dimension_id, d.value])),
      step: p1.step
    },
    scenarios: results,
    call_ledger: ledger,
    meaningful_scenario_count: meaningful,
    verdict
  };
  const outDir = join(HERE, "evidence", RUN_LABEL);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "readiness.json"), JSON.stringify(readiness, null, 2));
  writeFileSync(join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));
  process.stdout.write(
    JSON.stringify(
      {
        verdict,
        meaningful,
        classifications: results.map((r) => r.classification),
        v0: results.map((r) => r.v0_classification)
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
}

main().catch((error) => {
  process.stderr.write(`EXPERIMENT_FAILED: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
