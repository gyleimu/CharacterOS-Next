/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE 0 SUBJECT FIXTURES — the lawful genesis-foundation path only.
 *
 * A subject's genesis source is the production `createInteractiveSubjectSeedV0` plus exactly
 * ONE canonical proposition at the frozen production first-formation credence. This is the same
 * seeded-v3_source convention the repository's own offline acceptance test and the earlier
 * lived-evidence validation use: the production host seed itself stays empty and no product
 * proposition admission is claimed.
 *
 * The two subjects are built by the SAME function with only their subject id differing, so
 * their equality is a property of construction and is then PROVEN mechanically by the
 * preflight equivalence audit rather than assumed.
 */

import {
  BELIEF_STATE_SCHEMA_VERSION,
  validateSubjectState,
  type SubjectStateV0
} from "../../../../packages/subject-core/dist/index.js";
import { createInteractiveSubjectSeedV0 } from "../../../../packages/runtime/dist/index.js";

import {
  P0_BASELINE_CREDENCE,
  P0_QUAL_PROPOSITION_ID,
  P0_QUAL_PROPOSITION_LABEL,
  P0_QUAL_SUBJECT_ID,
  P0_SUBJECT_DISPLAY_NAME,
  P0_TARGET_PROPOSITION_ID,
  P0_TARGET_PROPOSITION_LABEL
} from "./contract.ts";

/** Identity fields, i.e. the ONLY permitted difference between two subjects. */
export const P0_IDENTITY_FIELDS = ["subject_id", "display_name", "identity_anchors"] as const;

function seededSourceV0(subjectId: string, propositionId: string, propositionLabel: string): SubjectStateV0 {
  const base = createInteractiveSubjectSeedV0(subjectId, P0_SUBJECT_DISPLAY_NAME, []) as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [{ proposition_id: propositionId, proposition_label: propositionLabel, credence: P0_BASELINE_CREDENCE }]
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`P0_GENESIS_FIXTURE_INVALID: ${checked.error.detail}`);
  return checked.value;
}

/** Arm A / arm B genesis: identical except for the subject identity. */
export function buildPhase0SourceV0(subjectId: string): SubjectStateV0 {
  return seededSourceV0(subjectId, P0_TARGET_PROPOSITION_ID, P0_TARGET_PROPOSITION_LABEL);
}

/** Qualification genesis: a THIRD subject carrying a NON-target proposition. */
export function buildQualificationSourceV0(): SubjectStateV0 {
  return seededSourceV0(P0_QUAL_SUBJECT_ID, P0_QUAL_PROPOSITION_ID, P0_QUAL_PROPOSITION_LABEL);
}

/**
 * Genesis for an arbitrary subject id. `kind` selects the proposition: TARGET for a subject under
 * study, QUALIFICATION for the non-scientific bootstrap subject.
 */
export function buildPhase0SourceForSubjectV0(
  subjectId: string,
  kind: "TARGET" | "QUALIFICATION" = "TARGET"
): SubjectStateV0 {
  return kind === "QUALIFICATION"
    ? seededSourceV0(subjectId, P0_QUAL_PROPOSITION_ID, P0_QUAL_PROPOSITION_LABEL)
    : seededSourceV0(subjectId, P0_TARGET_PROPOSITION_ID, P0_TARGET_PROPOSITION_LABEL);
}

/** Canonical serialisation with identity fields removed — the §3 equivalence comparison. */
export function stripIdentityV0(value: unknown): string {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const identity = clone["identity"] as Record<string, unknown> | undefined;
  if (identity !== undefined) {
    // Rebuilt by omission rather than deletion, so no dynamically computed key is ever deleted.
    const kept = Object.fromEntries(
      Object.entries(identity).filter(([key]) => !(P0_IDENTITY_FIELDS as readonly string[]).includes(key))
    );
    clone["identity"] = kept;
  }
  return JSON.stringify(clone);
}
