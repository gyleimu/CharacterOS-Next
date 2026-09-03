/**
 * Relationship Interaction Familiarity Accrual Policy V0 — the ONE exact
 * feature-specific canonical law for the FIRST admitted governed Relationship
 * feature (RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1,
 * INTERACTION_FAMILIARITY_ONLY).
 *
 * This is NOT a generic Relationship dynamics engine, NOT a feature calculus,
 * NOT a plugin law platform: exactly one feature, one law, one exact path.
 *
 * CANONICAL VALUE LAW (§7): familiarity uses UnitIntervalV0 but lawful values
 * occupy only the grid G = { k / 32 | integer k, 0 <= k <= 32 } (exact
 * binary-safe arithmetic: k/32 is exactly representable and v*32 is exact for
 * powers of two, so no epsilon is needed and no rounding/interpolation exists).
 *
 *   ABSENT != PRESENT 0 — production familiarity is never initialized at 0.
 *   First lawful credited interaction:  ABSENT → 1/32
 *   Subsequent lawful updates:          k/32 → (k+1)/32, one credit per receipt
 *   Saturation:                          |R| >= 32 → NO_PROPOSAL / no mutation
 *   No downward transition. No equal-value update. No arbitrary value.
 *   Off-grid / NaN / Infinity / negative / >1 rejected.
 *
 * MONOTONICITY (§8): monotonic non-decreasing — credited firsthand interaction
 * history models neither recency nor memory accessibility, so decay, forgetting
 * and retrieval failure are NOT familiarity decrements. Removal and decrease
 * are unsupported; REINITIALIZE is not authorized by ordinary familiarity V0.
 *
 * ACCRUAL (§10): with R_prev the cumulative raw-ASCII-sorted unique admitted
 * receipt set of the latest valid governed familiarity authority and r one
 * newly admitted receipt ref: r not in R_prev, R_next = sort(unique(R_prev ∪
 * {r})), |R_next| = |R_prev| + 1, next_value = |R_next| / 32. No caller-supplied
 * value, duration, salience, novelty, emotional magnitude, confidence or
 * importance can alter the increment: each admitted receipt contributes
 * exactly one V0 credit.
 *
 * The SAME law validates LIVE governed preparation (the runtime service calls
 * the live derivation) and HISTORICAL writer-authority resolution (the static
 * historical resolver calls the single-record law), so both surfaces agree on
 * whether a familiarity authority is lawful.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";

import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "./relationship-feature-decision-semantics.js";
import { isRelationshipInteractionFamiliarityEvidenceReceiptRefV0 } from "./relationship-interaction-familiarity-evidence-receipt.js";
import type { RelationshipGovernedFeatureWriterAuthorityPayloadV0 } from "./relationship-governed-writer-authority.js";

export const RELATIONSHIP_INTERACTION_FAMILIARITY_ACCRUAL_POLICY_ID_V0 =
  "relationship-interaction-familiarity-accrual-policy-v0" as const;

/** Familiarity credit grid denominator: lawful values are exactly k/32. */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0 = 32;

// ---- grid classification ---------------------------------------------------------------

export type InteractionFamiliarityGridClassificationV0 =
  | { readonly ok: true; readonly k: number }
  | { readonly ok: false; readonly detail: string };

/**
 * Exact binary-safe grid classification: ok with k = value*32 iff value is a
 * finite number in [0,1] on the k/32 grid; otherwise rejected. NaN, Infinity,
 * negative, >1 and off-grid values never classify.
 */
export function classifyInteractionFamiliarityGridValueV0(
  value: unknown
): InteractionFamiliarityGridClassificationV0 {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, detail: `familiarity value must be a finite number, got ${String(value)}` };
  }
  if (value < 0 || value > 1) {
    return { ok: false, detail: `familiarity value must lie in [0,1], got ${String(value)}` };
  }
  const k = value * RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0;
  if (!Number.isInteger(k)) {
    return { ok: false, detail: `familiarity value ${String(value)} is off the k/32 credit grid` };
  }
  return { ok: true, k };
}

/** Exact grid value for credit count k (k assumed 0..32; caller derives k lawfully). */
export function interactionFamiliarityGridValueV0(k: number): number {
  return k / RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0;
}

// ---- shared rejection taxonomy -----------------------------------------------------------

export type InteractionFamiliarityLawRejectionCodeV0 =
  | "FAMILIARITY_SATURATED_NO_PROPOSAL"
  | "FAMILIARITY_DUPLICATE_RECEIPT"
  | "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH"
  | "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF"
  | "FAMILIARITY_PRIOR_VALUE_MISMATCH"
  | "FAMILIARITY_VALUE_LAW_MISMATCH"
  | "FAMILIARITY_PRIOR_LINEAGE_MISMATCH"
  | "FAMILIARITY_PRIOR_LINEAGE_MALFORMED"
  | "FAMILIARITY_OFF_GRID_VALUE"
  | "FAMILIARITY_REINITIALIZE_UNSUPPORTED"
  | "FAMILIARITY_DIMENSION_MISMATCH";

export type InteractionFamiliarityLawRejectionV0 = {
  readonly ok: false;
  readonly code: InteractionFamiliarityLawRejectionCodeV0;
  readonly detail: string;
};

function reject(code: InteractionFamiliarityLawRejectionCodeV0, detail: string): InteractionFamiliarityLawRejectionV0 {
  return { ok: false, code, detail };
}

/** Strictly ascending raw-ASCII unique receipt-ref set check. */
function receiptsSortedUnique(refs: readonly CanonicalRefV0[]): boolean {
  for (let i = 0; i < refs.length; i++) {
    if (!isRelationshipInteractionFamiliarityEvidenceReceiptRefV0(refs[i])) return false;
    if (i > 0 && !((refs[i] as string) > (refs[i - 1] as string))) return false;
  }
  return true;
}

// ---- live derivation (the ONE lawful transition path) -------------------------------------

export type InteractionFamiliarityAccrualDerivationV0 =
  | {
      readonly ok: true;
      /** R_next — the cumulative raw-ASCII-sorted unique admitted receipt set. */
      readonly receipt_refs: readonly CanonicalRefV0[];
      /** |R_next| — the lawful credit count after this transition. */
      readonly k: number;
      /** The lawful next canonical value |R_next|/32. */
      readonly next_value: number;
    }
  | InteractionFamiliarityLawRejectionV0;

/**
 * INITIALIZE derivation: exactly ONE lawful receipt ref exists → next is
 * exactly 1/32. ABSENT is never initialized at 0; zero receipts, multiple
 * receipts or a non-receipt ref are rejected.
 */
export function deriveInteractionFamiliarityInitializationV0(input: {
  readonly evidence_receipt_refs: readonly CanonicalRefV0[];
}): InteractionFamiliarityAccrualDerivationV0 {
  const refs = input.evidence_receipt_refs;
  if (refs.length !== 1) {
    return reject(
      "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      `INITIALIZE requires exactly one familiarity evidence receipt ref, got ${refs.length}`
    );
  }
  if (!isRelationshipInteractionFamiliarityEvidenceReceiptRefV0(refs[0])) {
    return reject(
      "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF",
      "INITIALIZE evidence must be a familiarity evidence receipt ref (a raw episode ref is not a credit)"
    );
  }
  return { ok: true, receipt_refs: [refs[0] as CanonicalRefV0], k: 1, next_value: interactionFamiliarityGridValueV0(1) };
}

/**
 * UPDATE derivation (§10): R_prev is the prior authority's cumulative receipt
 * set; the proposed set must equal sort(unique(R_prev ∪ {r})) for exactly one
 * new receipt ref r. Saturation (|R_prev| >= 32) produces NO lawful proposal;
 * a duplicate receipt (no new credit), a dropped prior receipt, a set-size
 * mismatch, a non-receipt ref or a previous value that disagrees with |R_prev|/32
 * are all rejected. No caller-supplied next value participates in the
 * derivation.
 */
export function deriveInteractionFamiliarityUpdateV0(input: {
  readonly prior_receipt_refs: readonly CanonicalRefV0[];
  readonly proposed_receipt_refs: readonly CanonicalRefV0[];
  readonly previous_value: number;
}): InteractionFamiliarityAccrualDerivationV0 {
  const prior = input.prior_receipt_refs;
  const proposed = input.proposed_receipt_refs;
  if (prior.length === 0 || !receiptsSortedUnique(prior)) {
    return reject(
      "FAMILIARITY_PRIOR_LINEAGE_MALFORMED",
      "the prior familiarity authority's cumulative receipt set is empty or not sorted/unique receipt refs"
    );
  }
  const priorK = prior.length;
  if (priorK >= RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0) {
    return reject(
      "FAMILIARITY_SATURATED_NO_PROPOSAL",
      `familiarity credit is saturated at ${priorK}/32; additional qualifying evidence produces NO familiarity proposal`
    );
  }
  const previousGrid = classifyInteractionFamiliarityGridValueV0(input.previous_value);
  if (!previousGrid.ok) {
    return reject("FAMILIARITY_OFF_GRID_VALUE", `previous value: ${previousGrid.detail}`);
  }
  if (previousGrid.k !== priorK) {
    return reject(
      "FAMILIARITY_PRIOR_VALUE_MISMATCH",
      `previous canonical value ${String(input.previous_value)} (k=${previousGrid.k}) does not equal |R_prev|/32 (k=${priorK})`
    );
  }
  if (!receiptsSortedUnique(proposed)) {
    return reject(
      "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      "proposed receipt refs must be unique, raw-ASCII sorted familiarity receipt refs"
    );
  }
  const proposedSet = new Set<string>(proposed as readonly string[]);
  if (proposed.length === priorK) {
    const sameSet = prior.every((ref) => proposedSet.has(ref));
    return reject(
      sameSet ? "FAMILIARITY_DUPLICATE_RECEIPT" : "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      sameSet
        ? "the proposed cumulative set re-uses the prior set (duplicate evidence produces no lawful update)"
        : "the proposed cumulative set breaks receipt-set continuity (dropped prior receipt)"
    );
  }
  if (proposed.length !== priorK + 1) {
    return reject(
      "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      `|R_next| must be |R_prev|+1 (${priorK}+1), got ${proposed.length}`
    );
  }
  for (const ref of prior) {
    if (!proposedSet.has(ref)) {
      return reject(
        "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
        "the proposed cumulative set dropped a prior admitted receipt"
      );
    }
  }
  const priorSet = new Set<string>(prior as readonly string[]);
  const added = proposed.filter((ref) => !priorSet.has(ref));
  if (added.length === 0) {
    return reject(
      "FAMILIARITY_DUPLICATE_RECEIPT",
      "the proposed evidence adds no new receipt (duplicate evidence produces no lawful update)"
    );
  }
  if (added.length > 1) {
    return reject(
      "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      `exactly one new receipt ref is supported per update, got ${added.length}`
    );
  }
  return {
    ok: true,
    receipt_refs: proposed,
    k: priorK + 1,
    next_value: interactionFamiliarityGridValueV0(priorK + 1)
  };
}

// ---- live governed preparation law (runtime service hook) ----------------------------------

export type InteractionFamiliarityLiveLawCheckV0 =
  | {
      readonly ok: true;
      /** R_next — the lawful cumulative receipt set for the prepared authority. */
      readonly receipt_refs: readonly CanonicalRefV0[];
      /** The lawful next credit count |R_next|. */
      readonly k: number;
    }
  | InteractionFamiliarityLawRejectionV0;

/**
 * The ONE live familiarity transition law, enforced by the runtime governed
 * write service BEFORE any receipt/capability work is finalized. The caller's
 * proposed next canonical value is only ACCEPTED when it EXACTLY equals the
 * law-derived |R_next|/32 — no caller-supplied arbitrary value can bypass the
 * derivation. REINITIALIZE is not authorized by ordinary familiarity V0.
 */
export function enforceInteractionFamiliarityLiveLawV0(input: {
  readonly operation: "INITIALIZE" | "UPDATE" | "REINITIALIZE";
  readonly previous: { readonly kind: "ABSENT" } | { readonly kind: "PRESENT"; readonly value: number };
  readonly next: { readonly kind: "PRESENT"; readonly value: number };
  readonly proposed_receipt_refs: readonly CanonicalRefV0[];
  readonly prior:
    | { readonly kind: "NONE" }
    | { readonly kind: "PRIOR"; readonly receipt_refs: readonly CanonicalRefV0[] };
}): InteractionFamiliarityLiveLawCheckV0 {
  if (input.operation === "REINITIALIZE") {
    return reject(
      "FAMILIARITY_REINITIALIZE_UNSUPPORTED",
      "REINITIALIZE is not authorized by ordinary interaction-familiarity V0"
    );
  }
  const nextGrid = classifyInteractionFamiliarityGridValueV0(input.next.value);
  if (!nextGrid.ok) {
    return reject("FAMILIARITY_OFF_GRID_VALUE", `next value: ${nextGrid.detail}`);
  }
  if (input.operation === "INITIALIZE") {
    if (input.prior.kind !== "NONE") {
      return reject(
        "FAMILIARITY_PRIOR_LINEAGE_MISMATCH",
        "INITIALIZE requires no prior governed familiarity lineage"
      );
    }
    if (input.previous.kind !== "ABSENT") {
      return reject(
        "FAMILIARITY_VALUE_LAW_MISMATCH",
        "INITIALIZE requires the familiarity target to be ABSENT (ABSENT is never PRESENT 0)"
      );
    }
    const derived = deriveInteractionFamiliarityInitializationV0({
      evidence_receipt_refs: input.proposed_receipt_refs
    });
    if (!derived.ok) return derived;
    if (nextGrid.k !== derived.k) {
      return reject(
        "FAMILIARITY_VALUE_LAW_MISMATCH",
        `INITIALIZE must produce exactly 1/32; the proposed next value is k=${nextGrid.k}`
      );
    }
    return { ok: true, receipt_refs: derived.receipt_refs, k: derived.k };
  }
  // UPDATE
  if (input.prior.kind !== "PRIOR") {
    return reject(
      "FAMILIARITY_PRIOR_LINEAGE_MISMATCH",
      "UPDATE requires the latest valid governed familiarity authority (a present target without one is not a lawful bootstrap)"
    );
  }
  if (input.previous.kind !== "PRESENT") {
    return reject(
      "FAMILIARITY_VALUE_LAW_MISMATCH",
      "UPDATE requires a PRESENT previous canonical familiarity value"
    );
  }
  const derived = deriveInteractionFamiliarityUpdateV0({
    prior_receipt_refs: input.prior.receipt_refs,
    proposed_receipt_refs: input.proposed_receipt_refs,
    previous_value: input.previous.value
  });
  if (!derived.ok) return derived;
  if (nextGrid.k !== derived.k) {
    return reject(
      "FAMILIARITY_VALUE_LAW_MISMATCH",
      `the proposed next value k=${nextGrid.k} does not equal the law-derived |R_next|/32 (k=${derived.k})`
    );
  }
  return { ok: true, receipt_refs: derived.receipt_refs, k: derived.k };
}

// ---- historical single-record law (static resolver hook) ------------------------------------

export type InteractionFamiliarityAuthorityLawCheckV0 =
  | { readonly ok: true }
  | InteractionFamiliarityLawRejectionV0;

/**
 * The ONE single-record historical familiarity law, enforced by the static
 * historical writer-authority resolver AFTER the feature layer admits the
 * exact semantics binding. Checks exactly what one durable record can prove:
 *
 *   - every evidence ref is a familiarity receipt ref (a raw episode ref is
 *     never a credit)
 *   - next value on the k/32 grid
 *   - INITIALIZE: |R_next| = 1, next = 1/32, prior lineage NONE
 *   - UPDATE:     prior lineage PRIOR, 2 <= |R_next| <= 32,
 *                 next = |R_next|/32, previous = (|R_next|-1)/32
 *   - REINITIALIZE: unsupported (never lawful for familiarity V0)
 *
 * Cross-record continuation (prior commit_ref / payload-hash binding, canonical
 * predecessor equality, no-other-member diff) remains the chain validator's
 * frozen stages — unchanged by this slice.
 */
export function validateInteractionFamiliarityAuthorityLawV0(
  payload: RelationshipGovernedFeatureWriterAuthorityPayloadV0
): InteractionFamiliarityAuthorityLawCheckV0 {
  if (payload.dimension_id !== INTERACTION_FAMILIARITY_DIMENSION_ID_V0) {
    return reject(
      "FAMILIARITY_DIMENSION_MISMATCH",
      `the familiarity law only governs ${INTERACTION_FAMILIARITY_DIMENSION_ID_V0}`
    );
  }
  for (const ref of payload.evidence_receipt_refs) {
    if (!isRelationshipInteractionFamiliarityEvidenceReceiptRefV0(ref)) {
      return reject(
        "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF",
        `evidence ref ${ref} is not a familiarity evidence receipt ref (a raw episode ref is not a credit)`
      );
    }
  }
  const nextGrid = classifyInteractionFamiliarityGridValueV0(payload.next.value);
  if (!nextGrid.ok) {
    return reject("FAMILIARITY_OFF_GRID_VALUE", `next value: ${nextGrid.detail}`);
  }
  const priorKind = payload.previous_governed_authority.kind;
  if (payload.operation_kind === "REINITIALIZE") {
    return reject(
      "FAMILIARITY_REINITIALIZE_UNSUPPORTED",
      "REINITIALIZE is not authorized by ordinary interaction-familiarity V0"
    );
  }
  if (payload.operation_kind === "INITIALIZE") {
    if (payload.evidence_receipt_refs.length !== 1) {
      return reject(
        "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
        `INITIALIZE requires exactly one familiarity receipt ref, got ${payload.evidence_receipt_refs.length}`
      );
    }
    if (priorKind !== "NONE") {
      return reject(
        "FAMILIARITY_PRIOR_LINEAGE_MISMATCH",
        "INITIALIZE requires previous_governed_authority NONE"
      );
    }
    if (nextGrid.k !== 1) {
      return reject(
        "FAMILIARITY_VALUE_LAW_MISMATCH",
        `INITIALIZE must produce exactly 1/32, got k=${nextGrid.k}`
      );
    }
    return { ok: true };
  }
  // UPDATE
  if (priorKind !== "PRIOR") {
    return reject(
      "FAMILIARITY_PRIOR_LINEAGE_MISMATCH",
      "UPDATE requires previous_governed_authority PRIOR"
    );
  }
  const k = payload.evidence_receipt_refs.length;
  if (k < 2 || k > RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0) {
    return reject(
      "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH",
      `UPDATE requires 2..32 cumulative receipts, got ${k}`
    );
  }
  if (nextGrid.k !== k) {
    return reject(
      "FAMILIARITY_VALUE_LAW_MISMATCH",
      `next value must equal |R_next|/32 (k=${k}), got k=${nextGrid.k}`
    );
  }
  if (payload.previous.kind !== "PRESENT") {
    return reject(
      "FAMILIARITY_VALUE_LAW_MISMATCH",
      "UPDATE requires a PRESENT previous canonical familiarity value"
    );
  }
  const previousGrid = classifyInteractionFamiliarityGridValueV0(payload.previous.value);
  if (!previousGrid.ok) {
    return reject("FAMILIARITY_OFF_GRID_VALUE", `previous value: ${previousGrid.detail}`);
  }
  if (previousGrid.k !== k - 1) {
    return reject(
      "FAMILIARITY_PRIOR_VALUE_MISMATCH",
      `previous canonical value must equal (|R_next|-1)/32 (k=${k - 1}), got k=${previousGrid.k}`
    );
  }
  return { ok: true };
}
