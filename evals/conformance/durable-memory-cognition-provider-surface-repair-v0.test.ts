/**
 * DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0 — CI conformance gate.
 *
 * Machine-proof over persisted evidence and the frozen built production roots
 * (zero real model calls):
 *   §23/§48.1-3  memory facts are provider-visible and content-distinguishable;
 *   §24/§25      the two frozen lives' real projections now render visibly
 *                different factual memory, with ZERO unexpected confounds;
 *   §48.4/§22    no-memory and ablated inputs stay lawful (no fabricated memory);
 *   §48.5/§14    legacy V0/V1 (v3) prompt behavior unchanged;
 *   §48.8-10     boundary canonicalization accepts unsorted valid refs while
 *                duplicates/unknown refs still fail closed;
 *   §30/§31      real smoke: schema acceptance restored on the same inputs.
 */

/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Conformance consumer of isolated experiment host and frozen built roots. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ConversationCognitionProviderV1 } from "../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js";

const REPAIR_DIR = "research/experiments/durable-memory-cognition-provider-surface-repair-v0";
const REPAIR_EVIDENCE = join(process.cwd(), REPAIR_DIR, "evidence");
const FROZEN_AUDIT = join(
  process.cwd(),
  "research/experiments/durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider/future-input-diff-audit.json"
);

type Projection = Record<string, unknown> & { readonly projection_hash: string };

function frozenProjections(): Record<string, Projection> {
  return (JSON.parse(readFileSync(FROZEN_AUDIT, "utf8")) as { projections: Record<string, Projection> }).projections;
}

/** Deterministic render of the production provider request (zero model calls). */
async function renderRequest(projection: Projection, responseOverrides: Record<string, unknown> = {}): Promise<string> {
  let captured = "";
  const provider = new ConversationCognitionProviderV1({
    complete: async (request: { messages: { role: string; content: string }[] }) => {
      captured = request.messages.find((message) => message.role === "user")?.content ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projection.projection_hash,
            reasoning_summary: "conformance capture",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: null,
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_refs: [],
            ...responseOverrides
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "conformance-fake"
      };
    }
  } as never);
  await provider.propose(projection as never);
  return captured;
}

function memoryBlock(text: string): string {
  const start = text.indexOf("[PRIOR FACTUAL MEMORY");
  if (start < 0) return "";
  const end = text.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
  return text.slice(start, end + "[END HISTORICAL FACTUAL CONTENT]".length);
}

describe("DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0 — conformance", () => {
  it("§24/§48.1-3 the frozen lives' real projections render content-distinguishable factual memory", async () => {
    if (!existsSync(FROZEN_AUDIT)) {
      console.log("frozen future-divergence evidence absent (pre-collection checkout); skipping");
      return;
    }
    const projections = frozenProjections();
    const renderedA = await renderRequest(projections["MEM_A"]!);
    const renderedB = await renderRequest(projections["MEM_B"]!);

    expect(renderedA).toContain("[PRIOR FACTUAL MEMORY");
    expect(renderedB).toContain("[PRIOR FACTUAL MEMORY");
    expect(renderedA).not.toBe(renderedB);
    // The differing lived behavior text is exactly what became visible.
    expect(renderedA).toContain("delivered_behavior_text: \"Alice, the draft is ready for review");
    expect(renderedA).toContain("we can proceed with the other review tasks.");
    expect(renderedB).toContain("I can proceed with reviewing the rest of the document.");
    expect(renderedA).not.toContain("I can proceed with reviewing the rest of the document.");
    expect(memoryBlock(renderedA)).not.toBe(memoryBlock(renderedB));
    // Content-level difference survives with the hash line and affect line removed.
    const strip = (text: string): string =>
      memoryBlock(text) === "" ? text : text.replace(memoryBlock(text), "").replace(/^\[projection_hash\].*$/m, "").replace(/^\[affect \(canonical\)\].*$/m, "");
    expect(strip(renderedA)).toBe(strip(renderedB));
  });

  it("§25 persisted provider-content audit is confound-free with the expected classification", () => {
    const auditPath = join(REPAIR_EVIDENCE, "provider-content-diff.json");
    if (!existsSync(auditPath)) {
      console.log("repair evidence absent; skipping");
      return;
    }
    const audit = JSON.parse(readFileSync(auditPath, "utf8")) as {
      rendered_blocks_differ: boolean;
      shared_surrounding_context: boolean;
      memory_section_present: Record<string, boolean>;
      rendered_a_vs_b: {
        differ: boolean;
        structurally_equal: boolean;
        classification_counts: Record<string, number>;
        unexpected_confound_count: number;
        affect_residual_below_threshold: boolean;
        affect_residual_absolute: number;
      };
    };
    expect(audit.rendered_blocks_differ).toBe(true);
    expect(audit.shared_surrounding_context).toBe(true);
    expect(audit.rendered_a_vs_b.differ).toBe(true);
    expect(audit.rendered_a_vs_b.structurally_equal).toBe(true);
    expect(audit.rendered_a_vs_b.unexpected_confound_count).toBe(0);
    expect(audit.rendered_a_vs_b.affect_residual_below_threshold).toBe(true);
    expect(audit.rendered_a_vs_b.affect_residual_absolute).toBeLessThan(0.001);
    expect(Object.keys(audit.rendered_a_vs_b.classification_counts).sort()).toEqual([
      "EXPECTED_BOUNDED_AFFECT_RESIDUAL",
      "EXPECTED_DERIVED_HASH",
      "EXPECTED_MEMORY_CONTENT",
      "EXPECTED_REF_IDENTITY"
    ]);
    // Treatment arms render memory; the preregistered ablation arms do not.
    expect(audit.memory_section_present["MEM_A"]).toBe(true);
    expect(audit.memory_section_present["MEM_B"]).toBe(true);
    expect(audit.memory_section_present["MEM_ABL_A"]).toBe(false);
    expect(audit.memory_section_present["MEM_ABL_B"]).toBe(false);
  });

  it("§22/§48.4 no-memory and ablated projections render no memory section and stay lawful", async () => {
    if (!existsSync(FROZEN_AUDIT)) return;
    const projections = frozenProjections();
    for (const arm of ["MEM_ABL_A", "MEM_ABL_B"] as const) {
      const rendered = await renderRequest(projections[arm]!);
      expect(rendered).not.toContain("PRIOR FACTUAL MEMORY");
      // No fabricated placeholder memory.
      expect(rendered).toContain("[memory evidence (allowed refs)]");
    }
  });

  it("§14/§48.5 legacy V0/V1 projections render the legacy Affect/Mood surface and no memory section", async () => {
    const legacy = {
      schema_version: "cognitive-context-projection-v0",
      subject_id: "subject-s0",
      current_logical_time: 1,
      state_revision: 1,
      traits_dimensions: {},
      affect_channels: [{ channel: "warmth", strength: 0.4 }],
      mood_baseline: 0.5,
      regulation: { energy: 0.5, stress: 0.2, arousal: 0.2, fatigue: 0.1 },
      context: { scene: "legacy", task: null, focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: null },
      memory_working_refs: [],
      recent_retrieval_refs: [],
      belief_item_count: 0,
      belief_items: [],
      relationship_counterpart_count: 0,
      relationship_dimensions: [],
      interaction_familiarity: [],
      interaction_familiarity_cognition_influences: [],
      allowed_actions: [],
      projection_hash: "sha256:legacy"
    } as unknown as Projection;
    const rendered = await renderRequest(legacy);
    expect(rendered).not.toContain("PRIOR FACTUAL MEMORY");
    expect(rendered).toContain("[affect] warmth=0.4");
    expect(rendered).toContain("[mood] baseline=0.5");
    expect(rendered).not.toContain("[affect (canonical)]");
  });

  it("§48.8-10 unsorted valid refs are accepted after boundary canonicalization; bad refs still fail closed", async () => {
    if (!existsSync(FROZEN_AUDIT)) return;
    const projection = frozenProjections()["MEM_A"]!;
    const unsorted = ["subject:s0", "episode:31133e5726958115f63517683f50b7f262fd9d08d0ed9b9d588b48c227e66ec0", "entity:alice"];
    const accepted = await renderRequest(projection, { considered_context_refs: unsorted });
    expect(accepted).toContain("PRIOR FACTUAL MEMORY");

    // Duplicate ref still fails closed (canonicalization is not permissive parsing).
    const duplicateProvider = new ConversationCognitionProviderV1({
      complete: async () => ({
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projection.projection_hash,
            reasoning_summary: "duplicate probe",
            relevant_memory_refs: [],
            considered_context_refs: ["entity:alice", "entity:alice"],
            current_intent: null,
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "conformance-fake"
      })
    } as never);
    const duplicateError = await duplicateProvider.propose(projection as never).catch((error: unknown) => error);
    expect((duplicateError as { code?: string }).code).toBe("MODEL_SCHEMA_INVALID");
    expect(String((duplicateError as Error).message)).toContain("duplicate ref");
  });

  it("§30/§31 real smoke evidence: same inputs now pass frozen schema validation", () => {
    const summaryPath = join(REPAIR_EVIDENCE, "real-smoke", "summary.json");
    if (!existsSync(summaryPath)) {
      console.log("real smoke absent; skipping");
      return;
    }
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
      cognition_calls: number;
      language_calls: number;
      schema_accepted: number;
      all_schema_accepted: boolean;
      factual_text_present_in_every_request_with_memory_section: boolean;
      requests_with_memory_section: string;
      rows: { arm: string; status: string; memory_section_present: boolean; factual_text_present: boolean }[];
    };
    expect(summary.cognition_calls).toBeLessThanOrEqual(5);
    expect(summary.language_calls).toBe(0);
    expect(summary.all_schema_accepted).toBe(true);
    expect(summary.schema_accepted).toBe(summary.cognition_calls);
    expect(summary.factual_text_present_in_every_request_with_memory_section).toBe(true);
    expect(summary.requests_with_memory_section).toContain("2/4");
    for (const arm of ["MEM_A", "MEM_B"]) {
      const row = summary.rows.find((candidate) => candidate.arm === arm)!;
      expect(row.status).toBe("VALID");
      expect(row.memory_section_present).toBe(true);
      expect(row.factual_text_present).toBe(true);
    }
    for (const arm of ["MEM_ABL_A", "MEM_ABL_B"]) {
      const row = summary.rows.find((candidate) => candidate.arm === arm)!;
      expect(row.status).toBe("VALID");
      expect(row.memory_section_present).toBe(false);
    }
  });

  it("§2 the frozen future-divergence experiment is not reinterpreted or altered", () => {
    const summaryPath = join(
      process.cwd(),
      "research/experiments/durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider/summary.json"
    );
    if (!existsSync(summaryPath)) return;
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
      verdict: string;
      verdict_is_informative: boolean;
      verdict_interpretation: string;
      collection_validity: { invalid_trials: number };
    };
    expect(summary.verdict).toBe("NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0");
    expect(summary.verdict_is_informative).toBe(false);
    expect(summary.verdict_interpretation).toBe("COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT");
    expect(summary.collection_validity.invalid_trials).toBe(13);
  });
});
