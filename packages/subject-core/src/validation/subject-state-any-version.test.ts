/**
 * PERSONALITY_V4_TRANSITION_ADMISSION_V0 — V4 closed transition allowlist.
 *
 * Proves the incremental, explicit admission of the established Personality
 * transition to the subject-state-v4 foundation, that the allowlist remains
 * closed, and that Personality's producer/domain/path/transition ownership is
 * unchanged (exact single /personality replacement; traits_seed stays readonly).
 */

import { describe, expect, it } from "vitest";

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { SubjectStateV4 } from "../types/subject-state-v4.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { TransitionType } from "../types/enums.js";
import { validateProposalCompatibilityWithPredecessorV0 } from "./subject-state-any-version.js";
import { validateOwnership } from "./ownership.js";

const v4 = { schema_version: "subject-state-v4" } as unknown as SubjectStateV4;
const v3 = { schema_version: "subject-state-v3" } as unknown as SubjectStateV0;

function proposal(transition_type: TransitionType): CanonicalTransitionProposalV1 {
  return { transition_type, domain_deltas: [] } as unknown as CanonicalTransitionProposalV1;
}

describe("PERSONALITY_V4_TRANSITION_ADMISSION_V0 — closed V4 allowlist", () => {
  it("admits the established Personality transition on v4", () => {
    const result = validateProposalCompatibilityWithPredecessorV0(v4, proposal("Personality"));
    expect(result.ok).toBe(true);
  });

  it("still admits the other established v4 writers (Time/Observation/Learning/AffectApplication/Belief)", () => {
    for (const type of ["Time", "Observation", "Learning", "AffectApplication", "Belief"] as const) {
      expect(validateProposalCompatibilityWithPredecessorV0(v4, proposal(type)).ok).toBe(true);
    }
  });

  it("keeps the allowlist closed: an unadmitted transition type is still rejected", () => {
    const result = validateProposalCompatibilityWithPredecessorV0(v4, proposal("CognitionAction"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("INVALID_TRANSITION_COMPOSITION");
    expect(result.error.detail).toContain("received CognitionAction");
    expect(result.error.detail).toContain("Personality");
  });

  it("does not gate v3 predecessors with the v4 allowlist", () => {
    for (const type of ["Personality", "Relationship", "CognitionAction"] as const) {
      expect(validateProposalCompatibilityWithPredecessorV0(v3, proposal(type)).ok).toBe(true);
    }
  });
});

describe("RELATIONSHIP_LIVED_DEVELOPMENT_V0 — Relationship admitted to the closed V4 allowlist", () => {
  it("admits the established Relationship transition on v4", () => {
    expect(validateProposalCompatibilityWithPredecessorV0(v4, proposal("Relationship")).ok).toBe(true);
  });

  it("relationship/relationship owns exactly /relationships for the Relationship transition", () => {
    expect(validateOwnership("relationship", "relationship", "/relationships", "Relationship", "t").ok).toBe(true);
  });

  it("rejects a Relationship-shaped path written by the wrong producer", () => {
    const result = validateOwnership("belief", "relationship", "/relationships", "Relationship", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("UNAUTHORIZED_PRODUCER");
  });

  it("rejects a Relationship transition touching another domain's path", () => {
    for (const path of ["/beliefs", "/personality", "/affect", "/mood"] as const) {
      const result = validateOwnership("relationship", "relationship", path, "Relationship", "t");
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(
        result.error.error_code === "INVALID_TRANSITION_OWNER" ||
          result.error.error_code === "FORBIDDEN_DIRECT_MUTATION"
      ).toBe(true);
    }
  });

  it("rejects /relationships written by a non-Relationship transition type", () => {
    const result = validateOwnership("relationship", "relationship", "/relationships", "Personality", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("INVALID_TRANSITION_OWNER");
  });
});

describe("PERSONALITY_V4_TRANSITION_ADMISSION_V0 — ownership unchanged", () => {
  it("personality/personality owns exactly /personality for the Personality transition", () => {
    expect(validateOwnership("personality", "personality", "/personality", "Personality", "t").ok).toBe(true);
  });

  it("rejects a Personality-shaped path written by the wrong producer", () => {
    const result = validateOwnership("affect", "personality", "/personality", "Personality", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("UNAUTHORIZED_PRODUCER");
  });

  it("rejects a Personality-shaped path written under the wrong domain", () => {
    const result = validateOwnership("personality", "belief", "/personality", "Personality", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("UNAUTHORIZED_PRODUCER");
  });

  it("rejects a Personality transition touching another domain's path (multi-path/foreign path)", () => {
    for (const path of ["/beliefs", "/relationships", "/affect", "/mood"] as const) {
      const result = validateOwnership("personality", "personality", path, "Personality", "t");
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(
        result.error.error_code === "INVALID_TRANSITION_OWNER" ||
          result.error.error_code === "FORBIDDEN_DIRECT_MUTATION"
      ).toBe(true);
    }
  });

  it("keeps traits_seed readonly: Personality can never mutate it", () => {
    const result = validateOwnership("personality", "personality", "/traits_seed", "Personality", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("FORBIDDEN_DIRECT_MUTATION");
  });

  it("rejects /personality written by a non-Personality transition type", () => {
    const result = validateOwnership("personality", "personality", "/personality", "Belief", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("INVALID_TRANSITION_OWNER");
  });

  it("rejects an unknown /personality sub-path", () => {
    const result = validateOwnership("personality", "personality", "/personality/openness", "Personality", "t");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error_code).toBe("INVALID_SCHEMA");
  });
});
