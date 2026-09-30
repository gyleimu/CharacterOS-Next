/**
 * DecisionProbeV1 — V1-C3 preregistration test. ZERO model calls.
 *
 * This suite IS the preregistration gate: it must pass BEFORE any C3 model call. It proves the
 * paraphrase is constructionally minimal, lexically separated, symmetric and structurally
 * equivalent, and that the manifest is content-addressed and frozen.
 */

import { describe, expect, it } from "vitest";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED } from "./contract.ts";
import {
  auditC3ConstructionV0,
  auditC3LexicalSeparationV0,
  auditC3StructuralEquivalenceV0,
  auditC3SymmetryV0,
  C3_FORBIDDEN_OVERLAP_TERMS,
  C3_OVERRIDE_BLOCK,
  C3_PARAPHRASE_DEFINITIONS_V1,
  deriveC3ManifestV1
} from "./c3-paraphrase.ts";

describe("V1-C3 — preregistration audits (must pass before any C3 call)", () => {
  it("all four audits PASS", async () => {
    const manifest = await deriveC3ManifestV1();
    for (const audit of manifest.audits) {
      expect(`${audit.audit}:${audit.status}`).toBe(`${audit.audit}:PASS`);
    }
    expect(manifest.all_audits_pass).toBe(true);
    expect(manifest.audits).toHaveLength(4);
  });

  it("only the three definition lines changed, and the line count is unchanged", () => {
    const audit = auditC3ConstructionV0();
    expect(audit.status).toBe("PASS");
    expect(C3_OVERRIDE_BLOCK.split("\n")).toHaveLength(
      DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.split("\n").length
    );
    expect(audit.detail.join(" ")).toContain("exactly lines");
  });

  it("no forbidden overlap term and no shared 6-gram with any fixture", () => {
    const audit = auditC3LexicalSeparationV0();
    expect(audit.status).toBe("PASS");
    const text = Object.values(C3_PARAPHRASE_DEFINITIONS_V1).join(" ").toLowerCase();
    for (const term of C3_FORBIDDEN_OVERLAP_TERMS) {
      expect(new RegExp(`\\b${term}\\b`).test(text)).toBe(false);
    }
  });

  it("symmetry holds: comparable word counts, same unpunctuated clause style", () => {
    const audit = auditC3SymmetryV0();
    expect(audit.status).toBe("PASS");
    const words = DECISION_PROBE_DECISIONS.map(
      (token) => C3_PARAPHRASE_DEFINITIONS_V1[token as keyof typeof C3_PARAPHRASE_DEFINITIONS_V1].split(/\s+/).length
    );
    expect(Math.max(...words) - Math.min(...words)).toBeLessThanOrEqual(6);
  });

  it("both wordings satisfy the same construct skeleton", () => {
    expect(auditC3StructuralEquivalenceV0().status).toBe("PASS");
  });

  it("the manifest is content-addressed, frozen, and honestly declares semantic equivalence as unproven", async () => {
    const first = await deriveC3ManifestV1();
    const second = await deriveC3ManifestV1();
    expect(first.hashes.manifest_hash).toBe(second.hashes.manifest_hash);
    expect(first.hashes.c3_override_block_hash).not.toBe(first.hashes.original_override_block_hash);
    expect(first.hashes.c3_override_block_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.semantic_equivalence).toBe("DECLARED_BY_AUTHOR_NOT_MECHANICALLY_PROVEN");
    expect(Object.isFrozen(C3_PARAPHRASE_DEFINITIONS_V1)).toBe(true);
  });

  it("the decision tokens themselves are untouched by the paraphrase", () => {
    for (const token of DECISION_PROBE_DECISIONS) {
      expect(C3_OVERRIDE_BLOCK).toContain(`  ${token} —`);
      expect(C3_OVERRIDE_BLOCK).toContain(`"${token}"`);
    }
    expect(C3_OVERRIDE_BLOCK).toContain(
      `"decision": one of "ACCEPT" | "VERIFY" | "REJECT"`
    );
  });
});
