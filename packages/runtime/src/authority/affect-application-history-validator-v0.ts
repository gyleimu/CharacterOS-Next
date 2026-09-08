/**
 * CANONICAL_AFFECT_APPLICATION_V0 — AffectApplication receipt history
 * validator.
 *
 * The successful AtomicCommitBundleV2 of an AffectApplication transition IS
 * the durable consumption receipt (JOURNAL_DERIVED; no second consumption
 * ledger, no consumed flag, no post-commit marker). This validator proves a
 * claimed receipt BEFORE the AffectEventAuthority counts it as
 * CANONICAL_APPLIED. Every check is recomputation from trusted history and
 * canonical state — never caller assertion:
 *
 *   V2 bundle + exact transition type/subject + v4 predecessor & successor
 *   + BOUNDED_AFFECT_DYNAMICS_V0/tick profile + exactly one affect/affect
 *   delta carrying exactly one /affect SET + the deterministic sorted causal
 *   chain (appraisal_ref, factual_event_ref, source_observation_ref)
 *   + disposition = APPRAISED at the current head (no conflicting abstention)
 *   + eligibility / execution identities and the transition id recompute
 *   + Observation grounding (sequence + refs) matches the committed bundle
 *   + impulse recomputation from the predecessor Affect is EXACTLY the
 *     successor Affect (zero-impulse and saturation identity commits are
 *     VALID receipts — equality never implies non-consumption)
 *   + every other domain byte-identical across the commit
 *
 * Malformed claimed receipt → INTEGRITY_CONFLICT, never pending.
 */

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalAffectV0,
  HashV1,
  RepositoryRevisionIdV0
} from "@characteros-next/subject-core";
import {
  canonicalJsonString,
  hashEnvelope,
  stateHashAnyVersion,
  validateCanonicalAffectShape
} from "@characteros-next/subject-core";
import { applyAffectImpulseV0, deriveAffectImpulseV0 } from "@characteros-next/affect";
import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import { resolveInitialAppraisalDispositionForFactualEventV0 } from "../factual-event-appraisal/factual-event-appraisal-disposition-reader.js";
import { deriveAffectEligibilityIdentityV0 } from "./affect-event-authority-v0.js";

export const AFFECT_APPLICATION_TRANSITION_TYPE_V0 = "AffectApplication" as const;
export const AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0 = "BOUNDED_AFFECT_DYNAMICS_V0" as const;
export const AFFECT_APPLICATION_DYNAMICS_CONTRACT_REF_V0 = "source:bounded-affect-dynamics-v0" as const;
export const AFFECT_APPLICATION_EXECUTION_IDENTITY_PROJECTION_V0 =
  "characteros-next/affect/affect-application-execution-identity/v1" as const;

/** §32: the stable eligibility ref — derives from the frozen semantic
 * eligibility identity ONLY (subject + factual event + INITIAL). */
export function deriveAffectEligibilityRefV0(eligibilityIdentity: HashV1): string {
  return `source:affect-eligibility-v0-${eligibilityIdentity.replace(/^sha256:/, "")}`;
}

/** §33: the distinct execution identity. Binds the exact attempt: eligibility
 * identity + the canonical Appraisal + the dynamics contract + the exact
 * predecessor head + the application logical time. A stale head changes the
 * execution identity while the eligibility identity stays constant. */
export async function deriveAffectApplicationExecutionIdentityV0(input: {
  readonly eligibility_identity: HashV1;
  readonly canonical_appraisal_ref: string;
  readonly dynamics_contract_id: typeof AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0;
  readonly expected_subject_revision: number;
  readonly predecessor_state_hash: HashV1;
  readonly predecessor_commit_ref: string | null;
  readonly application_logical_time: number;
}): Promise<HashV1> {
  return hashEnvelope(AFFECT_APPLICATION_EXECUTION_IDENTITY_PROJECTION_V0, {
    eligibility_identity: input.eligibility_identity,
    canonical_appraisal_ref: input.canonical_appraisal_ref,
    dynamics_contract_id: input.dynamics_contract_id,
    expected_subject_revision: input.expected_subject_revision,
    predecessor_state_hash: input.predecessor_state_hash,
    predecessor_commit_ref: input.predecessor_commit_ref,
    application_logical_time: input.application_logical_time
  });
}

/** §34: deterministic transition id from the execution identity. Same event +
 * same Appraisal + same predecessor head ⇒ same transition id; a stale
 * rebuild derives a new one. */
export function deriveAffectApplicationTransitionIdV0(executionIdentity: HashV1): string {
  return `t-affect-application-v0-${executionIdentity.replace(/^sha256:/, "")}`;
}

export type AffectApplicationReceiptValidationV0 =
  | {
      readonly ok: true;
      readonly eligibility_identity: HashV1;
      readonly execution_identity: HashV1;
    }
  | { readonly ok: false; readonly reason: string };

function predecessorOf(
  bundles: readonly AtomicCommitBundleAnyVersion[],
  revision: number
): AtomicCommitBundleAnyVersion | null {
  return bundles.find(
    (b) => b.next_snapshot.runtime_metadata.state_revision === revision - 1
  ) ?? null;
}

/** §37-§40: the ONE receipt validation authority. */
export async function validateAffectApplicationReceiptV0(input: {
  readonly bundle: AtomicCommitBundleAnyVersion;
  /** The subject's full committed bundle chain in commit order (trusted
   * history face), used for predecessor lookup and grounding re-checks. */
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly subject_id: string;
  readonly repository: InMemoryMemoryRepository;
  readonly repository_revision: RepositoryRevisionIdV0;
}): Promise<AffectApplicationReceiptValidationV0> {
  const bundle = input.bundle;
  const successor = bundle.next_snapshot;
  const successorRevision = successor.runtime_metadata.state_revision;

  // 1/2/3: V2 receipt, exact transition type and subject.
  if (bundle.commit_version !== "atomic-commit-v2") {
    return { ok: false, reason: "claimed AffectApplication receipt is not an atomic-commit-v2 bundle" };
  }
  if (bundle.transition_type !== AFFECT_APPLICATION_TRANSITION_TYPE_V0) {
    return { ok: false, reason: `claimed receipt transition_type is ${bundle.transition_type}, not AffectApplication` };
  }
  if (bundle.subject_id !== input.subject_id) {
    return { ok: false, reason: "claimed receipt subject does not match the requested subject" };
  }

  // 4: v4 successor. 5: exact canonical affect profile pairing.
  if ((successor.schema_version as string) !== "subject-state-v4") {
    return { ok: false, reason: "claimed receipt successor is not subject-state-v4" };
  }
  const profile = (successor.mechanism_config as { affect_profile?: { profile_id?: string; timebase?: string } }).affect_profile;
  if (
    profile?.profile_id !== AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0 ||
    profile?.timebase !== "tick"
  ) {
    return { ok: false, reason: "claimed receipt successor does not carry the BOUNDED_AFFECT_DYNAMICS_V0/tick profile" };
  }

  // 6: predecessor bundle must exist in the trusted chain.
  const predecessor = predecessorOf(input.bundles, successorRevision);
  if (predecessor === null) {
    return { ok: false, reason: `claimed receipt predecessor revision ${successorRevision - 1} is missing from the trusted chain` };
  }
  if ((predecessor.next_snapshot.schema_version as string) !== "subject-state-v4") {
    return { ok: false, reason: "claimed receipt predecessor is not subject-state-v4" };
  }

  // 7: exactly one affect/affect delta carrying exactly one /affect SET.
  const deltas = bundle.canonical_proposal.domain_deltas;
  if (deltas.length !== 1) {
    return { ok: false, reason: `claimed receipt carries ${deltas.length} domain deltas, exactly 1 required` };
  }
  const delta = deltas[0];
  if (delta === undefined || delta.producer !== "affect" || delta.domain !== "affect") {
    return { ok: false, reason: "claimed receipt delta is not affect/affect" };
  }
  if (delta.operations.length !== 1 || delta.operations[0]?.path !== "/affect") {
    return { ok: false, reason: "claimed receipt must carry exactly one /affect SET" };
  }
  const committedAffect = delta.operations[0].value as unknown as CanonicalAffectV0;
  if (!validateCanonicalAffectShape(committedAffect, "receipt /affect").ok) {
    return { ok: false, reason: "claimed receipt /affect value is not a CanonicalAffectV0" };
  }

  // 8: the deterministic sorted causal chain.
  const causes = bundle.trace_entry.cause_refs as readonly string[];
  if (causes.length !== 3) {
    return { ok: false, reason: "claimed receipt cause_refs must be exactly [appraisal_ref, factual_event_ref, source_observation_ref]" };
  }
  const appraisalRef = causes.find((r) => r.startsWith("appraisal:"));
  const eventRef = causes.find((r) => r.startsWith("event:"));
  const observationRef = causes.find((r) => r.startsWith("observation:"));
  if (appraisalRef === undefined || eventRef === undefined || observationRef === undefined) {
    return { ok: false, reason: "claimed receipt cause_refs lack the appraisal/event/observation chain" };
  }
  if (causes.some((r, i) => i > 0 && r < (causes[i - 1] as string))) {
    return { ok: false, reason: "claimed receipt cause_refs are not deterministically sorted" };
  }

  // 9: only the affect domain mutates.
  const mutations = bundle.trace_entry.domain_mutations;
  if (mutations.length !== 1 || mutations[0]?.domain !== "affect") {
    return { ok: false, reason: "claimed receipt must mutate exactly the affect domain" };
  }

  // 10/11: disposition = APPRAISED at the current head with THIS appraisal
  // ref (the resolver enforces the no-conflicting-abstention mutual exclusion).
  const disposition = await resolveInitialAppraisalDispositionForFactualEventV0(
    input.repository, input.repository_revision, input.subject_id, eventRef
  );
  if (disposition.kind !== "APPRAISED") {
    return { ok: false, reason: `receipt grounding failed: factual event disposition is ${disposition.kind}, not APPRAISED` };
  }
  if (disposition.appraisal.appraisal_ref !== appraisalRef) {
    return { ok: false, reason: "receipt appraisal_ref does not match the canonical INITIAL Appraisal for the event" };
  }
  const record = disposition.appraisal;

  // 12: eligibility identity recomputes + its ref rides in external_refs.
  const eligibilityIdentity = await deriveAffectEligibilityIdentityV0({
    subject_id: input.subject_id,
    factual_event_ref: eventRef as never,
    semantic_appraisal_episode: "INITIAL"
  });
  const eligibilityRef = deriveAffectEligibilityRefV0(eligibilityIdentity);
  const externalRefs = bundle.canonical_proposal.external_refs as readonly string[];
  if (!externalRefs.includes(eligibilityRef)) {
    return { ok: false, reason: "receipt external_refs lack the recomputed eligibility ref" };
  }

  // 13: execution identity + transition id recompute from the trusted
  // predecessor head and the dynamics contract.
  const executionIdentity = await deriveAffectApplicationExecutionIdentityV0({
    eligibility_identity: eligibilityIdentity,
    canonical_appraisal_ref: appraisalRef,
    dynamics_contract_id: AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0,
    expected_subject_revision: predecessor.next_snapshot.runtime_metadata.state_revision,
    predecessor_state_hash: await stateHashAnyVersion(predecessor.next_snapshot),
    predecessor_commit_ref: predecessor.commit_ref,
    application_logical_time: successor.runtime_metadata.logical_time
  });
  const executionRef = `workflow:affect-execution-v0-${executionIdentity.replace(/^sha256:/, "")}`;
  if (bundle.transition_id !== deriveAffectApplicationTransitionIdV0(executionIdentity)) {
    return { ok: false, reason: "receipt transition id does not recompute from the execution identity" };
  }
  if (!externalRefs.includes(executionRef)) {
    return { ok: false, reason: "receipt external_refs lack the recomputed execution ref" };
  }
  if (!externalRefs.includes(AFFECT_APPLICATION_DYNAMICS_CONTRACT_REF_V0)) {
    return { ok: false, reason: "receipt external_refs lack the dynamics contract ref" };
  }

  // 14: Observation grounding matches the committed bundle.
  const observationBundle = input.bundles.find(
    (b) => b.transition_id === record.source_observation_transition_id
  );
  if (observationBundle === undefined) {
    return { ok: false, reason: "receipt Observation grounding bundle is missing from the trusted chain" };
  }
  if (observationBundle.trace_entry.history_sequence !== record.source_admission_history_sequence) {
    return { ok: false, reason: "receipt admission sequence does not match the committed Observation history" };
  }
  if (!(observationBundle.trace_entry.cause_refs as readonly string[]).includes(eventRef)) {
    return { ok: false, reason: "receipt Observation grounding does not carry the factual event" };
  }

  // 15: exact impulse recomputation (no epsilon). Zero-impulse and lawful
  // saturation produce pre.affect == post.affect — a VALID receipt.
  const impulse = deriveAffectImpulseV0({
    relevance: record.dimensions.relevance,
    goal_congruence: record.dimensions.goal_congruence,
    intensity: record.dimensions.intensity
  });
  const expectedAffect = applyAffectImpulseV0(predecessor.next_snapshot.affect as unknown as CanonicalAffectV0, impulse);
  if (canonicalJsonString(expectedAffect) !== canonicalJsonString(successor.affect)) {
    return { ok: false, reason: "receipt successor Affect does not exactly recompute from the predecessor Affect and the Appraisal dimensions" };
  }
  if (canonicalJsonString(expectedAffect) !== canonicalJsonString(committedAffect)) {
    return { ok: false, reason: "receipt /affect delta value does not exactly recompute" };
  }

  // 16: every other domain byte-identical across the commit.
  const before = predecessor.next_snapshot as unknown as Record<string, unknown>;
  const after = successor as unknown as Record<string, unknown>;
  for (const field of Object.keys(before)) {
    if (field === "affect" || field === "runtime_metadata" || field === "trace_window") continue;
    if (canonicalJsonString(before[field]) !== canonicalJsonString(after[field])) {
      return { ok: false, reason: `receipt unexpectedly changed canonical field ${field}` };
    }
  }

  return { ok: true, eligibility_identity: eligibilityIdentity, execution_identity: executionIdentity };
}
