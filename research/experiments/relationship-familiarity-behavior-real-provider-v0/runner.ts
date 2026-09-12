/* eslint-disable no-restricted-imports -- Research runner over frozen built roots; real calls only here. */
/**
 * Formal real-provider run for
 * RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0.
 *
 * Per pair: LOW and HIGH arms each get exactly ONE cognition + ONE language
 * call through the production response executor (no retries; a failed upstream
 * stage skips the dependent call and the pair is invalid). Only if BOTH arms
 * produced valid production behavior is ONE blinded evaluator call made.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/index.js";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/index.js";
import {
  CONVENTION_REF,
  EXPERIMENT_ID,
  HIGH,
  LOW,
  MANIFEST_SCHEMA,
  MODEL,
  PAIRS,
  RUBRIC_CLASSES,
  RUBRIC_EVALUATOR_PROMPT,
  SCENARIOS,
  THRESHOLD,
  scenarioById,
  type PairPlanV0,
  type RubricClassV0
} from "./contract.ts";
import { buildArm, check, type World } from "./fixtures.ts";
import { observeArm, objectHash, type Observation } from "./observe.ts";
import { runPreflight } from "./preflight.ts";

export interface ArmRecord {
  readonly pair_id: string;
  readonly scenario_id: string;
  readonly arm: "LOW" | "HIGH";
  readonly order_position: "X" | "Y";
  readonly validity: string;
  readonly behavior_text: string | null;
  readonly evidence_refs: readonly string[];
  readonly behavior_id: string | null;
  readonly cognition_request_hash: string | null;
  readonly projection_hash: string | null;
  readonly influence_strategy: string | null;
  readonly retrieval_attempts: number;
  readonly cognition_calls: number;
  readonly language_calls: number;
  readonly deterministic: {
    readonly asks_clarification: boolean;
    readonly cites_shared_context: boolean;
    readonly possible_unsupported_shared_context: boolean;
  };
  readonly error: string | null;
}

export interface PairRecord {
  readonly pair_id: string;
  readonly scenario_id: string;
  readonly order: "LOW_FIRST" | "HIGH_FIRST";
  readonly low: ArmRecord;
  readonly high: ArmRecord;
  readonly evaluation: {
    readonly x_class: RubricClassV0;
    readonly y_class: RubricClassV0;
    readonly more_counterpart_context_use: "X" | "Y" | "NEITHER" | "BOTH";
    readonly rationale: string;
    readonly raw_valid: boolean;
  } | null;
  readonly direction: "CONSISTENT" | "REVERSE" | "NEUTRAL" | "INVALID";
}

export interface FormalResult {
  readonly schema_version: "relationship-familiarity-behavior-result-v0";
  readonly experiment: string;
  readonly manifest_hash: string;
  readonly complete: boolean;
  readonly counts: {
    cognition: number;
    language: number;
    evaluator: number;
    failed_calls: number;
    skipped_dependent_calls: number;
    retries: number;
  };
  readonly pairs: readonly PairRecord[];
  readonly familiarity_consistent_pairs: number;
  readonly reverse_pairs: number;
  readonly final_verdict:
    | "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_GREEN"
    | "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_NOT_DEMONSTRATED"
    | "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE"
    | "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_EXPERIMENT_INVALID";
}

function manifestHash(): string {
  return objectHash({
    experiment: EXPERIMENT_ID,
    schema: MANIFEST_SCHEMA,
    scenarios: SCENARIOS,
    pairs: PAIRS,
    low: LOW,
    high: HIGH,
    model: MODEL,
    threshold: THRESHOLD,
    rubric_classes: RUBRIC_CLASSES,
    evaluator_prompt: RUBRIC_EVALUATOR_PROMPT
  });
}

function transport(): ModelTransportV0 {
  return new OllamaNativeCognitionTransportV0({
    base_url: MODEL.base_url,
    model: MODEL.name,
    timeout_ms: MODEL.timeout_ms,
    num_predict: MODEL.num_predict
  });
}

function deterministicChecks(text: string, evidenceRefs: readonly string[]) {
  const lower = text.toLowerCase();
  return {
    asks_clarification: text.includes("?"),
    cites_shared_context: evidenceRefs.includes(CONVENTION_REF),
    possible_unsupported_shared_context:
      !evidenceRefs.includes(CONVENTION_REF) &&
      /(usual|normal|standard|as always|like before|our convention)/.test(lower)
  };
}

function armRecord(
  pair: PairPlanV0,
  arm: "LOW" | "HIGH",
  orderPosition: "X" | "Y",
  scenarioId: string,
  observation: Observation
): ArmRecord {
  const text = observation.result?.kind === "OUTPUT_READY" ? observation.result.behavior.text : "";
  const refs = observation.result?.kind === "OUTPUT_READY" ? [...observation.result.behavior.evidence_refs] : [];
  const influence =
    observation.projection?.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy ?? null;
  return {
    pair_id: pair.pair_id,
    scenario_id: scenarioId,
    arm,
    order_position: orderPosition,
    validity: observation.validity,
    behavior_text: observation.result?.kind === "OUTPUT_READY" ? text : null,
    evidence_refs: refs,
    behavior_id: observation.result?.kind === "OUTPUT_READY" ? observation.result.behavior.behavior_id : null,
    cognition_request_hash: observation.cognition_stage.request_hash,
    projection_hash: (observation.projection?.projection_hash as string | undefined) ?? null,
    influence_strategy: influence,
    retrieval_attempts: observation.retrieval_trace.queries.length,
    cognition_calls: observation.cognition_stage.calls,
    language_calls: observation.language_stage.calls,
    deterministic: deterministicChecks(text, refs),
    error: observation.error
  };
}

function parseEvaluation(raw: string): PairRecord["evaluation"] {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const x = parsed["x_class"];
    const y = parsed["y_class"];
    const more = parsed["more_counterpart_context_use"];
    const rationale = parsed["rationale"];
    const classes = RUBRIC_CLASSES as readonly string[];
    if (
      parsed["schema_version"] !== "familiarity-behavior-evaluation-v0" ||
      typeof x !== "string" || !classes.includes(x) ||
      typeof y !== "string" || !classes.includes(y) ||
      (more !== "X" && more !== "Y" && more !== "NEITHER" && more !== "BOTH") ||
      typeof rationale !== "string"
    ) {
      return null;
    }
    return {
      x_class: x as RubricClassV0,
      y_class: y as RubricClassV0,
      more_counterpart_context_use: more,
      rationale,
      raw_valid: true
    };
  } catch {
    return null;
  }
}

function directionOf(record: PairRecord): PairRecord["direction"] {
  const evaluation = record.evaluation;
  if (record.low.validity !== "VALID_BEHAVIOR" || record.high.validity !== "VALID_BEHAVIOR" || evaluation === null) {
    return "INVALID";
  }
  // X is the first arm in the frozen pair order; map blinded X/Y back to arms.
  const xArm: "LOW" | "HIGH" = record.order === "LOW_FIRST" ? "LOW" : "HIGH";
  const yArm: "LOW" | "HIGH" = record.order === "LOW_FIRST" ? "HIGH" : "LOW";
  const highUse = (xArm === "HIGH" ? evaluation.x_class : evaluation.y_class) === "COUNTERPART_CONTEXT_USED";
  const lowUse = (xArm === "LOW" ? evaluation.x_class : evaluation.y_class) === "COUNTERPART_CONTEXT_USED";
  const more = evaluation.more_counterpart_context_use;
  const moreArm = more === "X" ? xArm : more === "Y" ? yArm : null;
  if (highUse && !lowUse) return "CONSISTENT";
  if (lowUse && !highUse) return "REVERSE";
  if (moreArm === "HIGH") return "CONSISTENT";
  if (moreArm === "LOW") return "REVERSE";
  return "NEUTRAL";
}

export async function runFormal(outDir: string): Promise<FormalResult> {
  const save = async (name: string, value: unknown): Promise<void> => {
    const file = join(outDir, `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2));
  };
  // Deterministic preflight — 0 real calls. FAIL → STOP.
  const preflight = await runPreflight(save);
  await save("preflight", preflight);
  const manifest = manifestHash();
  if (preflight.verdict !== "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS") {
    return {
      schema_version: "relationship-familiarity-behavior-result-v0",
      experiment: EXPERIMENT_ID,
      manifest_hash: manifest,
      complete: false,
      counts: { cognition: 0, language: 0, evaluator: 0, failed_calls: 0, skipped_dependent_calls: 0, retries: 0 },
      pairs: [],
      familiarity_consistent_pairs: 0,
      reverse_pairs: 0,
      final_verdict: "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_EXPERIMENT_INVALID"
    };
  }
  await save("manifest", {
    experiment: EXPERIMENT_ID,
    manifest_hash: manifest,
    scenarios: SCENARIOS,
    pairs: PAIRS,
    low: LOW,
    high: HIGH,
    model: MODEL,
    settings: { temperature: MODEL.temperature, think: MODEL.think, stream: MODEL.stream, num_predict: MODEL.num_predict, timeout_ms: MODEL.timeout_ms, seed: MODEL.seed }
  });

  const cognition = transport();
  const language = transport();
  const evaluator = transport();
  let cognitionCalls = 0;
  let languageCalls = 0;
  let evaluatorCalls = 0;
  let failedCalls = 0;
  let skippedDependentCalls = 0;

  const pairs: PairRecord[] = [];
  for (const pair of PAIRS) {
    const scenario = scenarioById(pair.scenario_id);
    const orderArms: readonly ("LOW" | "HIGH")[] = pair.order === "LOW_FIRST" ? ["LOW", "HIGH"] : ["HIGH", "LOW"];
    const observations: Partial<Record<"LOW" | "HIGH", { world: World; observation: Observation }>> = {};
    for (const arm of orderArms) {
      const familiarity = arm === "LOW" ? LOW.value : HIGH.value;
      const world = await buildArm({ scenario, arm, familiarity });
      const observation = await observeArm(world, { cognition, language }, {
        requestId: `response-request-${pair.pair_id}-${arm}`,
        save: async (name, value) => save(`observations/${pair.pair_id}-${arm}/${name}`, value)
      });
      cognitionCalls += observation.cognition_stage.calls;
      languageCalls += observation.language_stage.calls;
      if (observation.cognition_stage.transport_error !== null) failedCalls += 1;
      if (observation.language_stage.transport_error !== null) failedCalls += 1;
      if (observation.result?.kind === "FAILED" && observation.cognition_stage.transport_error !== null) skippedDependentCalls += 1;
      observations[arm] = { world, observation };
    }
    const low = observations.LOW;
    const high = observations.HIGH;
    check(low !== undefined && high !== undefined, "both arms observed");
    const lowRecord = armRecord(pair, "LOW", orderArms.indexOf("LOW") === 0 ? "X" : "Y", scenario.scenario_id, low.observation);
    const highRecord = armRecord(pair, "HIGH", orderArms.indexOf("HIGH") === 0 ? "X" : "Y", scenario.scenario_id, high.observation);
    await save(`observations/${pair.pair_id}-low-record`, lowRecord);
    await save(`observations/${pair.pair_id}-high-record`, highRecord);

    let evaluation: PairRecord["evaluation"] = null;
    if (lowRecord.validity === "VALID_BEHAVIOR" && highRecord.validity === "VALID_BEHAVIOR") {
      const x = lowRecord.order_position === "X" ? lowRecord : highRecord;
      const y = lowRecord.order_position === "X" ? highRecord : lowRecord;
      const user = [
        `CURRENT REQUEST: ${scenario.current_event}`,
        `SHARED EVIDENCE AVAILABLE TO BOTH RESPONSES: ${scenario.shared_evidence}`,
        "Response X:",
        x.behavior_text ?? "",
        "Response Y:",
        y.behavior_text ?? ""
      ].join("\n");
      const request = {
        messages: [
          { role: "system" as const, content: RUBRIC_EVALUATOR_PROMPT },
          { role: "user" as const, content: user }
        ]
      };
      await save(`observations/${pair.pair_id}-evaluator-request`, request);
      try {
        const response = await evaluator.complete(request as never);
        evaluatorCalls += 1;
        await save(`observations/${pair.pair_id}-evaluator-raw`, { content: response.content, model: response.model });
        evaluation = parseEvaluation(response.content);
        await save(`observations/${pair.pair_id}-evaluator-parsed`, evaluation);
      } catch (error) {
        evaluatorCalls += 1;
        failedCalls += 1;
        await save(`observations/${pair.pair_id}-evaluator-error`, {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    const record: PairRecord = {
      pair_id: pair.pair_id,
      scenario_id: pair.scenario_id,
      order: pair.order,
      low: lowRecord,
      high: highRecord,
      evaluation,
      direction: "INVALID"
    };
    const withDirection: PairRecord = { ...record, direction: directionOf(record) };
    await save(`pairs/${pair.pair_id}`, withDirection);
    pairs.push(withDirection);
  }

  const complete =
    pairs.length === PAIRS.length &&
    pairs.every((pair) => pair.low.validity === "VALID_BEHAVIOR" && pair.high.validity === "VALID_BEHAVIOR") &&
    pairs.every((pair) => pair.evaluation !== null);
  const consistent = pairs.filter((pair) => pair.direction === "CONSISTENT").length;
  const reverse = pairs.filter((pair) => pair.direction === "REVERSE").length;

  const finalVerdict: FormalResult["final_verdict"] = !complete
    ? "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE"
    : consistent >= THRESHOLD.min_familiarity_consistent_pairs && reverse <= THRESHOLD.max_reverse_pairs
      ? "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_GREEN"
      : "RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_NOT_DEMONSTRATED";

  const result: FormalResult = {
    schema_version: "relationship-familiarity-behavior-result-v0",
    experiment: EXPERIMENT_ID,
    manifest_hash: manifest,
    complete,
    counts: {
      cognition: cognitionCalls,
      language: languageCalls,
      evaluator: evaluatorCalls,
      failed_calls: failedCalls,
      skipped_dependent_calls: skippedDependentCalls,
      retries: 0
    },
    pairs,
    familiarity_consistent_pairs: consistent,
    reverse_pairs: reverse,
    final_verdict: finalVerdict
  };
  await save("result", result);
  return result;
}
