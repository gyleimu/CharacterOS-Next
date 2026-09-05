/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — BehaviorOutcomeFeedbackCandidateV0: the
 * closed UNTRUSTED runtime input for the behavior→experience feedback path.
 *
 * Refs-and-facts only: the host names the ingress source event, the committed
 * source Observation (O2) and declares salience/adapter labels. NOTHING here is
 * authority — every semantic claim is re-verified against the composition-owned
 * ledgers and the committed O2 bundle by
 * validateTrustedBehaviorOutcomeFeedback before any record construction. The
 * reply TEXT itself never travels in this candidate: it is read exclusively
 * from the ingress ledger (§6 law applied to ingress facts).
 */

import type { CanonicalRefV0, IdentifierV0, TransitionIdV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import {
  isRecord,
  isString,
  validateIdentifier,
  validateRefElement,
  validateUnitInterval
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";

const SCHEMA_REASON = "SS-SCHEMA-001";

/** Exact closed candidate key set — nothing else. */
const CANDIDATE_KEYS: readonly string[] = [
  "subject_id",
  "conversation_id",
  "source_event_id",
  "observation_transition_id",
  "observation_ref",
  "declared_salience",
  "host_adapter"
];

export interface BehaviorOutcomeFeedbackCandidateV0 {
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** Stable host source event identity of the linked ingress event. */
  readonly source_event_id: IdentifierV0;
  /** The committed source Observation (O2) transition identity. */
  readonly observation_transition_id: TransitionIdV0;
  /** The source observation ref (`observation:<id>`) — a cause ref of O2. */
  readonly observation_ref: CanonicalRefV0;
  /** Host-declared [0,1] salience (ENCODING_DECLARED_V0 semantics). */
  readonly declared_salience: UnitIntervalV0;
  /** Nonempty host feedback-adapter provenance label. */
  readonly host_adapter: string;
}

/**
 * Closed-shape runtime validation of one feedback candidate. Grammar/kind only
 * — semantic provenance authority lives at the feedback source-authority
 * boundary. Fail closed; the candidate is never mutated.
 */
export function validateBehaviorOutcomeFeedbackCandidate(
  v: unknown
): ValidationResult<BehaviorOutcomeFeedbackCandidateV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA_REASON, "feedback candidate: not an object");
  for (const key of Object.keys(v)) {
    if (!CANDIDATE_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `feedback candidate: unknown key ${key}`);
    }
  }
  const subject = validateIdentifier(v["subject_id"] as string, "feedback candidate.subject_id");
  if (!subject.ok) return subject;
  const conversation = validateIdentifier(v["conversation_id"] as string, "feedback candidate.conversation_id");
  if (!conversation.ok) return conversation;
  const sourceEvent = validateIdentifier(v["source_event_id"] as string, "feedback candidate.source_event_id");
  if (!sourceEvent.ok) return sourceEvent;
  if (!isString(v["observation_transition_id"]) || (v["observation_transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "feedback candidate.observation_transition_id: nonempty string required");
  }
  const observation = validateRefElement(
    v["observation_ref"],
    "feedback candidate.observation_ref",
    ["observation"]
  );
  if (!observation.ok) return observation;
  const rawSalience = v["declared_salience"];
  if (typeof rawSalience !== "number") {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "feedback candidate.declared_salience: expected number");
  }
  const salience = validateUnitInterval(rawSalience, "feedback candidate.declared_salience");
  if (!salience.ok) return salience;
  if (!isString(v["host_adapter"]) || (v["host_adapter"] as string).trim().length === 0) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "feedback candidate.host_adapter: nonempty string required");
  }
  return ok({
    subject_id: subject.value,
    conversation_id: conversation.value,
    source_event_id: sourceEvent.value,
    observation_transition_id: v["observation_transition_id"] as TransitionIdV0,
    observation_ref: observation.value,
    declared_salience: salience.value,
    host_adapter: v["host_adapter"] as string
  });
}
