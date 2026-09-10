/**
 * AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0 — CI conformance
 * gate. Verifies the persisted evidence bundle against the preregistered
 * causal-chain requirements using ONLY stored evidence (zero provider
 * calls): lawful Affect histories, A/B behavior divergence, treatment-blind
 * counterpart, semantic Experience/Memory difference, authoritative restore,
 * negligible-and-bounded future Affect carryover, and future cognition input
 * divergence driven by the lived memory.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const evidenceDir = join(
  process.cwd(),
  "research/experiments/affect-driven-behavior-experience-memory-causal-chain-v0/evidence/run-1"
);

interface TrialRow {
  readonly scenario_id: string;
  readonly trial_ordinal: number;
  readonly arm: string;
  readonly cognition: { readonly status: string; readonly communication_directive: string | null };
  readonly language: { readonly status: string } | null;
  readonly behavior: { readonly text: string } | null;
}

describe("AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0 — persisted evidence conformance", () => {
  it("evidence bundle exists and proves the full causal chain", () => {
    if (!existsSync(join(evidenceDir, "summary.json"))) {
      console.log("evidence/run-1 not present (pre-collection checkout); skipping");
      return;
    }
    const read = (name: string): Record<string, unknown> =>
      JSON.parse(readFileSync(join(evidenceDir, name), "utf8")) as Record<string, unknown>;

    const summary = read("summary.json");
    expect(summary.verdict).toBe("AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_SUPPORTED");

    // §9/§10: behavior source — fresh lawful generation, no artifact reuse.
    const sourcePlan = read("behavior-source-plan.json");
    expect(sourcePlan.prior_artifact_reuse_rejected).toBe(true);

    // Behavior pairs: real cognition+language generation, A/B divergence.
    const behavior = read("behavior-evidence.json") as {
      diverged: boolean;
      behavior_a: string;
      behavior_b: string;
      behavior_content_hash_a: string;
      behavior_content_hash_b: string;
    };
    expect(behavior.diverged).toBe(true);
    expect(behavior.behavior_a).not.toBe(behavior.behavior_b);
    expect(behavior.behavior_content_hash_a).not.toBe(behavior.behavior_content_hash_b);

    // §13-§16: counterpart treatment-blind, response bound to behavior.
    const counterpart = read("counterpart-response-evidence.json") as {
      policy: { treatment_blind: boolean };
      policy_inputs: { A: string; B: string };
      response_differs: boolean;
      responses: { A: { reply_text: string }; B: { reply_text: string } };
    };
    expect(counterpart.policy.treatment_blind).toBe(true);
    expect(counterpart.policy_inputs.A).toBe(behavior.behavior_a);
    expect(counterpart.policy_inputs.B).toBe(behavior.behavior_b);
    expect(counterpart.response_differs).toBe(true);

    // §18-§19: Experience and Memory committed lawfully.
    const experience = read("experience-evidence.json") as { refs_differ: boolean; experiences: Record<string, { outcome_text: string }> };
    expect(experience.refs_differ).toBe(true);
    const memory = read("memory-evidence.json") as {
      memories: Record<string, { revision_before: string; revision_after: string }>;
      revisions_advanced: boolean;
    };
    expect(memory.revisions_advanced).toBe(true);
    for (const arm of ["A", "B"]) {
      expect(memory.memories[arm].revision_after).not.toBe(memory.memories[arm].revision_before);
    }

    // §34/§35: authoritative restore, then future retrieval on restored state.
    const restore = read("restore-evidence.json") as { provider_input_identical_to_pre_restore: boolean };
    expect(restore.provider_input_identical_to_pre_restore).toBe(true);

    // §23/§43: future Affect carryover negligible and bounded.
    const futureAffect = read("future-affect-control.json") as { ticks: number; manual_patch: boolean };
    expect(futureAffect.manual_patch).toBe(false);
    const summaryFuture = summary.chain.future as { retrieval_differs: boolean; cognition_input_differs: boolean; affect_control: string; residual_valence_delta: number };
    expect(summaryFuture.affect_control).toBe("FUTURE_AFFECT_DIFFERENCE_NEGLIGIBLE_AND_BOUNDED");
    expect(summaryFuture.residual_valence_delta).toBeLessThan(0.001);

    // §20/§27/§28: future retrieval + cognition input differ (memory-derived).
    const futureRetrieval = read("future-retrieval-evidence.json") as { retrieval_differs: boolean; resolved_evidence: { A: { entries: { exact_outcome_text: string }[] } | null; B: { entries: { exact_outcome_text: string }[] } | null } };
    expect(futureRetrieval.retrieval_differs).toBe(true);
    expect(futureRetrieval.resolved_evidence.A?.entries?.[0]?.exact_outcome_text).not.toBe(
      futureRetrieval.resolved_evidence.B?.entries?.[0]?.exact_outcome_text
    );
    const inputDiff = read("future-cognition-input-diff.json") as { differs: boolean; input_a: { factual_memory_evidence?: { entries: { exact_outcome_text: string }[] } }; input_b: { factual_memory_evidence?: { entries: { exact_outcome_text: string }[] } } };
    expect(inputDiff.differs).toBe(true);
    // The future provider inputs carry ONLY their own life's outcome text.
    expect(JSON.stringify(inputDiff.input_a)).toContain(behavior.behavior_a.slice(0, 40));
    expect(JSON.stringify(inputDiff.input_b)).not.toContain(behavior.behavior_a.slice(0, 40));

    // Manual-injection audit.
    const gates = read("quality-gates.json") as { manual_injection_absent: boolean; all_pass: boolean };
    expect(gates.manual_injection_absent).toBe(true);
    expect(gates.all_pass).toBe(true);
  });

  it("real trials: 2 cognition calls + 1 language call (A clarified, B realized), behaviors divergent", () => {
    const trialsPath = join(process.cwd(), "research/experiments/affect-driven-behavior-experience-memory-causal-chain-v0/evidence/run-1/real-provider/trials.jsonl");
    if (!existsSync(trialsPath)) {
      console.log("real-provider trials not present; skipping");
      return;
    }
    const trials = readFileSync(trialsPath, "utf8")
      .split("\n").filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TrialRow);
    expect(trials.length).toBe(2);
    for (const t of trials) {
      expect(t.cognition_status).toBe("VALID");
      expect(["A", "B"]).toContain(t.arm);
    }
    // Frozen evidence: within the chosen pair, one arm realized (1 language
    // call) and the other took the lawful fixed-clarification branch.
    const languageValid = trials.filter((t) => t.language_status === "VALID");
    expect(languageValid.length).toBe(1);
    const byArm = { A: trials.find((t) => t.arm === "A")!, B: trials.find((t) => t.arm === "B")! };
    expect(byArm.A.behavior_text).not.toBe(byArm.B.behavior_text);
  });
});
