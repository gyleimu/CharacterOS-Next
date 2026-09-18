/**
 * DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 — representation normalization and the
 * model-facing ref/quote laws (zero model calls).
 *
 * Covers E4 (unordered set-like refs are canonicalized before the frozen
 * validator runs), E5 (normalization never adds, drops, substitutes or
 * deduplicates a ref), E6 (nothing that could repair a quote is touched) and E7
 * (the model-facing prompts state the ordering and exact-copy laws).
 */

import { describe, expect, it } from "vitest";
import { validateLanguageRealizationSemanticDraftV1 } from "@characteros-next/behavior";

import {
  canonicalizeSetLikeRefArraysV0,
  SET_LIKE_REFS_CANONICALIZED_V0
} from "./robust-cognition-output-v8.js";
import {
  LANGUAGE_REALIZATION_SYSTEM_PROMPT_V0,
  LANGUAGE_REALIZATION_SYSTEM_PROMPT_V1,
  LANGUAGE_REALIZATION_SYSTEM_PROMPT_V2_C44
} from "./language-realization-provider.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } from "./conversation-cognition-provider-v8.js";

interface DraftShape {
  readonly schema_version: string;
  readonly text: string;
  readonly evidence_refs: readonly unknown[];
}

function draft(evidenceRefs: readonly unknown[], text = "ok"): DraftShape {
  return { schema_version: "language-realization-semantic-draft-v1", text, evidence_refs: evidenceRefs };
}

function refsOf(value: unknown): readonly unknown[] {
  return (value as DraftShape).evidence_refs;
}

describe("E4: set-like ref arrays are canonicalized before validation", () => {
  it("the frozen validator rejects an unsorted ref array as-is", () => {
    const checked = validateLanguageRealizationSemanticDraftV1(draft(["observation:b", "observation:a"]));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.detail).toContain("refs not lexicographically sorted");
  });

  it("canonical ordering restores the same meaning, and the validator then accepts it", () => {
    const canonical = canonicalizeSetLikeRefArraysV0(draft(["observation:b", "observation:a"]));
    expect(canonical.applied).toBe(true);
    expect(canonical.reordered_fields).toEqual(["evidence_refs"]);
    const checked = validateLanguageRealizationSemanticDraftV1(canonical.value);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.value.evidence_refs).toEqual(["observation:a", "observation:b"]);
    expect(SET_LIKE_REFS_CANONICALIZED_V0).toBe("SET_LIKE_REFS_CANONICALIZED");
  });

  it("deterministic: canonicalizing an already-canonical draft changes nothing (same reference)", () => {
    const already = draft(["observation:a", "observation:b"]);
    const canonical = canonicalizeSetLikeRefArraysV0(already);
    expect(canonical.applied).toBe(false);
    expect(canonical.value).toBe(already);
  });
});

describe("E5: normalization preserves the exact ref multiset", () => {
  it("keeps every ref and its multiplicity (no add, drop or substitute)", () => {
    const input = draft(["observation:c", "observation:a", "observation:b"]);
    const canonical = canonicalizeSetLikeRefArraysV0(input);
    const before = [...refsOf(input)].sort();
    const after = [...refsOf(canonical.value)].sort();
    expect(after).toEqual(before);
    expect(refsOf(canonical.value)).toHaveLength(refsOf(input).length);
  });

  it("duplicates survive canonicalization and are STILL rejected by the frozen validator", () => {
    const duplicated = draft(["observation:b", "observation:a", "observation:b"]);
    const canonical = canonicalizeSetLikeRefArraysV0(duplicated);
    expect(refsOf(canonical.value)).toHaveLength(3);
    const checked = validateLanguageRealizationSemanticDraftV1(canonical.value);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.detail).toContain("duplicate ref");
  });

  it("leaves non-string elements, non-arrays and non-objects untouched", () => {
    const nonStrings = draft(["observation:a", 42]);
    expect(canonicalizeSetLikeRefArraysV0(nonStrings).applied).toBe(false);
    expect(canonicalizeSetLikeRefArraysV0(null).applied).toBe(false);
    expect(canonicalizeSetLikeRefArraysV0([{ evidence_refs: ["observation:b", "observation:a"] }]).applied).toBe(false);
  });
});

describe("E6: nothing that could repair content is touched", () => {
  it("text and any other field are byte-identical after canonicalization", () => {
    const input = draft(["observation:b", "observation:a"], "the tape is holding");
    const canonical = canonicalizeSetLikeRefArraysV0(input).value as DraftShape;
    expect(canonical.text).toBe("the tape is holding");
    expect(canonical.schema_version).toBe("language-realization-semantic-draft-v1");
  });

  it("only the declared field list is considered", () => {
    const other = { schema_version: "x", text: "t", evidence_refs: ["observation:a"], other_refs: ["z", "a"] };
    const canonical = canonicalizeSetLikeRefArraysV0(other);
    expect(canonical.applied).toBe(false);
    expect(canonical.value).toBe(other);
  });
});

describe("E7: model-facing instructions state the frozen laws", () => {
  it("the production language prompt (v7–v10) states the ref ordering law with an example", () => {
    expect(LANGUAGE_REALIZATION_SYSTEM_PROMPT_V2_C44).toContain("ASCENDING LEXICOGRAPHIC (ASCII) ORDER");
    expect(LANGUAGE_REALIZATION_SYSTEM_PROMPT_V2_C44).toContain('["ref-b","ref-a"]');
    expect(LANGUAGE_REALIZATION_SYSTEM_PROMPT_V2_C44).toContain("rejects duplicates");
  });

  it("the older language prompts state the same law (no drift)", () => {
    for (const prompt of [LANGUAGE_REALIZATION_SYSTEM_PROMPT_V0, LANGUAGE_REALIZATION_SYSTEM_PROMPT_V1]) {
      expect(prompt).toContain("ASCENDING LEXICOGRAPHIC");
      expect(prompt).toContain("rejects");
    }
  });

  it("the cognition prompt's preregistered SOURCE_QUOTE clause is unchanged (frozen request identity)", () => {
    // DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 attempted to strengthen this clause and
    // reverted it: the frozen preregistered experiments pin the exact request bytes
    // (research/experiments/**), and historical request identity is immutable. The
    // validator stays strict and unchanged; only the language-side ref law and its
    // model-facing wording were strengthened.
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8).toContain(
      "SOURCE_QUOTE text must occur verbatim, with exact case and punctuation, in every cited source"
    );
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8).not.toContain("COPIED BYTE-FOR-BYTE");
  });
});
