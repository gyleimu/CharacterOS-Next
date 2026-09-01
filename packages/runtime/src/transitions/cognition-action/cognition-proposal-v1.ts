/**
 * Belief Decision Influence Relation Foundation V0 — CognitionProposalV1
 * side-by-side schema layer (frozen architecture: COGNITION_PROPOSAL_V1
 * APPROVED_SIDE_BY_SIDE; DECISION_INFLUENCE_PROJECTION_V0 RELATION_ONLY).
 *
 * This file owns ONLY the deterministic wire schema + host action-space
 * authority for the V1 relation chain:
 *
 *   - CognitionProposalV1 closed schema (NO action_intent, NO numeric
 *     influence fields anywhere)
 *   - BeliefStateLocatorV0 (typed BELIEF locator object — NEVER a
 *     CanonicalRefV0; STATE_LOCATOR_NAMESPACE separation)
 *   - BeliefStateActionRelationV0 with EXACT_TUPLE action membership
 *   - host allowed-action grammar / duplicate rejection / canonical
 *     ORDER_INSENSITIVE tuple sort (null target first)
 *   - action-space + accepted-proposal fingerprint derivations over
 *     repository hashEnvelope / JCS
 *
 * It mints NO capability, calls NO provider, and never mutates canonical
 * state. Capability minting lives exclusively in the host admission layer
 * (belief-decision-influence-relation.ts).
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isNumber,
  isRecord,
  isString,
  ok,
  validateCanonicalText,
  validateHash,
  validateIdentifier,
  validateRefElement,
  validateUnitInterval,
  type ValidationResult
} from "@characteros-next/subject-core";

import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import { allowedEvidenceSet } from "./types.js";

export const COGNITION_PROPOSAL_V1_SCHEMA_VERSION = "cognition-proposal-v1" as const;
export const COGNITION_ACTION_SPACE_SCHEMA_VERSION = "cognition-action-space-v1" as const;
export const ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION =
  "accepted-cognition-proposal-v1" as const;

/** Fingerprint namespace EXACT (frozen). */
export const ACTION_SPACE_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/cognition-action-space/v1" as const;
export const ACCEPTED_COGNITION_PROPOSAL_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/accepted-cognition-proposal/v1" as const;

/** Frozen relation cardinality bounds. */
export const MAX_RELATION_BELIEF_ITEMS = 64 as const;
export const MAX_RELATION_ALLOWED_ACTIONS = 64 as const;
export const MAX_STATE_ACTION_RELATIONS = 64 as const;

/**
 * Typed belief state locator: the ONLY namespace through which a belief
 * proposition may be referenced by a V1 relation. Deliberately NOT a
 * CanonicalRefV0 — belief IDs are state locators, never evidence refs.
 */
export interface BeliefStateLocatorV0 {
  readonly domain: "BELIEF";
  readonly proposition_id: IdentifierV0;
}

/** Directional relation value; missing pair = UNASSERTED by omission. */
export type BeliefStateActionRelationKindV0 = "SUPPORTS" | "OPPOSES" | "IRRELEVANT";

export const BELIEF_STATE_ACTION_RELATION_KINDS: readonly BeliefStateActionRelationKindV0[] = [
  "SUPPORTS",
  "OPPOSES",
  "IRRELEVANT"
];

/** One sparse belief→action directional relation (no numeric fields, ever). */
export interface BeliefStateActionRelationV0 {
  readonly state_locator: BeliefStateLocatorV0;
  readonly action: AllowedActionV0;
  readonly relation: BeliefStateActionRelationKindV0;
}

/** Closed V1 cognition result: relations replace action_intent entirely. */
export interface CognitionProposalV1 {
  readonly schema_version: typeof COGNITION_PROPOSAL_V1_SCHEMA_VERSION;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly reasoning_summary: string;
  readonly relevant_memory_refs: readonly CanonicalRefV0[];
  readonly considered_context_refs: readonly CanonicalRefV0[];
  readonly current_intent: string | null;
  readonly confidence: UnitIntervalV0;
  readonly uncertainty: UnitIntervalV0;
  readonly state_action_relations: readonly BeliefStateActionRelationV0[];
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/**
 * Host-authorized accepted proposal (public opaque shape). The capability
 * authority behind it is module-private in the admission layer — the type
 * alone confers NO authority.
 */
export interface AcceptedCognitionProposalV1 {
  readonly schema_version: typeof ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly proposal: CognitionProposalV1;
  readonly accepted_proposal_fingerprint: HashV1;
}

/** Stable fail-closed rejection categories for the V1 relation chain. */
export type CognitionProposalV1RejectionCodeV1 =
  | "INVALID_ACTION_SPACE"
  | "MODEL_MALFORMED_JSON"
  | "MODEL_SCHEMA_INVALID"
  | "MODEL_PROJECTION_MISMATCH"
  | "MODEL_ACTION_SPACE_MISMATCH"
  | "MODEL_UNSUPPORTED_EVIDENCE"
  | "MODEL_INVALID_STATE_LOCATOR"
  | "MODEL_UNKNOWN_PROPOSITION"
  | "MODEL_ACTION_NOT_ALLOWED"
  | "MODEL_DUPLICATE_RELATION_PAIR"
  | "MODEL_RELATION_LIMIT_EXCEEDED"
  | "UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL"
  | "ACCEPTED_PROPOSAL_FINGERPRINT_MISMATCH"
  | "BOUND_CONTEXT_MISMATCH";

export class CognitionRelationRejectionErrorV1 extends Error {
  readonly code: CognitionProposalV1RejectionCodeV1;
  readonly detail_ref: string | null;

  constructor(
    code: CognitionProposalV1RejectionCodeV1,
    detail: string,
    detailRef: string | null = null
  ) {
    super(`COGNITION_RELATION_${code}: ${detail}`);
    this.name = "CognitionRelationRejectionErrorV1";
    this.code = code;
    this.detail_ref = detailRef;
  }
}

// ---- closed key tables (module-private; never exported) ----------------------

const PROPOSAL_V1_KEYS: readonly string[] = [
  "schema_version",
  "projection_hash",
  "action_space_fingerprint",
  "reasoning_summary",
  "relevant_memory_refs",
  "considered_context_refs",
  "current_intent",
  "confidence",
  "uncertainty",
  "state_action_relations",
  "evidence_refs"
];

const RELATION_KEYS: readonly string[] = ["state_locator", "action", "relation"];
const LOCATOR_KEYS: readonly string[] = ["domain", "proposition_id"];
const ACTION_KEYS: readonly string[] = ["action_type", "target_ref"];

/** Relation-level numeric influence field names, for explicit rejection detail. */
const FORBIDDEN_NUMERIC_RELATION_FIELDS: readonly string[] = [
  "weight",
  "score",
  "strength",
  "priority",
  "utility",
  "threshold",
  "margin",
  "confidence"
];

/** Same admitted target kinds as the frozen V0 action intent surface. */
const TARGET_REF_KINDS = ["entity", "subject", "observation", "episode", "event", "source"] as const;

/** Canonical tuple comparator: action_type ↑ UTF-16, null target first, target ↑. */
function compareActionTuples(a: AllowedActionV0, b: AllowedActionV0): number {
  if (a.action_type < b.action_type) return -1;
  if (a.action_type > b.action_type) return 1;
  if (a.target_ref === null && b.target_ref === null) return 0;
  if (a.target_ref === null) return -1;
  if (b.target_ref === null) return 1;
  if (a.target_ref < b.target_ref) return -1;
  if (a.target_ref > b.target_ref) return 1;
  return 0;
}

/**
 * Host allowed-action universe gate (runs BEFORE any fingerprint or provider
 * call): grammar, <=64, exact duplicate tuple rejection
 * (REJECT_EXACT_DUPLICATES_PRE_FINGERPRINT). Returns a copied canonically
 * sorted tuple list; the caller array is never mutated.
 */
export function validateAllowedActionSpaceV1(
  v: unknown
): ValidationResult<readonly AllowedActionV0[]> {
  if (!Array.isArray(v)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "allowed action space: expected array");
  }
  if (v.length > MAX_RELATION_ALLOWED_ACTIONS) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      `allowed action space: at most ${MAX_RELATION_ALLOWED_ACTIONS} actions`
    );
  }
  const seen = new Set<string>();
  const out: AllowedActionV0[] = [];
  for (let i = 0; i < v.length; i++) {
    const label = `allowed action space[${i}]`;
    const item = v[i];
    if (!isRecord(item)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
    }
    for (const key of Object.keys(item)) {
      if (!ACTION_KEYS.includes(key)) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.${key}: unknown key (closed shape)`);
      }
    }
    const actionType = validateCanonicalText(item["action_type"], `${label}.action_type`);
    if (!actionType.ok) return actionType;
    if (actionType.value.length === 0) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.action_type: must be nonempty`);
    }
    let targetRef: CanonicalRefV0 | null = null;
    if (item["target_ref"] !== null) {
      const target = validateRefElement(item["target_ref"], `${label}.target_ref`, TARGET_REF_KINDS);
      if (!target.ok) return target;
      targetRef = target.value;
    }
    const tupleKey = JSON.stringify([actionType.value, targetRef]);
    if (seen.has(tupleKey)) {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `${label}: exact duplicate action tuple (REJECT_EXACT_DUPLICATES_PRE_FINGERPRINT)`
      );
    }
    seen.add(tupleKey);
    out.push({ action_type: actionType.value, target_ref: targetRef });
  }
  out.sort(compareActionTuples);
  return ok(out);
}

/**
 * Deterministic action-space fingerprint over the canonical sorted tuple list
 * (ACTION_SPACE_FINGERPRINT_ORDER_POLICY:
 * ORDER_INSENSITIVE_CANONICAL_TUPLE_SORT_NULL_FIRST). Input must already be
 * validated + canonically sorted (see validateAllowedActionSpaceV1).
 */
export async function deriveCognitionActionSpaceFingerprintV1(
  canonicalActions: readonly AllowedActionV0[]
): Promise<HashV1> {
  return hashEnvelope(ACTION_SPACE_FINGERPRINT_PROJECTION, {
    schema_version: COGNITION_ACTION_SPACE_SCHEMA_VERSION,
    actions: canonicalActions.map((a) => ({ action_type: a.action_type, target_ref: a.target_ref }))
  });
}

/**
 * Deterministic accepted-proposal fingerprint. Binds ONLY the accepted schema,
 * host anchors and the FULL normalized proposal — never vendor metadata,
 * latency, wall clock, model identity or hidden reasoning. A pure derivation:
 * conferring NO authorization.
 */
export async function deriveAcceptedCognitionProposalFingerprintV1(input: {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly proposal: CognitionProposalV1;
}): Promise<HashV1> {
  return hashEnvelope(ACCEPTED_COGNITION_PROPOSAL_FINGERPRINT_PROJECTION, {
    schema_version: ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION,
    subject_id: input.subject_id,
    state_revision: input.state_revision,
    current_logical_time: input.current_logical_time,
    projection_hash: input.projection_hash,
    action_space_fingerprint: input.action_space_fingerprint,
    proposal: input.proposal
  });
}

/** Canonical relation comparator (frozen): domain → proposition_id → action_type → target (null first) → relation. */
function compareRelations(a: BeliefStateActionRelationV0, b: BeliefStateActionRelationV0): number {
  if (a.state_locator.domain < b.state_locator.domain) return -1;
  if (a.state_locator.domain > b.state_locator.domain) return 1;
  if (a.state_locator.proposition_id < b.state_locator.proposition_id) return -1;
  if (a.state_locator.proposition_id > b.state_locator.proposition_id) return 1;
  const tuple = compareActionTuples(a.action, b.action);
  if (tuple !== 0) return tuple;
  if (a.relation < b.relation) return -1;
  if (a.relation > b.relation) return 1;
  return 0;
}

/**
 * Closed-shape validation + normalization of an UNKNOWN provider payload as a
 * CognitionProposalV1 against the trusted host context. Deterministic
 * first-failure order (post-provider steps 2-17 of the frozen validation
 * order). Throws CognitionRelationRejectionErrorV1 with the exact stable code;
 * never strips, repairs, dedups or migrates values.
 *
 * INTERNAL: package admission layers only — never re-exported from the
 * runtime index.
 */
export async function validateAndNormalizeCognitionProposalV1(
  raw: unknown,
  context: {
    readonly projection: CognitiveContextProjectionV0;
    readonly canonical_actions: readonly AllowedActionV0[];
    readonly action_space_fingerprint: HashV1;
  }
): Promise<CognitionProposalV1> {
  // -- top-level closed schema ------------------------------------------------
  if (!isRecord(raw)) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1: expected object");
  if ("action_intent" in raw) {
    throw new CognitionRelationRejectionErrorV1(
      "MODEL_SCHEMA_INVALID",
      "cognition proposal v1.action_intent: forbidden in cognition-proposal-v1 (no final action)"
    );
  }
  for (const key of Object.keys(raw)) {
    if (!PROPOSAL_V1_KEYS.includes(key)) {
      throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `cognition proposal v1.${key}: unknown key (closed shape)`);
    }
  }

  // -- schema literal -----------------------------------------------------------
  if (raw["schema_version"] !== COGNITION_PROPOSAL_V1_SCHEMA_VERSION) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.schema_version: expected cognition-proposal-v1");
  }

  // -- field types ---------------------------------------------------------------
  if (!isString(raw["projection_hash"])) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.projection_hash: expected string");
  }
  const projectionHash = validateHash(raw["projection_hash"], "cognition proposal v1.projection_hash");
  if (!projectionHash.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", projectionHash.error.detail);

  if (!isString(raw["action_space_fingerprint"])) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.action_space_fingerprint: expected string");
  }
  const spaceFingerprint = validateHash(
    raw["action_space_fingerprint"],
    "cognition proposal v1.action_space_fingerprint"
  );
  if (!spaceFingerprint.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", spaceFingerprint.error.detail);

  const summary = validateCanonicalText(
    raw["reasoning_summary"],
    "cognition proposal v1.reasoning_summary"
  );
  if (!summary.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", summary.error.detail);

  let currentIntent: string | null = null;
  if (raw["current_intent"] !== null) {
    const intent = validateCanonicalText(raw["current_intent"], "cognition proposal v1.current_intent");
    if (!intent.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", intent.error.detail);
    currentIntent = intent.value;
  }

  if (!isNumber(raw["confidence"])) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.confidence: expected number");
  }
  const confidence = validateUnitInterval(raw["confidence"], "cognition proposal v1.confidence");
  if (!confidence.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", confidence.error.detail);

  if (!isNumber(raw["uncertainty"])) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.uncertainty: expected number");
  }
  const uncertainty = validateUnitInterval(raw["uncertainty"], "cognition proposal v1.uncertainty");
  if (!uncertainty.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", uncertainty.error.detail);

  // -- hard cardinality caps before expensive membership work ---------------------
  const rawRelations = raw["state_action_relations"];
  if (!Array.isArray(rawRelations)) {
    throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", "cognition proposal v1.state_action_relations: expected array");
  }
  if (rawRelations.length > MAX_STATE_ACTION_RELATIONS) {
    throw new CognitionRelationRejectionErrorV1(
      "MODEL_RELATION_LIMIT_EXCEEDED",
      `cognition proposal v1.state_action_relations: at most ${MAX_STATE_ACTION_RELATIONS} relations`
    );
  }
  // §7 cardinality against the bounded universes: relations.length <= min(64, B*A);
  // B=0 or A=0 forces the empty relation array. Cheap deterministic cap — runs
  // BEFORE expensive membership work (§41 step 6).
  const beliefCount = context.projection.belief_items.length;
  const actionCount = context.canonical_actions.length;
  const maxRelations = Math.min(MAX_STATE_ACTION_RELATIONS, beliefCount * actionCount);
  if (rawRelations.length > maxRelations) {
    throw new CognitionRelationRejectionErrorV1(
      "MODEL_RELATION_LIMIT_EXCEEDED",
      `cognition proposal v1.state_action_relations: ${rawRelations.length} relations exceed min(64, B*A) = ${maxRelations}`
    );
  }

  const refFieldNames = ["relevant_memory_refs", "considered_context_refs", "evidence_refs"] as const;
  const rawRefArrays: unknown[][] = [];
  for (const name of refFieldNames) {
    const value = raw[name];
    if (!Array.isArray(value)) {
      throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `cognition proposal v1.${name}: expected array`);
    }
    rawRefArrays.push(value);
  }

  // -- ref grammar + duplicate rejection (no dedup, no repair) -------------------
  const normalizedRefArrays: CanonicalRefV0[][] = [];
  for (let f = 0; f < refFieldNames.length; f++) {
    const name = refFieldNames[f] as string;
    const values = rawRefArrays[f] as unknown[];
    const refs: CanonicalRefV0[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < values.length; i++) {
      const label = `cognition proposal v1.${name}[${i}]`;
      const element = validateRefElement(values[i], label);
      if (!element.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", element.error.detail);
      if (seen.has(element.value)) {
        throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}: duplicate ref`);
      }
      seen.add(element.value);
      refs.push(element.value);
    }
    // Copy + canonical UTF-16 ascending sort; the model's array order has no
    // authority, but no value is dropped or repaired.
    normalizedRefArrays.push([...refs].sort());
  }

  // -- projection binding ---------------------------------------------------------
  if (projectionHash.value !== context.projection.projection_hash) {
    throw new CognitionRelationRejectionErrorV1(
      "MODEL_PROJECTION_MISMATCH",
      "cognition proposal v1 answers a different projection (stale or foreign projection_hash)"
    );
  }
  if (spaceFingerprint.value !== context.action_space_fingerprint) {
    throw new CognitionRelationRejectionErrorV1(
      "MODEL_ACTION_SPACE_MISMATCH",
      "cognition proposal v1 answers a different action space (action_space_fingerprint mismatch)"
    );
  }

  // -- exact allowedEvidenceSet membership for ALL three ref arrays ----------------
  const allowed = allowedEvidenceSet(context.projection);
  for (let f = 0; f < refFieldNames.length; f++) {
    const name = refFieldNames[f] as string;
    const values = rawRefArrays[f] as unknown[];
    for (let i = 0; i < values.length; i++) {
      const ref = values[i] as string;
      if (!allowed.has(ref)) {
        throw new CognitionRelationRejectionErrorV1(
          "MODEL_UNSUPPORTED_EVIDENCE",
          `cognition proposal v1.${name}[${i}]: ref is not in the allowed evidence set (no strip, no migration)`,
          ref
        );
      }
    }
  }

  // -- relations: nested closed schema, locators, exact tuples, pair uniqueness ----
  const beliefIds = new Set<string>(
    context.projection.belief_items.map((item) => item.proposition_id as string)
  );
  const actionTuples = new Set<string>(
    context.canonical_actions.map((a) => JSON.stringify([a.action_type, a.target_ref]))
  );
  const pairKeys = new Set<string>();
  const relations: BeliefStateActionRelationV0[] = [];

  for (let i = 0; i < rawRelations.length; i++) {
    const label = `cognition proposal v1.state_action_relations[${i}]`;
    const entry = rawRelations[i];
    if (!isRecord(entry)) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}: expected object`);
    for (const key of Object.keys(entry)) {
      if (!RELATION_KEYS.includes(key)) {
        const numeric = FORBIDDEN_NUMERIC_RELATION_FIELDS.includes(key);
        throw new CognitionRelationRejectionErrorV1(
          "MODEL_SCHEMA_INVALID",
          `${label}.${key}: ${numeric ? "forbidden numeric influence field" : "unknown key"} (closed shape)`
        );
      }
    }

    // state_locator: closed typed BELIEF locator object (never a CanonicalRefV0).
    const locator = entry["state_locator"];
    if (!isRecord(locator)) throw new CognitionRelationRejectionErrorV1("MODEL_INVALID_STATE_LOCATOR", `${label}.state_locator: expected object`);
    for (const key of Object.keys(locator)) {
      if (!LOCATOR_KEYS.includes(key)) {
        throw new CognitionRelationRejectionErrorV1(
          "MODEL_INVALID_STATE_LOCATOR",
          `${label}.state_locator.${key}: unknown key (closed shape; model holds no belief label authority)`
        );
      }
    }
    if (locator["domain"] !== "BELIEF") {
      throw new CognitionRelationRejectionErrorV1("MODEL_INVALID_STATE_LOCATOR", `${label}.state_locator.domain: expected "BELIEF"`);
    }
    if (!isString(locator["proposition_id"])) {
      throw new CognitionRelationRejectionErrorV1("MODEL_INVALID_STATE_LOCATOR", `${label}.state_locator.proposition_id: expected string`);
    }
    const propositionId = validateIdentifier(
      locator["proposition_id"],
      `${label}.state_locator.proposition_id`
    );
    if (!propositionId.ok) throw new CognitionRelationRejectionErrorV1("MODEL_INVALID_STATE_LOCATOR", propositionId.error.detail);

    // exact membership in the bounded projected belief_items (no item 65+).
    if (!beliefIds.has(propositionId.value)) {
      throw new CognitionRelationRejectionErrorV1(
        "MODEL_UNKNOWN_PROPOSITION",
        `${label}: proposition_id is not an exactly projected belief item`,
        propositionId.value
      );
    }

    // action: closed shape + EXACT_TUPLE membership (never V0 loose matching).
    const action = entry["action"];
    if (!isRecord(action)) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}.action: expected object`);
    for (const key of Object.keys(action)) {
      if (!ACTION_KEYS.includes(key)) {
        throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}.action.${key}: unknown key (closed shape)`);
      }
    }
    const actionType = validateCanonicalText(action["action_type"], `${label}.action.action_type`);
    if (!actionType.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", actionType.error.detail);
    if (actionType.value.length === 0) {
      throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}.action.action_type: must be nonempty`);
    }
    let targetRef: CanonicalRefV0 | null = null;
    if (action["target_ref"] !== null) {
      const target = validateRefElement(action["target_ref"], `${label}.action.target_ref`, TARGET_REF_KINDS);
      if (!target.ok) throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", target.error.detail);
      targetRef = target.value;
    }
    const tupleKey = JSON.stringify([actionType.value, targetRef]);
    if (!actionTuples.has(tupleKey)) {
      throw new CognitionRelationRejectionErrorV1(
        "MODEL_ACTION_NOT_ALLOWED",
        `${label}: action tuple is not an exact member of the host action universe (EXACT_TUPLE)`,
        targetRef
      );
    }

    // relation value.
    const relationValue = entry["relation"];
    if (
      !isString(relationValue) ||
      !BELIEF_STATE_ACTION_RELATION_KINDS.includes(relationValue as BeliefStateActionRelationKindV0)
    ) {
      throw new CognitionRelationRejectionErrorV1("MODEL_SCHEMA_INVALID", `${label}.relation: expected SUPPORTS|OPPOSES|IRRELEVANT`);
    }

    // pair uniqueness: at most one relation per (proposition_id + exact tuple).
    const pairKey = JSON.stringify([propositionId.value, actionType.value, targetRef]);
    if (pairKeys.has(pairKey)) {
      throw new CognitionRelationRejectionErrorV1(
        "MODEL_DUPLICATE_RELATION_PAIR",
        `${label}: duplicate relation for the same (proposition_id, action tuple) pair (no dedup, no last-write-wins)`
      );
    }
    pairKeys.add(pairKey);

    relations.push({
      state_locator: { domain: "BELIEF", proposition_id: propositionId.value },
      action: { action_type: actionType.value, target_ref: targetRef },
      relation: relationValue as BeliefStateActionRelationKindV0
    });
  }

  // -- normalized construction: canonical relation order, copies, freeze -----------
  relations.sort(compareRelations);
  const normalized: CognitionProposalV1 = {
    schema_version: COGNITION_PROPOSAL_V1_SCHEMA_VERSION,
    projection_hash: projectionHash.value,
    action_space_fingerprint: spaceFingerprint.value,
    reasoning_summary: summary.value,
    relevant_memory_refs: normalizedRefArrays[0] as readonly CanonicalRefV0[],
    considered_context_refs: normalizedRefArrays[1] as readonly CanonicalRefV0[],
    current_intent: currentIntent,
    confidence: confidence.value,
    uncertainty: uncertainty.value,
    state_action_relations: relations,
    evidence_refs: normalizedRefArrays[2] as readonly CanonicalRefV0[]
  };
  deepFreeze(normalized);
  return normalized;
}

/** Recursive structural freeze (local helper; repository convention). */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
