/**
 * CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0 — offline wiring matrix (0 model calls).
 *
 * Proves the opt-in flag's contract at the product/session boundary:
 *   Q1/Q18  flag OFF ⇒ no lexical text is forwarded and behaviour is unchanged
 *   Q2      flag ON  ⇒ the current utterance is forwarded
 *   Q3      the EXACT utterance is used (the scene wrapper is never parsed back)
 *   Q9      a no-lexical-signal utterance still falls back lawfully
 *   Q14     the retrieval top-K stays 8, and an out-of-contract utterance is
 *           omitted rather than failing the turn
 *
 * Q5–Q8 and Q10–Q13 (target entry, query-dependence, spurious-promotion and
 * subject/temporal safety) are measured on the REAL subject by the read-only
 * replay, which is strictly stronger than a synthetic fixture.
 *
 * All transports are stubs: no real provider is contacted. Opening a product
 * runtime is expensive, so each flag gets exactly ONE runtime shared by its
 * assertions (the same reason the repository gives its heavy integration suites
 * explicit timeouts).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ADMISSIBLE_LEXICAL_QUERY_CHARS_MAX_V0,
  admissibleLexicalQueryTextV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "@characteros-next/runtime";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { createProductRuntimeV0, type ProductRuntimeV0 } from "./product-runtime.js";
import { resolveProductConfigurationV0, environmentFromRecordV0 } from "./product-configuration.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-query-aware-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const APPRAISAL = JSON.stringify({
  relevance: 0.6,
  goal_congruence: 0.5,
  attribution: "other",
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.4,
  assessment_confidence: 0.6
});
const COGNITION = JSON.stringify({
  schema_version: "conversation-cognition-proposal-v8",
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "offline",
    relevant_memory_handles: [],
    considered_handles: [],
    current_intent: "respond",
    confidence: 0.7,
    uncertainty: 0.3,
    action_intent: null,
    evidence_handles: []
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null
});
const LANGUAGE = JSON.stringify({
  schema_version: "language-realization-semantic-draft-v1",
  text: "Offline reply.",
  evidence_refs: []
});

const stub = (content: string): ModelTransportV0 =>
  ({
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({ content, model: "stub" }) as ModelTransportResponseV0
  }) as ModelTransportV0;

async function openRuntime(dir: string, queryAware: boolean): Promise<ProductRuntimeV0> {
  const environment = environmentFromRecordV0({
    CHARACTEROS_DATA_DIR: dir,
    ...(queryAware ? { CHARACTEROS_QUERY_AWARE_RETRIEVAL: "1" } : {})
  });
  const configuration = resolveProductConfigurationV0({
    environment,
    default_data_root: dir,
    default_data_root_origin: "test"
  });
  const base = createProductProviderBundleV0({ configuration, write: () => undefined });
  const bundle = {
    ...base,
    transports: {
      ...base.transports,
      cognition: stub(COGNITION),
      language: stub(LANGUAGE),
      appraisal: stub(APPRAISAL),
      recall_selector: stub(JSON.stringify({ selection: "ABSTAIN" }))
    }
  };
  return createProductRuntimeV0({
    data_root: dir,
    subject: { display_name: "query-aware" },
    session_label: "query-aware-test",
    environment,
    provider_bundle: bundle,
    write: () => undefined
  });
}

describe("CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0 — admissibility law (Q3)", () => {
  it("passes the caller's EXACT characters through and never parses a scene wrapper", () => {
    const utterance = 'Where does the neighbour\'s cat usually sleep?';
    expect(admissibleLexicalQueryTextV0(utterance)).toBe(utterance);
    // A text that itself looks like the product's scene wrapper is NOT unwrapped:
    // this law has no knowledge of any wrapper, so it can never lose characters.
    const wrapped = 'The user says: "Where does the neighbour\'s cat usually sleep?"';
    expect(admissibleLexicalQueryTextV0(wrapped)).toBe(wrapped);
    // No trimming or normalization of any kind.
    expect(admissibleLexicalQueryTextV0("  spaced  out  ")).toBe("  spaced  out  ");
  });

  it("omits empty and out-of-contract text instead of forwarding it", () => {
    expect(admissibleLexicalQueryTextV0(undefined)).toBeNull();
    expect(admissibleLexicalQueryTextV0(null)).toBeNull();
    expect(admissibleLexicalQueryTextV0("")).toBeNull();
    const atBound = "x".repeat(ADMISSIBLE_LEXICAL_QUERY_CHARS_MAX_V0);
    expect(admissibleLexicalQueryTextV0(atBound)).toBe(atBound);
    expect(admissibleLexicalQueryTextV0(`${atBound}x`)).toBeNull();
  });
});

describe("CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0 — flag OFF", () => {
  it(
    "Q1/Q18: forwards no lexical text and keeps the published default",
    async () => {
      const dir = makeTempDir();
      const runtime = await openRuntime(dir, false);
      expect(runtime.configuration().query_aware_retrieval_enabled.value).toBe(false);
      const result = await runtime.submitHumanText("Where does the neighbour's cat usually sleep?");
      expect(result.outcome.status).toBe("COMPLETE");
      expect(result.outcome.retrieval_lexical_query_applied).toBe(false);
      expect(result.outcome.retrieved_refs.length).toBeLessThanOrEqual(8);
      await runtime.shutdown();
    },
    480_000
  );
});

describe("CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0 — flag ON", () => {
  it(
    "Q2/Q9/Q14 + single-retrieval invariant, all on one runtime",
    async () => {
      const dir = makeTempDir();
      const runtime = await openRuntime(dir, true);
      expect(runtime.configuration().query_aware_retrieval_enabled.value).toBe(true);

      // Q2/Q14 — the utterance reaches retrieval and the top-K stays 8.
      const recall = await runtime.submitHumanText("Where does the neighbour's cat usually sleep?");
      expect(recall.outcome.retrieval_lexical_query_applied).toBe(true);
      expect(recall.outcome.retrieved_refs.length).toBeLessThanOrEqual(8);

      // Single-retrieval invariant: the durable working set is a SUBSET of this
      // turn's own retrieval selection — nothing was merged from a second call.
      const refs = [...recall.outcome.retrieved_refs].sort();
      const episodes = [...recall.outcome.working_episode_refs].sort();
      expect(episodes.every((ref) => refs.includes(ref))).toBe(true);

      // Q9 — a 1-token utterance is below the retrieval package's own meaningful
      // signal floor, so its deterministic structural fallback ranks the
      // candidates; the turn still completes.
      const noSignal = await runtime.submitHumanText("Morning.");
      expect(noSignal.outcome.status).toBe("COMPLETE");
      expect(noSignal.outcome.retrieval_lexical_query_applied).toBe(true);
      expect(noSignal.outcome.retrieved_refs.length).toBeLessThanOrEqual(8);

      // Q14 (bound) — an out-of-contract utterance is OMITTED, not forwarded, so
      // the turn keeps the historical query instead of failing on a schema error.
      const tooLong = await runtime.submitHumanText("x".repeat(ADMISSIBLE_LEXICAL_QUERY_CHARS_MAX_V0 + 1));
      expect(tooLong.outcome.status).toBe("COMPLETE");
      expect(tooLong.outcome.retrieval_lexical_query_applied).toBe(false);

      await runtime.shutdown();
    },
    600_000
  );
});
