/**
 * RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — Seal A.
 *
 * The explicit V4 Relationship composition branch admitted by `0c3180b`
 * (+Relationship in V4_ALLOWED_TRANSITIONS) must accept EXACTLY the established
 * lawful governed Relationship transition shape and nothing else. These are the
 * cross-domain firewall / wrong-producer / wrong-domain / multi-path regressions
 * for that one branch.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { SubjectStateV4 } from "../types/subject-state-v4.js";
import { validateProposalCompositionForStateVersion } from "./composition.js";

const v4 = { schema_version: "subject-state-v4" } as unknown as SubjectStateV4;

function delta(overrides: {
  readonly producer?: string;
  readonly domain?: string;
  readonly paths: readonly string[];
}): Record<string, unknown> {
  return {
    producer: overrides.producer ?? "relationship",
    domain: overrides.domain ?? "relationship",
    expected_repository_revision: null,
    operations: overrides.paths.map((path) => ({ path, value: {} })),
    provenance_refs: []
  };
}

function proposal(
  transition_type: string,
  deltas: readonly Record<string, unknown>[]
): CanonicalTransitionProposalV1 {
  return { transition_type, domain_deltas: deltas } as unknown as CanonicalTransitionProposalV1;
}

function validate(transition_type: string, deltas: readonly Record<string, unknown>[]) {
  return validateProposalCompositionForStateVersion(v4, proposal(transition_type, deltas));
}

describe("RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — V4 Relationship composition", () => {
  it("accepts exactly one relationship/relationship delta carrying the /relationships replacement", () => {
    expect(validate("Relationship", [delta({ paths: ["/relationships"] })]).ok).toBe(true);
  });

  it("rejects zero deltas and multiple deltas", () => {
    expect(validate("Relationship", []).ok).toBe(false);
    const two = validate("Relationship", [
      delta({ paths: ["/relationships"] }),
      delta({ paths: ["/relationships"] })
    ]);
    expect(two.ok).toBe(false);
  });

  it("rejects a foreign path inside the single Relationship operation", () => {
    for (const path of ["/personality", "/traits_seed", "/beliefs", "/affect", "/mood", "/regulation", "/memory_state"]) {
      const result = validate("Relationship", [delta({ paths: [path] })]);
      expect(result.ok, path).toBe(false);
    }
  });

  it("rejects multiple operations even when every path is /relationships", () => {
    expect(validate("Relationship", [delta({ paths: ["/relationships", "/relationships"] })]).ok).toBe(false);
  });

  it("rejects a multi-domain relationship + foreign-path mutation", () => {
    const result = validate("Relationship", [
      delta({ paths: ["/relationships"] }),
      delta({ producer: "belief", domain: "belief", paths: ["/beliefs"] })
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong producer for the Relationship branch", () => {
    const result = validate("Relationship", [delta({ producer: "belief", paths: ["/relationships"] })]);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong domain for the Relationship branch", () => {
    const result = validate("Relationship", [delta({ domain: "belief", paths: ["/relationships"] })]);
    expect(result.ok).toBe(false);
  });

  it("keeps the V4 allowlist closed: an unadmitted transition type is still rejected", () => {
    const result = validate("CognitionAction", [delta({ paths: ["/relationships"] })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.detail).toContain("does not support CognitionAction");
  });
});
