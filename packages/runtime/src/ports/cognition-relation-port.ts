/**
 * Belief Decision Influence Relation Foundation V0 — CognitionRelationProviderV1
 * port (frozen architecture §16).
 *
 * The port is the untrusted semantic provider boundary for the V1 relation
 * chain. Providers receive a host-validated, deep-copied, deep-frozen input
 * binding the controlled projection, the canonical sorted action universe and
 * its fingerprint, and return ONE parsed unknown payload. Providers hold NO
 * validation authority, NO capability authority, NO fingerprint authority and
 * NO SubjectCore mutation authority — admission is host-owned.
 */

import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";

import type { AllowedActionV0, CognitiveContextProjectionV0 } from "../transitions/cognition-action/types.js";

export const COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION =
  "cognition-relation-provider-input-v1" as const;

/**
 * Frozen provider input: copied/deep-frozen BEFORE provider use. The allowed
 * evidence refs are pre-sorted from the same executable authority the
 * production validator enforces (allowedEvidenceSet) — no second algorithm.
 */
export interface CognitionRelationProviderInputV1 {
  readonly schema_version: typeof COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION;
  readonly projection: CognitiveContextProjectionV0;
  readonly canonical_actions: readonly AllowedActionV0[];
  readonly action_space_fingerprint: HashV1;
  readonly allowed_evidence_refs: readonly CanonicalRefV0[];
}

/** Untrusted semantic provider boundary: at most ONE call per admission. */
export interface CognitionRelationProviderV1 {
  propose(input: CognitionRelationProviderInputV1): Promise<unknown>;
}
