/**
 * DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0 — provider-boundary
 * wire-format canonicalization law (§15/§17/§27).
 *
 * Deterministic, offline. Proves: the semantic member set is preserved
 * exactly; only representation (array order) is normalized; nothing is
 * dropped, added, deduplicated, aliased or repaired; non-array values are
 * passed through so the frozen validation still rejects them; the input
 * object is never mutated.
 */

import { describe, expect, it } from "vitest";

import {
  SET_LIKE_REF_FIELDS,
  canonicalizeSetLikeRefFields
} from "./wire-format-canonicalization.js";

describe("provider wire-format canonicalization (set-like ref fields)", () => {
  it("§27 invariant: raw [r3, r1, r2] canonicalizes to [r1, r2, r3] with the same members", () => {
    const canonical = canonicalizeSetLikeRefFields({
      relevant_memory_refs: ["episode:e-zeta", "episode:e-alpha", "episode:e-mid"]
    }) as Record<string, unknown>;
    expect(canonical["relevant_memory_refs"]).toEqual([
      "episode:e-alpha",
      "episode:e-mid",
      "episode:e-zeta"
    ]);
    // Member set unchanged (no drop, no add, no dedup).
    expect(canonical["relevant_memory_refs"]).toHaveLength(3);
  });

  it("applies to exactly the three set-like fields and leaves other fields untouched", () => {
    expect([...SET_LIKE_REF_FIELDS]).toEqual([
      "relevant_memory_refs",
      "considered_context_refs",
      "evidence_refs"
    ]);
    const input = {
      relevant_memory_refs: ["episode:e-b", "episode:e-a"],
      considered_context_refs: ["entity:z", "entity:a"],
      evidence_refs: ["entity:z", "entity:a"],
      current_intent: "keep me",
      reasoning_summary: "no reordering of scalars",
      projection_hash: "sha256:x"
    };
    const canonical = canonicalizeSetLikeRefFields(input) as Record<string, unknown>;
    expect(canonical["relevant_memory_refs"]).toEqual(["episode:e-a", "episode:e-b"]);
    expect(canonical["considered_context_refs"]).toEqual(["entity:a", "entity:z"]);
    expect(canonical["evidence_refs"]).toEqual(["entity:a", "entity:z"]);
    expect(canonical["current_intent"]).toBe("keep me");
    expect(canonical["projection_hash"]).toBe("sha256:x");
  });

  it("never mutates the input object", () => {
    const input = { considered_context_refs: ["entity:z", "entity:a"] };
    const before = JSON.stringify(input);
    canonicalizeSetLikeRefFields(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("preserves duplicates so the frozen validator still rejects them", () => {
    const canonical = canonicalizeSetLikeRefFields({
      evidence_refs: ["entity:a", "entity:a"]
    }) as Record<string, unknown>;
    expect(canonical["evidence_refs"]).toEqual(["entity:a", "entity:a"]);
  });

  it("passes non-array and non-object values through unchanged (no coercion, no repair)", () => {
    expect(canonicalizeSetLikeRefFields(null)).toBeNull();
    expect(canonicalizeSetLikeRefFields("string")).toBe("string");
    expect(canonicalizeSetLikeRefFields(["a"])).toEqual(["a"]);
    const canonical = canonicalizeSetLikeRefFields({
      evidence_refs: "entity:a",
      relevant_memory_refs: { not: "an array" }
    }) as Record<string, unknown>;
    expect(canonical["evidence_refs"]).toBe("entity:a");
    expect(canonical["relevant_memory_refs"]).toEqual({ not: "an array" });
  });
});
