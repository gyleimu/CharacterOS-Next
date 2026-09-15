/**
 * SUBJECTIVE RATIONALE AUTHORIZATION — production policy v0
 * (AFFECT_COGNITION_FIELD_LOCAL_RATIONALE_AUTHORIZATION_V0).
 *
 * CharacterOS authority law: the model proposes, the host authorizes. A raw model
 * rationale is not authoritative merely because the model emitted it. This module is
 * the SINGLE deterministic implementation of the frozen rationale semantics
 * (minimal subjective frame + zero forbidden families) shared by production
 * authorization and the research audit — production never imports research code.
 *
 * Field-local scope: only `subjective_rationale` may be replaced by null here. Every
 * authoritative field (facts, handles, stance, directive, clarification binding) keeps
 * its existing whole-proposal fail-closed semantics, unchanged.
 *
 * The rejection codes are internal diagnostics. They are never sent to the model and
 * never become canonical state.
 */

export const SUBJECTIVE_RATIONALE_AUTHORIZATION_POLICY_VERSION_V0 =
  "subjective-rationale-authorization-policy-v0" as const;

export type SubjectiveRationaleRejectionCodeV0 =
  | "RAW_SELF_STATE_DESCRIPTION"
  | "NAMED_PSYCHOLOGICAL_STATE"
  | "INFERRED_CAPACITY"
  | "UNSUPPORTED_EXTERNAL_FACT"
  | "UNSUPPORTED_HISTORY_CLAIM"
  | "NO_SUBJECTIVE_FRAME";

export type SubjectiveRationaleAuthorizationV0 =
  | { readonly status: "ABSENT"; readonly authoritative_rationale: null }
  | { readonly status: "AUTHORIZED"; readonly authoritative_rationale: string }
  | {
      readonly status: "REJECTED";
      readonly authoritative_rationale: null;
      readonly reason: SubjectiveRationaleRejectionCodeV0;
    };

const normalize = (value: string): string => value.normalize("NFC");

/** Forbidden semantic families — the frozen boundary, unchanged. */
const FORBIDDEN_FAMILIES: readonly (readonly [SubjectiveRationaleRejectionCodeV0, RegExp])[] = [
  ["RAW_SELF_STATE_DESCRIPTION", /[^\p{L}\p{N}](energy|stress|fatigue|arousal|fresh(?:ness)?|refreshed|mood|alert(?:ness)?|readiness)[^\p{L}\p{N}]|^(?:energy|stress|fatigue|arousal|fresh(?:ness)?|refreshed|mood|alert(?:ness)?|readiness)[^\p{L}\p{N}]|[^\p{L}\p{N}](energy|stress|fatigue|arousal|fresh(?:ness)?|refreshed|mood|alert(?:ness)?|readiness)$/iu],
  ["NAMED_PSYCHOLOGICAL_STATE", /(?:i am|i'm|i feel|feeling|am i)[^.]{0,30}\b(?:calm|energized|energetic|stressed|anxious|excited|overwhelmed|drained|weary|upbeat)\b/iu],
  ["INFERRED_CAPACITY", /\b(?:capacity|capable|capability|bandwidth|able to|unable to|can manage|can handle|within (?:my )?(?:operational )?scope|ready to|prepared to take|workload tolerance)\b/iu],
  ["UNSUPPORTED_EXTERNAL_FACT", /(?:^|[^a-z])(?:i|we)\s+(?:only\s+)?have\s+(?:\d+|no|enough|little|a few|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:minutes?|hours?|time)\b|\bno time\b|\bthe deadline\b|\b(?:no|lack of|shortage of) (?:resources?|staff|people|budget)\b|\b\d+(?:\.\d+)?% chance\b|\b(?:high|low) probability\b/iu],
  ["UNSUPPORTED_HISTORY_CLAIM", /\b(?:in the past|last time|previously|before)\b[^.]{0,40}\b(?:failed|worked|happened|did|went)\b|(?:^|[^a-z])(?:i|we)\s+(?:have\s+)?(?:handled|managed|done|tried|failed|succeeded|fixed)\b[^.]{0,30}\b(?:before|previously|last time|in the past|already)\b/iu]
];

/**
 * The minimal subjective frame: this text presents itself as THIS subject's own
 * evaluation, attitude, valuation, willingness, priority, aversion or strategy.
 * Structural — not an ontology of reasons.
 */
const SUBJECTIVE_FRAME_PATTERNS: readonly RegExp[] = [
  /\bi(?:'d| would)?\s+(?:rather|prefer)\b/iu,
  /\bi (?:value|care about|favor|favour|appreciate|enjoy|like|love)\b/iu,
  /\bi (?:find|consider)\b[^.]{0,40}\b(?:useful|worthwhile|valuable|important|beneficial|helpful|meaningful|rewarding|enjoyable|pleasing|wise|sensible)\b/iu,
  /\bi(?:'d|'m| am| would| will)?\s*(?:be\s+)?(?:willing|glad|happy|eager)\s+to\b/iu,
  /\bi (?:believe|think|regard|see)\b[^.]{0,40}\b(?:better|best|right|worthwhile|valuable|important|useful|preferable|sensible|wise)\b/iu,
  /\bi (?:prioriti[sz]e|opt for|avoid|favour|favor)\b/iu,
  /\b(?:matters|means something|counts|is important|is valuable|is worthwhile)\s+to me\b/iu,
  /\bmy preference\b/iu
];

export function subjectiveFramePresentV0(rationale: string): boolean {
  const text = normalize(rationale);
  return SUBJECTIVE_FRAME_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Field-local authorization. Forbidden families always dominate a lawful frame.
 * Structural validity (canonical text, non-empty, length) remains with the existing
 * validator; this policy only decides content authority.
 */
export function authorizeSubjectiveRationaleV0(
  rationale: string | null
): SubjectiveRationaleAuthorizationV0 {
  if (rationale === null) return { status: "ABSENT", authoritative_rationale: null };
  const text = normalize(rationale);
  for (const [code, pattern] of FORBIDDEN_FAMILIES) {
    if (pattern.test(text)) return { status: "REJECTED", authoritative_rationale: null, reason: code };
  }
  if (!subjectiveFramePresentV0(text)) {
    return { status: "REJECTED", authoritative_rationale: null, reason: "NO_SUBJECTIVE_FRAME" };
  }
  return { status: "AUTHORIZED", authoritative_rationale: rationale };
}
