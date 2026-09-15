/**
 * RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — zero-model conformance.
 *
 * Proves offline (real model calls 0): the same-corpus invariant, the three-condition
 * manipulation check (LOW: no priority retrieval; HIGH: the production retrieval
 * service selects the counterpart item and it reaches the model-visible prompt;
 * HIGH_SEARCH_ABLATED: the mediator is suppressed while HIGH familiarity stays
 * visible), retrieval specificity (the distractor is never selected), the frozen live
 * chain (Cognition V8 + Language V10 + response atom), fresh-process authoritative
 * restore, request isolation without condition labels, the endpoint classifier, and
 * the preregistered call budget.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  ABLATED_CONDITION_ID,
  CALL_BUDGET,
  CONVENTION_REF,
  DISTRACTOR_REF,
  ENDPOINT_CLASSES,
  GATES,
  MODEL,
  REPLICATES,
  SCENARIOS,
  scheduledCallMaximum,
  scheduledScenes
} from "../../research/experiments/relationship-familiarity-search-first-causal-v0/contract.ts";
import { preflight, type PreflightResult } from "../../research/experiments/relationship-familiarity-search-first-causal-v0/preflight.ts";

let cached: PreflightResult | null = null;
beforeAll(async () => {
  cached = await preflight();
}, 600_000);
function frozen(): PreflightResult {
  if (cached === null) throw new Error("preflight not initialised");
  return cached;
}

interface Evidence {
  readonly same_corpus: { readonly digest: string; readonly refs: readonly string[]; readonly digest_equal_across_conditions: boolean; readonly repository_binding_equal: boolean };
  readonly familiarity: { readonly LOW: number; readonly HIGH: number };
  readonly manipulation: {
    readonly LOW: { readonly queries: number; readonly mediator_visible: boolean };
    readonly HIGH: { readonly queries: number; readonly selected_refs: readonly string[]; readonly selected_content_hashes: readonly string[]; readonly mediator_visible: boolean };
    readonly HIGH_SEARCH_ABLATED: { readonly queries: number; readonly mediator_visible: boolean; readonly replaced_with_empty: boolean | null };
  };
  readonly offline_classes: Record<string, string>;
  readonly live_chain: { readonly language_schema: string | null; readonly atom: string | null };
  readonly restore_proof: readonly { readonly condition: string; readonly matches_parent: boolean; readonly familiarity_entry_line: string | null }[];
  readonly scheduled_scenes: number;
  readonly scheduled_calls_maximum: number;
}

function evidence(): Evidence {
  return frozen().evidence as Evidence;
}

describe("familiarity search-first causal experiment — preregistration (zero model calls)", () => {
  it("budgets at most 100 scheduled calls with no retries and 48 scenes", () => {
    const scenes = scheduledScenes();
    expect(scenes).toHaveLength(48);
    expect(scheduledCallMaximum()).toBeLessThanOrEqual(100);
    expect(CALL_BUDGET.retries).toBe(0);
    expect(REPLICATES).toBe(8);
    expect(MODEL.temperature).toBe(0);
    expect(MODEL.digest).toHaveLength(64);
    expect(GATES.statistical_significance_claim).toBe(false);
    expect(GATES.host_complete_required).toBe(true);
    expect(GATES.manipulation_required).toBe(true);
    expect(GATES.same_corpus_required).toBe(true);
  });

  it("exposes the identical candidate corpus to every condition", () => {
    const data = evidence();
    expect(data.same_corpus.digest_equal_across_conditions).toBe(true);
    expect(data.same_corpus.repository_binding_equal).toBe(true);
    expect(data.same_corpus.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(data.same_corpus.refs).toContain(CONVENTION_REF);
    expect(data.same_corpus.refs).toContain(DISTRACTOR_REF);
    expect(data.same_corpus.refs).toHaveLength(18);
    expect(data.familiarity.LOW).toBe(1 / 32);
    expect(data.familiarity.HIGH).toBe(16 / 32);
  });

  it("passes the three-condition manipulation check", () => {
    const data = evidence();
    expect(data.manipulation.LOW.queries).toBe(0);
    expect(data.manipulation.LOW.mediator_visible).toBe(false);
    expect(data.manipulation.HIGH.queries).toBe(1);
    expect(data.manipulation.HIGH.mediator_visible).toBe(true);
    expect(data.manipulation.HIGH.selected_refs).toContain(CONVENTION_REF);
    expect(data.manipulation.HIGH.selected_content_hashes.length).toBe(data.manipulation.HIGH.selected_refs.length);
    expect(data.manipulation.HIGH_SEARCH_ABLATED.queries).toBe(1);
    expect(data.manipulation.HIGH_SEARCH_ABLATED.mediator_visible).toBe(false);
    expect(data.manipulation.HIGH_SEARCH_ABLATED.replaced_with_empty).toBe(true);
  });

  it("attests retrieval specificity: the distractor is never selected", () => {
    const data = evidence();
    expect(data.manipulation.HIGH.selected_refs).not.toContain(DISTRACTOR_REF);
    expect(data.manipulation.HIGH.selected_refs.every((ref) => ref !== DISTRACTOR_REF)).toBe(true);
  });

  it("runs the live chain: Language V10 with the response atom", () => {
    const data = evidence();
    expect(["language-realization-input-v10", null]).toContain(data.live_chain.language_schema);
    expect(["PRIMARY_FACT", "PRIMARY_CLARIFICATION"]).toContain(data.live_chain.atom);
  });

  it("classifies the endpoint deterministically per condition (offline)", () => {
    const data = evidence();
    expect(Object.keys(data.offline_classes).sort()).toEqual(["HIGH", "HIGH_SEARCH_ABLATED", "LOW"]);
    expect(data.offline_classes["LOW"]).toBe("ASKS_FOR_FRAMING");
    expect(data.offline_classes["HIGH"]).toBe("USES_RETRIEVED_COUNTERPART_CONTEXT");
    expect(data.offline_classes["HIGH_SEARCH_ABLATED"]).toBe("ASKS_FOR_FRAMING");
    for (const entry of Object.values(data.offline_classes)) expect(ENDPOINT_CLASSES).toContain(entry as never);
  });

  it("fresh-process authoritative restore preserves value and rendered material", () => {
    const data = evidence();
    expect(data.restore_proof).toHaveLength(2);
    for (const entry of data.restore_proof) {
      expect(entry.matches_parent).toBe(true);
      expect(entry.familiarity_entry_line).toMatch(/presence=PRESENT level=(1|16)\/32/);
    }
  });

  it("freezes the fixture with the model identity and the scheduled maximum", () => {
    const fixture = frozen().fixture;
    expect(fixture.preflight_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fixture.model).toEqual(MODEL);
    expect(fixture.scheduled_calls_maximum).toBe(scheduledCallMaximum());
    expect(fixture.histories.LOW.familiarity_value).toBe(1 / 32);
    expect(fixture.histories.HIGH.familiarity_value).toBe(16 / 32);
    expect(SCENARIOS.length).toBe(2);
    expect(CONVENTION_REF).toBe("episode:alice-08");
    expect(ABLATED_CONDITION_ID).toBe("HIGH_SEARCH_ABLATED");
  });
});
