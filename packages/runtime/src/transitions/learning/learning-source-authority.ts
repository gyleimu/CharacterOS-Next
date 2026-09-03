/**
 * P2.3.5.3a — Learning source authority: durable semantic verification that a
 * LearningExperienceCandidateV0 corresponds to a REAL, already-committed
 * Observation experience for the SAME subject.
 *
 * Contract: docs/implementation/p2-3-5-learning-v0-reference-contract.md §4.2
 * (source authority rule), §6 (subject binding), §7 (Observation-only source),
 * §8 (occurrence basis), §9 (appraisal-ref durable evidence), §10 (context ref
 * binding), §17 (least privilege). Commit 0e11e62.
 *
 * Normative trust rule: syntactic ref validity != semantic source authority.
 * Every semantic claim of the candidate is revalidated against the committed
 * source bundle read through the EXISTING durable read face
 * (`readCommittedByTransitionId`), never against caller assertions.
 *
 * LEAST PRIVILEGE: this boundary receives ONLY a narrow RuntimeContext, the
 * candidate and a committed-transition READ authority. It never receives full
 * SubjectState, Affect/Mood/Regulation, beliefs/traits/relationships, full
 * MemoryState, and — critically — NO MemoryPreparationAuthority. It performs
 * ZERO memory writes and ZERO canonical mutation (pure read + verdict).
 *
 * TRUST MODEL (P2.3.5.3a.1 hardening): a JavaScript property is DATA — even a
 * non-enumerable module-private Symbol own-property is reflectable
 * (Object.getOwnPropertySymbols / Reflect.ownKeys / getOwnPropertyDescriptors)
 * and copyable onto a forged object. Trusted authority is therefore NOT
 * property-bound: it is IDENTITY/VALIDATION-bound membership in a module-private
 * WeakSet registry granted ONLY by `validateTrustedLearningExperience` after the
 * full durable source-authority flow. Trust intentionally disappears across
 * JSON serialization, structuredClone, spread, descriptor/symbol copy, IPC and
 * process restart; after crash/restart the host re-supplies the CANDIDATE and
 * the system reruns durable validation to create a NEW trusted runtime object.
 * Semantic candidate data may be re-supplied; runtime trust capability may NOT.
 *
 * FUTURE CONSUMER RULE (P2.3.5.3b): ExperienceEncoderV0 MUST runtime-check
 * trusted authority via `isTrustedLearningExperience` (or an equivalent
 * internal assertion). A TypeScript parameter annotation alone
 * (`encode(input: TrustedLearningExperienceV0)`) is NOT sufficient.
 *
 * Slice scope: trusted input ONLY. No encoding, no prepare, no adoption, no
 * Learning transition identity, no A12/A13 orchestration.
 */

import type { AtomicCommitBundleAnyVersion, CanonicalRefV0 } from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  validateLearningExperienceCandidate,
  type LearningExperienceCandidateV0
} from "./learning-candidate.js";

/**
 * Narrow committed-transition READ authority (read-only projection over the
 * existing `ReadOnlyStoreHandle.readCommittedByTransitionId` read face). This
 * slice never reaches raw store mutation surfaces.
 */
export interface LearningSourceReadAuthority {
  /** The committed bundle for one transition id, or null when absent. */
  readCommittedBundle(transitionId: string): Promise<AtomicCommitBundleAnyVersion | null>;
  /**
   * Optional contract-§4.2 surface B: durable PreparedLogicalResult
   * domain_result_refs of ONE transition (host WorkflowStore read when
   * available). Implementations MUST return refs of the same transition only.
   * Absent ⇒ surface A (committed snapshot appraisal evidence) governs alone.
   */
  readPreparedDomainResultRefs?(transitionId: string): Promise<readonly CanonicalRefV0[] | null>;
}

/**
 * The validated/trusted representation downstream encoders may later consume:
 * ONLY the minimum validated candidate data, deeply frozen, freshly constructed
 * (never the caller's object, never the source bundle).
 *
 * TRUST CAPABILITY (P2.3.5.3a.1 reflective forge closure): this exported type
 * is DESCRIPTIVE ONLY — a TypeScript shape is not a trust capability, and no
 * object property (enumerable, non-enumerable, string- or symbol-keyed) can be
 * one either, because every own property is reflectable and copyable. Trust is
 * module-private registry membership granted ONLY by
 * `validateTrustedLearningExperience` after durable source-authority
 * validation. The trusted object's own-key surface is EXACTLY the canonical 11
 * visible fields; nothing hidden participates in serialization or determinism.
 */
export interface TrustedLearningExperienceV0 {
  readonly subject_id: LearningExperienceCandidateV0["subject_id"];
  readonly source_transition_id: LearningExperienceCandidateV0["source_transition_id"];
  readonly observation_ref: LearningExperienceCandidateV0["observation_ref"];
  readonly entity_refs: LearningExperienceCandidateV0["entity_refs"];
  readonly event_refs: LearningExperienceCandidateV0["event_refs"];
  readonly occurrence_logical_time: LearningExperienceCandidateV0["occurrence_logical_time"];
  readonly appraisal_ref: LearningExperienceCandidateV0["appraisal_ref"];
  readonly scene: LearningExperienceCandidateV0["scene"];
  readonly focus_refs: LearningExperienceCandidateV0["focus_refs"];
  readonly environment_refs: LearningExperienceCandidateV0["environment_refs"];
  readonly declared_salience: LearningExperienceCandidateV0["declared_salience"];
}

/**
 * Module-private identity registry. Membership is granted ONLY by
 * `validateTrustedLearningExperience` after the complete durable source-
 * authority flow; the registry itself is never exported, so no external module
 * can register, forge or strip trust. WeakSet keeps no strong references: a
 * trusted object released by every holder is reclaimed, and trust can never be
 * serialized, cloned, spread, descriptor-copied or IPC-transferred — after
 * crash/restart trust is re-established only by re-validation from durable
 * evidence. Registry state never participates in hashes/fingerprints.
 */
const trustedLearningExperienceRegistry = new WeakSet<object>();

/**
 * Runtime trust verdict for future trusted consumers (e.g. ExperienceEncoderV0,
 * which MUST call this — a type annotation alone is not a trust capability):
 * true ONLY for the exact runtime objects produced by
 * `validateTrustedLearningExperience`. A structurally identical plain object,
 * a JSON/structuredClone/spread copy, or an object carrying copied symbols or
 * property descriptors of a genuine trusted object is rejected.
 */
export function isTrustedLearningExperience(value: unknown): value is TrustedLearningExperienceV0 {
  return value !== null && typeof value === "object" && trustedLearningExperienceRegistry.has(value);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

function refsEqual(a: readonly CanonicalRefV0[], b: readonly CanonicalRefV0[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Validates an UNKNOWN value as a Learning candidate and verifies its semantic
 * provenance against durable committed evidence of the SAME Observation.
 * Fail-closed at every step; the candidate input is never mutated; no memory
 * write and no canonical mutation occur on any path.
 *
 * Failure mapping (existing frozen families only):
 *  - malformed candidate shape/grammar → INVALID_SCHEMA / SS-SCHEMA-001
 *  - unknown / uncommitted source      → INVALID_STAGE_DEPENDENCY / MICL-STAGE-001
 *  - wrong subject binding             → UNKNOWN_SUBJECT / SS-AUTH-001
 *  - non-Observation source type       → INVALID_STAGE_DEPENDENCY / MICL-STAGE-001
 *  - occurrence basis mismatch         → INVALID_LOGICAL_TIME / TIME-OCCURRENCE-001
 *  - unsupported semantic evidence     → UNSUPPORTED_EVIDENCE_REF / LLM-EVID-001
 */
export async function validateTrustedLearningExperience(
  deps: LearningSourceReadAuthority,
  context: RuntimeContext,
  candidate: unknown
): Promise<ValidationResult<TrustedLearningExperienceV0>> {
  // ---- Step 1: closed-shape admission (fail closed before any source lookup) --
  const shaped = validateLearningExperienceCandidate(candidate);
  if (!shaped.ok) return shaped;
  const c = shaped.value;

  // ---- Step 2: the source transition must be a genuinely committed bundle ----
  const bundle = await deps.readCommittedBundle(c.source_transition_id);
  if (bundle === null) {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `learning source ${c.source_transition_id}: no committed bundle (unknown, reserved-only, rejected or uncommitted)`
    );
  }

  // ---- Step 3: subject binding (candidate == runtime == committed source) ----
  if (c.subject_id !== context.subject_id) {
    return fail(
      "UNKNOWN_SUBJECT",
      "SS-AUTH-001",
      `learning candidate subject ${c.subject_id} does not match runtime subject ${context.subject_id}`
    );
  }
  if (bundle.subject_id !== c.subject_id) {
    return fail(
      "UNKNOWN_SUBJECT",
      "SS-AUTH-001",
      `learning source bundle belongs to ${bundle.subject_id}, expected ${c.subject_id} (cross-subject borrowing rejected)`
    );
  }

  // ---- Step 4: the committed source must be an Observation -------------------
  if (bundle.transition_type !== "Observation") {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `learning source must be a committed Observation, got ${bundle.transition_type}`
    );
  }

  // ---- Step 5: occurrence basis is authoritative, never caller-selected ------
  if (c.occurrence_logical_time !== bundle.logical_time_after) {
    return fail(
      "INVALID_LOGICAL_TIME",
      "TIME-OCCURRENCE-001",
      `learning candidate occurrence ${c.occurrence_logical_time} != source bundle logical_time_after ${bundle.logical_time_after}`
    );
  }

  // ---- Step 6: observation ref is semantically bound to the source -----------
  if (!bundle.trace_entry.cause_refs.includes(c.observation_ref)) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `learning candidate observation_ref ${c.observation_ref} is not a cause ref of the source Observation`
    );
  }

  // ---- Step 7: appraisal ref provenance (ref only — never values) ------------
  if (c.appraisal_ref !== null) {
    const surfaceA: ReadonlySet<string> = new Set(
      bundle.next_snapshot.affect.active_channels.map((channel) => channel.source_appraisal_ref)
    );
    let evidenced = surfaceA.has(c.appraisal_ref);
    if (!evidenced && deps.readPreparedDomainResultRefs !== undefined) {
      const preparedRefs = await deps.readPreparedDomainResultRefs(c.source_transition_id);
      if (preparedRefs !== null) {
        evidenced = (preparedRefs as readonly string[]).includes(c.appraisal_ref);
      }
    }
    if (!evidenced) {
      return fail(
        "UNSUPPORTED_EVIDENCE_REF",
        "LLM-EVID-001",
        `learning candidate appraisal_ref ${c.appraisal_ref} has no durable evidence in the source Observation`
      );
    }
  }

  // ---- Step 8: scene / focus / environment are bound to the source context ---
  const committedContext = bundle.next_snapshot.context;
  if (c.scene !== committedContext.scene) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `learning candidate scene does not match the committed source context`
    );
  }
  if (!refsEqual(c.focus_refs, committedContext.focus_refs)) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `learning candidate focus_refs do not match the committed source context`
    );
  }
  if (!refsEqual(c.environment_refs, committedContext.environment_refs)) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `learning candidate environment_refs do not match the committed source context`
    );
  }

  // ---- Trusted output: minimum validated data, freshly built, deep-frozen ----
  const trusted: TrustedLearningExperienceV0 = {
    subject_id: c.subject_id,
    source_transition_id: c.source_transition_id,
    observation_ref: c.observation_ref,
    entity_refs: [...c.entity_refs],
    event_refs: [...c.event_refs],
    occurrence_logical_time: c.occurrence_logical_time,
    appraisal_ref: c.appraisal_ref,
    scene: c.scene,
    focus_refs: [...c.focus_refs],
    environment_refs: [...c.environment_refs],
    declared_salience: c.declared_salience
  };
  deepFreeze(trusted);
  // Trust grant (identity-bound, not property-bound): THIS is the only path
  // that can make an object trusted. No property/descriptor/symbol copy of
  // `trusted` can reproduce registry membership.
  trustedLearningExperienceRegistry.add(trusted);
  return ok(trusted);
}
