import { beforeAll, describe, expect, it } from "vitest";
import { buildWorld, check, parseResponse, prepareProviderInput, preview, restoreBundle, restoreWorld } from "../../research/experiments/familiarity-causal-behavior-v0/adapter.ts";
import { ALICE, CONVENTION_REF, MODEL, ORDER, RUBRIC, type RubricClass } from "../../research/experiments/familiarity-causal-behavior-v0/contract.ts";
import { evaluatorMessages, parseEvaluation, summarize, type ScoredTrial } from "../../research/experiments/familiarity-causal-behavior-v0/evaluator.ts";
import { assertInput, assertCycle, accountDifferences, preflight, type Preflight } from "../../research/experiments/familiarity-causal-behavior-v0/harness.ts";
import { executePrimary } from "../../research/experiments/familiarity-causal-behavior-v0/runner.ts";

let frozen: Preflight;
beforeAll(async () => { frozen = await preflight(); }, 20000);

function scoringFixture(a: RubricClass = "BROAD_CLARIFICATION", b: RubricClass = "NARROW_MISSING_DETAIL"): ScoredTrial[] {
  return ORDER.map(item => ({ ...item, host_valid: true, valid: true,
    evaluation: { classification: item.arm === "A" ? a : b, rationale: "offline test fixture", supporting_refs: item.arm === "A" ? [] : [CONVENTION_REF] }
  }));
}

describe("familiarity causal behavior preregistration (zero network calls)", () => {
  it("builds the real 1/32 and 16/32 paths with all 16 deterministic repetitions", () => {
    expect(frozen.status).toBe("PASS");
    expect(frozen.repeats).toHaveLength(16);
    expect(frozen.repeats.every(t => t.host_valid)).toBe(true);
    expect(frozen.real_model_calls).toBe(0);
    assertCycle(frozen.arms.A, "A"); assertCycle(frozen.arms.B, "B");
  });
  it("freezes exact model, closed rubric, N and counterbalanced trial pairing", () => {
    expect(MODEL.temperature).toBe(0);
    expect(MODEL.digest).toHaveLength(64);
    expect(MODEL.seed).toBeNull();
    expect(ORDER.slice(0, 4).map(t => `${t.arm}${t.trial}`)).toEqual(["A1", "B1", "B2", "A2"]);
    expect(new Set(ORDER.map(t => `${t.arm}${t.trial}`)).size).toBe(16);
    expect(Object.keys(RUBRIC)).toEqual(["BROAD_CLARIFICATION", "EVIDENCE_GROUNDED_CONTEXT_USE", "NARROW_MISSING_DETAIL", "UNSUPPORTED_SHARED_CONTEXT", "OTHER_VALID"]);
  });
  it("records actual prompt differences including revision metadata, not byte equality", () => {
    const accounting = accountDifferences(frozen.arms.A.input, frozen.arms.B.input);
    expect(accounting.provider_inputs_byte_identical).toBe(false);
    expect(accounting.downstream_projection_differences).toContain("state_revision");
    const changed = structuredClone(frozen.arms.B.input);
    changed.messages[0] = { role: "system", content: "different system" };
    expect(() => accountDifferences(frozen.arms.A.input, changed)).toThrow("identical system");
  });
  it("does not give A the B convention and only materializes B's validated selected payload", () => {
    expect(frozen.arms.A.input.evidence).toEqual([]);
    expect(JSON.stringify(frozen.arms.A.input.messages)).not.toContain("no unnecessary apology");
    expect(frozen.arms.B.input.evidence.map(e => e.ref)).toEqual([CONVENTION_REF]);
    expect(frozen.arms.B.input.evidence[0]?.scene).toContain("no unnecessary apology");
    expect(frozen.arms.B.input.evidence[0]?.payload_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
  it("rejects selected content tampering against the repository hash", async () => {
    const world = await buildWorld(16);
    const records = structuredClone(world.records).map(record => record.episode_ref === CONVENTION_REF
      ? { ...record, context: { ...record.context, scene: "Alice said something else." } } : record);
    await expect(prepareProviderInput({ ...world, records }, frozen.arms.B.input.projection)).rejects.toThrow("repository payload hash");
  });
  it("rejects fabricated episode refs and does not treat shape as membership", async () => {
    const world = await buildWorld(16);
    await expect(prepareProviderInput(world, { ...frozen.arms.B.input.projection, recent_retrieval_refs: ["episode:forged" as never] })).rejects.toThrow("payload membership");
  });
  it("rejects receipt refs as factual content and a modified scenario before generation", async () => {
    const world = await buildWorld(16);
    await expect(prepareProviderInput(world, { ...frozen.arms.B.input.projection,
      recent_retrieval_refs: [`appraisal:${"1".repeat(64)}` as never] })).rejects.toThrow("only lawful episode refs");
    const input = structuredClone(frozen.arms.A.input);
    expect(() => assertInput({ ...input, projection: { ...input.projection, context: { ...input.projection.context, scene: "Different scene" } } }, "A")).toThrow("frozen scenario");
  });
  it("has genuine high Bob familiarity without Alice retrieval/evidence leakage", () => {
    const bob = frozen.controls.wrong_counterpart;
    expect(bob.queries).toEqual([]);
    expect(bob.input.evidence).toEqual([]);
    expect(bob.input.projection.interaction_familiarity_cognition_influences.map(i => i.counterpart_ref)).toEqual([ALICE]);
    expect(bob.input.projection.interaction_familiarity.find(f => f.counterpart_ref === "entity:bob")?.canonical_value).toBe(0.5);
  });
  it("high familiarity plus empty retrieval supplies no invented convention", () => {
    assertCycle(frozen.controls.empty_retrieval, "B", true);
    expect(frozen.controls.empty_retrieval.input.evidence).toEqual([]);
    expect(JSON.stringify(frozen.controls.empty_retrieval.input.messages)).not.toContain("no unnecessary apology");
  });
  it("survives fresh-process authoritative restore exactly in both arms", () => {
    expect(frozen.fresh_restore.A).toEqual(frozen.arms.A);
    expect(frozen.fresh_restore.B).toEqual(frozen.arms.B);
  });
  it("rejects tampered restore payload bindings instead of re-ingesting history", async () => {
    const saved = await restoreBundle(await buildWorld(16));
    const records = saved.records.map(r => r.episode_ref === CONVENTION_REF ? { ...r, context: { ...r.context, scene: "tampered" } } : r);
    await expect(restoreWorld({ ...saved, records })).rejects.toThrow("fresh Memory binding");
  });
  it("keeps observation envelope distinct from unchanged production proposal", () => {
    const cognition = frozen.arms.A.result.cognition;
    const parsed = parseResponse(JSON.stringify({ cognition, reply: "Which convention should I use?" }));
    expect(parsed.cognition).toEqual(cognition);
    expect(() => parseResponse(JSON.stringify({ cognition, reply: "hello", extra: true }))).toThrow("closed experiment envelope");
    expect(() => parseResponse(JSON.stringify({ cognition, reply: "" }))).toThrow("reply required");
    expect(() => parseResponse(JSON.stringify({ cognition: {}, reply: "hello" }))).toThrow("production cognition");
  });
  it("blinds evaluator input to arm, strategy, familiarity and primary cognition", () => {
    const messages = evaluatorMessages("Please share the draft.", frozen.arms.B.input.evidence);
    const payload = JSON.parse(messages[1]?.content ?? "null") as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(["scenario", "reply", "lawful_memory_evidence"]);
    for (const forbidden of ["ARM A", "ARM B", "0.03125", "SEARCH_FIRST", "projection_hash", "desired outcome"]) {
      expect(JSON.stringify(messages)).not.toContain(forbidden);
    }
  });
  it("rejects malformed evaluator classifications, extra keys and invented grounding refs", () => {
    const evidence = frozen.arms.B.input.evidence;
    const judgment = { classification: "NARROW_MISSING_DETAIL", rationale: "Uses convention; requests draft", supporting_refs: [CONVENTION_REF] };
    expect(parseEvaluation(JSON.stringify(judgment), evidence).classification).toBe("NARROW_MISSING_DETAIL");
    expect(() => parseEvaluation(JSON.stringify(judgment), [])).toThrow("INVALID_EVALUATOR");
    expect(() => parseEvaluation(JSON.stringify({ ...judgment, supporting_refs: [] }), evidence)).toThrow("UNGROUNDED");
    expect(() => parseEvaluation(JSON.stringify({ ...judgment, classification: "FRIENDLY" }), evidence)).toThrow("INVALID_EVALUATOR");
    expect(() => parseEvaluation(JSON.stringify({ ...judgment, arm: "B" }), evidence)).toThrow("INVALID_EVALUATOR");
  });
  it("counts semantic acceptance, inconclusive behavior, hard grounding failures and host invalidation separately", () => {
    expect(summarize(scoringFixture()).interpretation).toBe("PASS");
    expect(summarize(scoringFixture()).paired_directional).toBe(8);
    expect(summarize(scoringFixture("OTHER_VALID", "OTHER_VALID")).interpretation).toBe("ENGINEERING_PASS_BEHAVIOR_INCONCLUSIVE");
    const unsupported = scoringFixture("UNSUPPORTED_SHARED_CONTEXT");
    expect(summarize(unsupported).interpretation).toBe("SAFETY_GROUNDING_FAIL");
    const first = unsupported[0]; check(first, "fixture"); first.host_valid = false;
    expect(summarize(unsupported).interpretation).toBe("INVALID_EXPERIMENT");
  });
  it("cannot pass missing/duplicate/invalid trials or only five directional pairs", () => {
    expect(summarize(scoringFixture().slice(1)).interpretation).toBe("INVALID_EXPERIMENT");
    const duplicated = scoringFixture(); check(duplicated[1], "fixture"); duplicated[0] = duplicated[1];
    expect(summarize(duplicated).interpretation).toBe("INVALID_EXPERIMENT");
    const few = scoringFixture().map(t => t.trial > 5 ? { ...t, evaluation: { classification: "OTHER_VALID" as const, rationale: "fixture", supporting_refs: [] } } : t);
    expect(summarize(few).interpretation).toBe("ENGINEERING_PASS_BEHAVIOR_INCONCLUSIVE");
  });
  it("executes all 16 mock primary/evaluator calls, preserving inputs/raw results before scoring", async () => {
    const artifacts = new Map<string, unknown>();
    let primary = 0;
    let judges = 0;
    const result = await executePrimary({ preflight: frozen, guard: async () => {}, save: async (name, data) => {
      expect(artifacts.has(name)).toBe(false); artifacts.set(name, structuredClone(data));
    }, primary: { complete: async request => {
      primary++;
      expect(artifacts.has(`observation-${String(primary).padStart(2, "0")}/input`)).toBe(true);
      const arm = JSON.stringify(request.messages) === JSON.stringify(frozen.arms.A.input.messages) ? "A" : "B";
      return { model: MODEL.model, content: JSON.stringify({ cognition: frozen.arms[arm].result.cognition,
        reply: arm === "A" ? "Which convention should I use?" : "I will use concise, factual wording without unnecessary apology. Please share the update." }) };
    } }, evaluator: { complete: async request => {
      judges++;
      expect(artifacts.has(`observation-${String(judges).padStart(2, "0")}/raw-provider`)).toBe(true);
      const payload = JSON.parse(request.messages[1]?.content ?? "null") as { lawful_memory_evidence: unknown[] };
      const hasEvidence = payload.lawful_memory_evidence.length > 0;
      return { model: MODEL.model, content: JSON.stringify({ classification: hasEvidence ? "NARROW_MISSING_DETAIL" : "BROAD_CLARIFICATION",
        rationale: "offline evaluator fixture, not a real semantic judgment", supporting_refs: hasEvidence ? [CONVENTION_REF] : [] }) };
    } } });
    expect(result.interpretation).toBe("PASS"); expect(primary).toBe(16); expect(judges).toBe(16);
    expect(artifacts.has("arm-map")).toBe(true); expect(artifacts.has("result")).toBe(true);
  }, 20000);
  it("retains every malformed primary output without retries or evaluating invented replies", async () => {
    let primary = 0;
    const raw: unknown[] = [];
    const result = await executePrimary({ preflight: frozen, guard: async () => {}, save: async (name, data) => { if (name.endsWith("raw-provider")) raw.push(data); },
      primary: { complete: async () => { primary++; return { content: "not JSON", model: MODEL.model }; } },
      evaluator: { complete: async () => { throw new Error("must not evaluate malformed provider output"); } }
    });
    expect(primary).toBe(16); expect(raw).toHaveLength(16);
    expect(result.evaluator_calls).toBe(0); expect(result.interpretation).toBe("INVALID_EXPERIMENT");
  }, 20000);
  it("aborts before any generation on a host/config guard failure", async () => {
    let primary = 0;
    const result = await executePrimary({ preflight: frozen, guard: async () => { throw new Error("identity drift"); }, save: async () => {},
      primary: { complete: async () => { primary++; throw new Error("must not call"); } },
      evaluator: { complete: async () => { throw new Error("must not call"); } }
    });
    expect(primary).toBe(0); expect(result.trials).toHaveLength(1); expect(result.interpretation).toBe("INVALID_EXPERIMENT");
  });
  it("normal cognition still rejects unsupported citation even in a syntactically valid envelope", async () => {
    const world = await buildWorld(1);
    const projection = (await preview(world)).input.projection;
    expect(projection.recent_retrieval_refs).toEqual([]);
    const result = await executePrimary({ preflight: frozen, guard: async () => {}, save: async () => {},
      primary: { complete: async request => {
        const arm = JSON.stringify(request.messages) === JSON.stringify(frozen.arms.A.input.messages) ? "A" : "B";
        return { content: JSON.stringify({ cognition: { ...frozen.arms[arm].result.cognition, evidence_refs: ["episode:forged"] }, reply: "fixture" }), model: MODEL.model };
      } }, evaluator: { complete: async () => { throw new Error("unsupported citations must not reach evaluator"); } }
    });
    expect(result.evaluator_calls).toBe(0); expect(result.interpretation).toBe("INVALID_EXPERIMENT");
  }, 20000);
});
