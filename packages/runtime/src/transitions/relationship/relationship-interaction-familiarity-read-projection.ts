/**
 * Interaction Familiarity Read Projection V0
 * (INTERACTION_FAMILIARITY_READ_PROJECTION_V0, READ-ONLY).
 *
 * The narrow semantic read surface through which the already-real, already-
 * persistent canonical interaction familiarity state becomes cognition-visible:
 *
 *   canonical Relationship state
 *   → exact admitted interaction-familiarity semantic resolution
 *   → deterministic read projection
 *
 * READ-ONLY LAW: this module reads canonical current state and validates it;
 * it NEVER mutates Relationship state and exposes NO mutation token, writer
 * authority, history capability, receipt issuer or commit capability. No
 * caller-supplied Relationship snapshot becomes authority — the caller passes
 * the authoritative canonical snapshot it read through the trusted read
 * surface, and the projection validates its exact shape before use.
 *
 * EXACT FEATURE SCOPE: exactly ONE governed feature is projected
 * (relationship_core_interaction_familiarity_v0 under the pinned admitted
 * semantics relationship-interaction-familiarity-semantics-v0). Opaque generic
 * Relationship dimensions gain NO governed semantics; caller-selected
 * semantics are impossible (the admitted binding is resolved internally and
 * the projection fails closed when it cannot resolve exactly).
 *
 * ABSENCE LAW: ABSENT != PRESENT 0. ABSENT projects nulls; PRESENT must be a
 * LAWFUL familiarity value (on the k/32 credit grid with k >= 1 — PRESENT 0 is
 * an unlawful state, not an absence). Malformed/off-grid present state FAILS
 * CLOSED: no coercion, no rounding, no silent conversion to ABSENT.
 *
 * STATE_VISIBLE_NOT_CITEABLE: familiarity is subjective canonical state
 * context — credited firsthand interaction history under the frozen V0 policy.
 * It is NOT factual event evidence: it implies nothing about what a counterpart
 * said or did in any specific instance, and nothing about trust, liking,
 * safety, intimacy, affection, agreement, compliance, disclosure willingness,
 * reliability or predictability. It is unsigned: no utility, no preference, no
 * action polarity, no Belief tendency combination. Citeable factual content
 * still comes exclusively from Memory retrieval. The projection carries no
 * episode/evidence/authority refs.
 *
 * DETERMINISM: same canonical state + same revision + same counterpart +
 * same admitted semantics → the exact same projection (pure derivation, zero
 * model calls). The cognitive context projection_hash binds the projection
 * content — changed revision/counterpart/presence/value changes it.
 */

import type {
  CanonicalRefV0,
  IdentifierV0,
  StateRevisionV0,
  SubjectStateV0
} from "@characteros-next/subject-core";

import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0
} from "./relationship-feature-decision-semantics.js";
import {
  classifyInteractionFamiliarityGridValueV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0
} from "./relationship-interaction-familiarity-accrual-policy.js";

export const RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_SCHEMA_VERSION_V0 =
  "relationship-interaction-familiarity-read-projection-v0" as const;

/** Familiarity is state-visible subjective context, never citeable evidence. */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_VISIBILITY_V0 =
  "STATE_VISIBLE_NOT_CITEABLE" as const;

/**
 * The exact read-projection contract. Closed 13-field shape; no extra fields.
 * canonical_value/ordinal_level are null EXACTLY when presence is ABSENT.
 */
export interface RelationshipInteractionFamiliarityReadProjectionV0 {
  readonly schema_version: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  readonly source_state_revision: StateRevisionV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: typeof INTERACTION_FAMILIARITY_DIMENSION_ID_V0;
  readonly feature_semantics_contract_id: typeof INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0;
  readonly feature_semantics_contract_fingerprint: typeof INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0;
  readonly quantity_semantics_id: IdentifierV0;
  readonly presence: "ABSENT" | "PRESENT";
  readonly canonical_value: number | null;
  readonly ordinal_level: number | null;
  readonly ordinal_max: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0;
  readonly visibility: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_VISIBILITY_V0;
}

export type InteractionFamiliarityReadProjectionRejectionCodeV0 =
  | "FEATURE_SEMANTICS_UNRESOLVED"
  | "MALFORMED_RELATIONSHIP_STATE"
  | "COUNTERPART_NOT_REGISTERED"
  | "FAMILIARITY_STATE_MALFORMED";

export type InteractionFamiliarityReadProjectionResultV0 =
  | { readonly ok: true; readonly projection: RelationshipInteractionFamiliarityReadProjectionV0 }
  | { readonly ok: false; readonly code: InteractionFamiliarityReadProjectionRejectionCodeV0; readonly detail: string };

function fail(
  code: InteractionFamiliarityReadProjectionRejectionCodeV0,
  detail: string
): InteractionFamiliarityReadProjectionResultV0 {
  return { ok: false, code, detail };
}

/**
 * Derives the counterpart-specific interaction-familiarity read projection
 * from the authoritative canonical snapshot. Pure, deterministic, read-only;
 * fails closed on unresolved semantics, unreadable Relationship state,
 * unregistered counterparts and any malformed familiarity value.
 */
export async function deriveInteractionFamiliarityReadProjectionV0(input: {
  readonly subjectState: SubjectStateV0;
  readonly counterpart_ref: CanonicalRefV0;
}): Promise<InteractionFamiliarityReadProjectionResultV0> {
  // 1. Bind the EXACT admitted feature semantics (caller-selected semantics
  //    are impossible: the binding is resolved internally, fail closed).
  let quantitySemanticsId: IdentifierV0;
  try {
    const contract = resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
      domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
      source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
      dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
      feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
      feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
    });
    quantitySemanticsId = contract.quantity_semantics_id;
  } catch {
    return fail(
      "FEATURE_SEMANTICS_UNRESOLVED",
      "the admitted interaction-familiarity semantics could not be resolved exactly; projection fails closed"
    );
  }

  // 2. Structural read of the canonical Relationship block (fail closed on
  //    unreadable shapes; no text parsing).
  const relationships = (input.subjectState as unknown as Record<string, unknown>)["relationships"];
  if (typeof relationships !== "object" || relationships === null) {
    return fail("MALFORMED_RELATIONSHIP_STATE", "relationships: expected object");
  }
  const counterparts = (relationships as Record<string, unknown>)["counterparts"];
  if (!Array.isArray(counterparts)) {
    return fail("MALFORMED_RELATIONSHIP_STATE", "relationships.counterparts: expected array");
  }
  const counterpart = counterparts.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as Record<string, unknown>)["counterpart_ref"] === input.counterpart_ref
  );
  if (counterpart === undefined) {
    return fail(
      "COUNTERPART_NOT_REGISTERED",
      `counterpart ${input.counterpart_ref} is not canonically registered; the existing closed Relationship read behavior applies (no auto-registration)`
    );
  }
  const dimensions = (counterpart as Record<string, unknown>)["dimensions"];
  if (!Array.isArray(dimensions)) {
    return fail("MALFORMED_RELATIONSHIP_STATE", "counterpart.dimensions: expected array");
  }
  const familiarityEntries = dimensions.filter(
    (dimension) =>
      typeof dimension === "object" &&
      dimension !== null &&
      (dimension as Record<string, unknown>)["dimension_id"] === INTERACTION_FAMILIARITY_DIMENSION_ID_V0
  );
  if (familiarityEntries.length > 1) {
    return fail(
      "FAMILIARITY_STATE_MALFORMED",
      `at most one familiarity dimension entry is lawful, found ${familiarityEntries.length}`
    );
  }

  // 3. Presence resolution — ABSENT != PRESENT 0; malformed present fails closed.
  let presence: "ABSENT" | "PRESENT";
  let canonicalValue: number | null;
  let ordinalLevel: number | null;
  if (familiarityEntries.length === 0) {
    presence = "ABSENT";
    canonicalValue = null;
    ordinalLevel = null;
  } else {
    const entry = familiarityEntries[0] as Record<string, unknown>;
    const rawValue = entry["value"];
    if (typeof rawValue !== "number") {
      return fail("FAMILIARITY_STATE_MALFORMED", "familiarity value: expected a finite number");
    }
    const grid = classifyInteractionFamiliarityGridValueV0(rawValue);
    if (!grid.ok) {
      return fail("FAMILIARITY_STATE_MALFORMED", `familiarity value: ${grid.detail}`);
    }
    if (grid.k < 1) {
      return fail(
        "FAMILIARITY_STATE_MALFORMED",
        "PRESENT 0 is an unlawful familiarity state (ABSENT is the representation of no credited interaction); fail closed"
      );
    }
    presence = "PRESENT";
    canonicalValue = rawValue;
    ordinalLevel = grid.k;
  }

  const projection: RelationshipInteractionFamiliarityReadProjectionV0 = {
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_SCHEMA_VERSION_V0,
    subject_id: input.subjectState.identity.subject_id,
    source_state_revision: input.subjectState.runtime_metadata.state_revision,
    counterpart_ref: input.counterpart_ref,
    dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
    quantity_semantics_id: quantitySemanticsId,
    presence,
    canonical_value: canonicalValue,
    ordinal_level: ordinalLevel,
    ordinal_max: RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0,
    visibility: RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_VISIBILITY_V0
  };
  deepFreeze(projection);
  return { ok: true, projection };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
