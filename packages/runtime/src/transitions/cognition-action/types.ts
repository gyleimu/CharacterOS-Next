/**
 * P2-next — CognitionActionTransition V0 types (transition-contracts §16, §8
 * field ownership, §25 external side effects; p1-5 A9 Optional Action).
 *
 * Cognition/Motivation → Policy → NO_ACTION（合法结束）∨ ActionIntent.
 * The V0 canonical footprint is a zero-delta durable NO_OP (transition_type
 * "CognitionAction"): the field-ownership matrix authorizes CognitionAction to
 * write ONLY regulation/context, and V0 defines no cognitive persistence —
 * thoughts, plans, goals and decision history are NOT canonical SubjectState
 * fields and are NOT invented here. ActionIntent is a typed declarative
 * proposal for a future execution layer — never evidence of an Outcome.
 *
 * Evidence grounding: every memory/entity/context ref claimed by a provider
 * proposal MUST belong to the supplied projection's allowed evidence set
 * (UNSUPPORTED_EVIDENCE_REF otherwise). No wall clock, no randomness.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0
} from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isNumber,
  isRecord,
  isString,
  ok,
  validateCanonicalText,
  validateRefArray,
  validateRefElement,
  validateUnitInterval,
  type ValidationResult
} from "@characteros-next/subject-core";

export const COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION =
  "cognitive-context-projection-v0" as const;
export const COGNITIVE_CONTEXT_PROJECTION_HASH_PROJECTION =
  "characteros-next/runtime/cognitive-context-projection/v1" as const;

/** Typed declarative action space entry (§19): no executable strings, ever. */
export interface AllowedActionV0 {
  readonly action_type: string;
  readonly target_ref: CanonicalRefV0 | null;
}

/**
 * A proposed external action. It is a REQUEST for a future execution layer —
 * NOT evidence that an action happened, and never an Outcome (§10/§11).
 */
export interface ActionIntentV0 {
  readonly action_type: string;
  readonly target_ref: CanonicalRefV0 | null;
}

/**
 * §5 — the smallest controlled read projection that answers WHO AM I / WHAT IS
 * HAPPENING / WHAT DO I REMEMBER / WHAT AM I FEELING / WHAT DO I BELIEVE /
 * WHAT ACTION SPACE IS AVAILABLE. It never answers "what should I do" — that
 * is provider work. No raw SubjectState, no repository internals, no journal.
 */
export interface CognitiveContextProjectionV0 {
  readonly schema_version: typeof COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly state_revision: StateRevisionV0;
  /** traits_seed read-only evidence (dimensions snapshot; never mutated). */
  readonly traits_dimensions: Readonly<Record<string, number>>;
  /** Current affect channel summaries (canonical values, read-only). */
  readonly affect_channels: ReadonlyArray<{
    readonly channel: string;
    readonly strength: number;
  }>;
  readonly mood_baseline: number;
  readonly regulation: {
    readonly energy: number;
    readonly stress: number;
    readonly arousal: number;
    readonly fatigue: number;
  };
  readonly context: {
    readonly scene: string;
    readonly task: string | null;
    readonly focus_refs: readonly CanonicalRefV0[];
    readonly active_entity_refs: readonly CanonicalRefV0[];
    readonly environment_refs: readonly CanonicalRefV0[];
    readonly current_observation_ref: CanonicalRefV0 | null;
  };
  /** Memory read evidence: working refs + recent retrieval-selected refs. */
  readonly memory_working_refs: readonly CanonicalRefV0[];
  readonly recent_retrieval_refs: readonly CanonicalRefV0[];
  /** V0 read models: beliefs/relationships remain count-only in this projection. */
  readonly belief_item_count: number;
  readonly relationship_counterpart_count: number;
  /** The only action space the provider may propose within. */
  readonly allowed_actions: readonly AllowedActionV0[];
  /** Content-addressed integrity of the exact projection body. */
  readonly projection_hash: HashV1;
}

/** §7 — compact structured cognition result (no private chain-of-thought). */
export interface CognitionProposalV0 {
  readonly schema_version: "cognition-proposal-v0";
  /** Must equal the projection_hash of the input projection (staleness gate). */
  readonly projection_hash: HashV1;
  /** Compact inspectable semantic summary ref (not raw model reasoning). */
  readonly reasoning_summary: string;
  readonly relevant_memory_refs: readonly CanonicalRefV0[];
  readonly considered_context_refs: readonly CanonicalRefV0[];
  /** "What does the subject currently want to pursue" — null is legal. */
  readonly current_intent: string | null;
  readonly confidence: number;
  readonly uncertainty: number;
  /** Optional typed ActionIntent; null = legal NO_ACTION (A9). */
  readonly action_intent: ActionIntentV0 | null;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/** Executor input (transition-contracts §16). */
export interface CognitionActionInputV0 {
  /** Optional cognition trigger refs (sorted unique; may be empty). */
  readonly cause_refs: readonly CanonicalRefV0[];
  /** The action space for THIS cycle (host-provided, projection-bound). */
  readonly allowed_actions: readonly AllowedActionV0[];
}

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "projection_hash",
  "reasoning_summary",
  "relevant_memory_refs",
  "considered_context_refs",
  "current_intent",
  "confidence",
  "uncertainty",
  "action_intent",
  "evidence_refs"
];

const ACTION_INTENT_KEYS: readonly string[] = ["action_type", "target_ref"];

/** Builds the content-addressed projection hash over the exact body. */
export async function cognitiveProjectionHash(body: Record<string, unknown>): Promise<HashV1> {
  return hashEnvelope(COGNITIVE_CONTEXT_PROJECTION_HASH_PROJECTION, body);
}

/** Closed-shape validation of an UNKNOWN provider draft as CognitionProposalV0. */
export function validateCognitionProposal(v: unknown): ValidationResult<CognitionProposalV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal: expected object");
  for (const key of Object.keys(v)) {
    if (!PROPOSAL_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `cognition proposal.${key}: unknown key (closed shape)`);
    }
  }
  if (v["schema_version"] !== "cognition-proposal-v0") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.schema_version");
  }
  if (!isString(v["projection_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.projection_hash: expected string");
  }
  const summary = validateCanonicalText(v["reasoning_summary"], "cognition proposal.reasoning_summary");
  if (!summary.ok) return summary;

  const memoryRefs = validateRefArray(
    v["relevant_memory_refs"],
    "cognition proposal.relevant_memory_refs",
    { sorted: true }
  );
  if (!memoryRefs.ok) return memoryRefs;
  const contextRefs = validateRefArray(
    v["considered_context_refs"],
    "cognition proposal.considered_context_refs",
    { sorted: true }
  );
  if (!contextRefs.ok) return contextRefs;
  const evidence = validateRefArray(v["evidence_refs"], "cognition proposal.evidence_refs", {
    sorted: true
  });
  if (!evidence.ok) return evidence;

  if (!isNumber(v["confidence"]) || !validateUnitInterval(v["confidence"], "cognition proposal.confidence").ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.confidence: [0,1] required");
  }
  if (!isNumber(v["uncertainty"]) || !validateUnitInterval(v["uncertainty"], "cognition proposal.uncertainty").ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.uncertainty: [0,1] required");
  }

  // current_intent: null (legal) or canonical text.
  if (v["current_intent"] !== null) {
    if (!isString(v["current_intent"])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.current_intent: string|null");
    }
    const intent = validateCanonicalText(v["current_intent"], "cognition proposal.current_intent");
    if (!intent.ok) return intent;
  }

  // action_intent: null (legal NO_ACTION) or closed typed shape.
  let actionIntent: ActionIntentV0 | null = null;
  if (v["action_intent"] !== null) {
    if (!isRecord(v["action_intent"])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.action_intent: expected object|null");
    }
    for (const key of Object.keys(v["action_intent"])) {
      if (!ACTION_INTENT_KEYS.includes(key)) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `cognition proposal.action_intent.${key}: unknown key`);
      }
    }
    if (!isString(v["action_intent"]["action_type"]) || v["action_intent"]["action_type"].length === 0) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "cognition proposal.action_intent.action_type: nonempty string");
    }
    let targetRef: CanonicalRefV0 | null = null;
    if (v["action_intent"]["target_ref"] !== null) {
      const target = validateRefElement(
        v["action_intent"]["target_ref"],
        "cognition proposal.action_intent.target_ref",
        ["entity", "subject", "observation", "episode", "event", "source"]
      );
      if (!target.ok) return target;
      targetRef = target.value;
    }
    actionIntent = {
      action_type: v["action_intent"]["action_type"],
      target_ref: targetRef
    };
  }

  return ok({
    schema_version: "cognition-proposal-v0",
    projection_hash: v["projection_hash"] as HashV1,
    reasoning_summary: summary.value,
    relevant_memory_refs: v["relevant_memory_refs"] as readonly CanonicalRefV0[],
    considered_context_refs: v["considered_context_refs"] as readonly CanonicalRefV0[],
    current_intent: (v["current_intent"] ?? null) as string | null,
    confidence: v["confidence"] as number,
    uncertainty: v["uncertainty"] as number,
    action_intent: actionIntent,
    evidence_refs: v["evidence_refs"] as readonly CanonicalRefV0[]
  });
}

/**
 * The allowed evidence set for §15 grounding: memory evidence (working ∪
 * recent retrieval) ∪ projection context refs ∪ the subject identity ref.
 * belief:/relationship: refs are NEVER allowed in V0 (empty read models).
 */
export function allowedEvidenceSet(
  projection: CognitiveContextProjectionV0
): ReadonlySet<string> {
  const allowed = new Set<string>([
    ...projection.memory_working_refs,
    ...projection.recent_retrieval_refs,
    ...projection.context.focus_refs,
    ...projection.context.active_entity_refs,
    ...projection.context.environment_refs
  ]);
  if (projection.context.current_observation_ref !== null) {
    allowed.add(projection.context.current_observation_ref);
  }
  return allowed;
}

/** §15: the FIRST evidence ref outside the allowed set, or null. */
export function findUnsupportedEvidenceRef(
  refs: readonly CanonicalRefV0[],
  allowed: ReadonlySet<string>
): string | null {
  for (const ref of refs) {
    if (!allowed.has(ref)) return ref;
  }
  return null;
}

/** §19: the action intent must be compatible with the supplied action space. */
export function actionIntentAllowed(
  intent: ActionIntentV0,
  allowedActions: readonly AllowedActionV0[]
): boolean {
  for (const allowed of allowedActions) {
    if (allowed.action_type !== intent.action_type) continue;
    if (intent.target_ref === null) return true;
    if (allowed.target_ref !== null && allowed.target_ref === intent.target_ref) return true;
  }
  return false;
}
