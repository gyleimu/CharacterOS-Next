/**
 * Bounded SubjectState version dispatch and predecessor compatibility.
 * `schema_version` is the sole discriminator; shape inference is forbidden.
 */

import type { SubjectStateV0 } from "../types/subject-state.js";
import {
  readSubjectStateSchemaVersion,
  type SubjectStateAnyVersionV0,
  type SubjectStateV4
} from "../types/subject-state-v4.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { fail, ok, type ValidationResult } from "./result.js";
import { validateSubjectState } from "./subject-state.js";
import { validateSubjectStateV4 } from "./subject-state-v4.js";
import { validateAffectShape } from "./values.js";
import { validateCanonicalAffectShape } from "./subject-state-v4-values.js";

const SCHEMA = "SS-SCHEMA-001";

/**
 * The transitions a subject-state-v4 predecessor lawfully admits. The governed
 * pre-cognition admission prefix (Observation without legacy affect, Learning
 * memory-content commits), the recovery writer (Time), the impulse writer
 * (AffectApplication), and — BELIEF_ADAPTATION_SESSION_WIRING_V0 — the
 * subjective-endorsement writer (Belief): its closed composition (exactly one
 * /beliefs replacement delta, producer "belief", writer-authority membrane)
 * already exists version-agnostically in commit/composition.ts, so the v4
 * foundation now admits the established Belief transition type exactly like
 * the other admitted writers. No other composition law changes.
 *
 * PERSONALITY_V4_TRANSITION_ADMISSION_V0 — the acquired slow-disposition writer
 * (Personality): its closed composition (exactly one personality/personality
 * delta carrying the /personality replacement) and ownership entry already
 * exist version-agnostically in commit/composition.ts + validation/ownership.ts,
 * and `PersonalityStateV0` is already a first-class block of every v4 state, so
 * the v4 foundation admits the established Personality transition type exactly
 * like the other admitted writers. One explicit incremental admission; the
 * allowlist remains closed and no other composition law changes.
 *
 * RELATIONSHIP_LIVED_DEVELOPMENT_V0 — the governed Relationship writer
 * (counterpart registration + interaction familiarity): its closed composition
 * (exactly one relationship/relationship delta carrying /relationships) and
 * ownership entry already exist version-agnostically in commit/composition.ts +
 * validation/ownership.ts, `RelationshipStateV0` is already a first-class block
 * of every v4 state, and the FROZEN governed-write authorities already emit
 * `transition_type: "Relationship"`. The v4 foundation therefore admits the
 * established Relationship transition type exactly like the other admitted
 * writers. One explicit incremental admission; the allowlist remains closed and
 * no other composition law changes.
 */
const V4_ALLOWED_TRANSITIONS: readonly string[] = [
  "Time",
  "Observation",
  "Learning",
  "AffectApplication",
  "Belief",
  "Personality",
  "Relationship"
];

export function validateSubjectStateAnyVersionV0(
  value: unknown,
  options?: { readonly preTraceWindowRevision?: number }
): ValidationResult<SubjectStateAnyVersionV0> {
  const version = readSubjectStateSchemaVersion(value);
  if (version === "subject-state-v3") return validateSubjectState(value, options);
  if (version === "subject-state-v4") return validateSubjectStateV4(value, options);
  return fail(
    "INVALID_SCHEMA",
    SCHEMA,
    "subjectState.schema_version: expected subject-state-v3 or subject-state-v4"
  );
}

export function validateSubjectStateV3OnlyV0(value: unknown): ValidationResult<SubjectStateV0> {
  if (readSubjectStateSchemaVersion(value) !== "subject-state-v3") {
    return fail("INVALID_SCHEMA", SCHEMA, "subjectState.schema_version: expected subject-state-v3");
  }
  return validateSubjectState(value);
}

export function validateSubjectStateV4OnlyV0(value: unknown): ValidationResult<SubjectStateV4> {
  if (readSubjectStateSchemaVersion(value) !== "subject-state-v4") {
    return fail("INVALID_SCHEMA", SCHEMA, "subjectState.schema_version: expected subject-state-v4");
  }
  return validateSubjectStateV4(value);
}

/**
 * Proposal/state compatibility is distinct from proposal shape admission.
 * The predecessor version grants authority for exactly one /affect schema.
 */
export function validateProposalCompatibilityWithPredecessorV0(
  predecessor: SubjectStateAnyVersionV0,
  proposal: CanonicalTransitionProposalV1
): ValidationResult<void> {
  const version = readSubjectStateSchemaVersion(predecessor);
  if (version === null) {
    return fail("INVALID_SCHEMA", SCHEMA, "predecessor has an unsupported schema_version");
  }

  if (version === "subject-state-v4" && !V4_ALLOWED_TRANSITIONS.includes(proposal.transition_type)) {
    return fail(
      "INVALID_TRANSITION_COMPOSITION",
      "TR-ATOMIC-001",
      `subject-state-v4 foundation supports only ${V4_ALLOWED_TRANSITIONS.join(", ")}, received ${proposal.transition_type}`
    );
  }

  for (const delta of proposal.domain_deltas) {
    for (const operation of delta.operations) {
      if (operation.path === "/mood" && version === "subject-state-v4") {
        return fail(
          "INVALID_TRANSITION_COMPOSITION",
          "TR-ATOMIC-001",
          "subject-state-v4 forbids /mood replacement"
        );
      }
      if (operation.path !== "/affect") continue;
      const detail = `proposal /affect for ${version}`;
      const shape = version === "subject-state-v3"
        ? validateAffectShape(operation.value, detail)
        : validateCanonicalAffectShape(operation.value, detail);
      if (!shape.ok) {
        return fail(
          "INVALID_SCHEMA",
          SCHEMA,
          `${detail}: predecessor-compatible Affect schema required (${shape.error.detail})`
        );
      }
    }
  }
  return ok(undefined);
}

export function validateOrdinaryStateSchemaContinuityV0(
  predecessor: SubjectStateAnyVersionV0,
  successor: SubjectStateAnyVersionV0
): ValidationResult<void> {
  const before = readSubjectStateSchemaVersion(predecessor);
  const after = readSubjectStateSchemaVersion(successor);
  if (before === null || after === null) {
    return fail("INVALID_SCHEMA", SCHEMA, "ordinary transition contains an unsupported state schema");
  }
  if (before !== after) {
    return fail(
      "INVALID_TRANSITION_COMPOSITION",
      "TR-ATOMIC-001",
      `ordinary state schema transition ${before} -> ${after} is forbidden`
    );
  }
  return ok(undefined);
}
