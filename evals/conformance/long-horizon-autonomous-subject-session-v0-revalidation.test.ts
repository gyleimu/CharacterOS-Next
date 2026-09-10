/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION — CI conformance gate
 * (zero real model calls; persisted evidence only).
 *
 * Asserts the honest outcome of the post-repair revalidation: with an explicit
 * cognition context budget (num_ctx = 8192) the same frozen 8-interaction
 * session completed all eight interactions, E7's previously-truncating
 * 3568-token prompt finished lawfully, both authoritative restores stayed EXACT,
 * prior lived Memory continued to reach later cognition, and the provider
 * terminal telemetry is persisted in CharacterOS evidence.
 *
 * It also pins the one known harness defect of the run-of-record (the
 * session-level provider_request_identity_match field compared against the
 * language call's trace) so it cannot be silently forgotten.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion -- Conformance assertions over a frozen evidence ledger: indices are bounds-checked by the assertions immediately before each read. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REVALIDATION = join(
  process.cwd(),
  "research/experiments/long-horizon-autonomous-subject-session-v0-revalidation/evidence/run-1-real-provider"
);

function readJson<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(readFileSync(join(REVALIDATION, name), "utf8")) as T;
}

describe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION — conformance", () => {
  it("Phase A froze the revalidation plan with zero real model calls and SAME plan identity", () => {
    if (!existsSync(join(REVALIDATION, "phase-a-complete.json"))) {
      console.log("revalidation evidence absent (pre-run checkout); skipping");
      return;
    }
    const phaseA = readJson<{ all_pass: boolean; real_model_calls: number }>("phase-a-complete.json");
    expect(phaseA.all_pass).toBe(true);
    expect(phaseA.real_model_calls).toBe(0);

    const contract = readJson<{ single_variable_under_study: Record<string, Record<string, unknown>>; unchanged_from_original: string[] }>("contract.json");
    expect(contract.single_variable_under_study["before"]!["provider_context"]).toContain("4096");
    expect(contract.single_variable_under_study["after"]!["provider_context"]).toContain("8192");
    expect(contract.unchanged_from_original).toContain("Memory retrieval policy and top-k");
    expect(contract.unchanged_from_original).toContain("verdict thresholds");

    const planIdentity = readJson<{ interaction_plan_identity: string; environment_rules: string; restore_positions: string }>("plan-identity-audit.json");
    expect(planIdentity.interaction_plan_identity).toBe("SAME");
    expect(planIdentity.environment_rules).toContain("SAME");
    expect(planIdentity.restore_positions).toContain("SAME");
  });

  it("all eight interactions completed and the revalidation verdict is REVALIDATED", () => {
    if (!existsSync(join(REVALIDATION, "summary.json"))) return;
    const summary = readJson<{
      verdict: string;
      memory_continuity_verdict: string;
      restore_verdict: string;
      autonomous_orchestration_verdict: string;
      metrics: Record<string, unknown>;
      revalidates: string;
    }>("summary.json");
    expect(summary.revalidates).toBe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0");
    expect(summary.verdict).toBe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATED");
    expect(summary.memory_continuity_verdict).toBe("LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED");
    expect(summary.restore_verdict).toBe("TWO_BOUNDARY_RESTORE_SUPPORTED");
    expect(summary.autonomous_orchestration_verdict).toBe("AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED");
    expect(summary.metrics["completed_interactions"]).toBe(8);
    expect(summary.metrics["durable_memory_commits"]).toBe(8);
    expect(summary.metrics["restores_completed"]).toBe(2);
    expect(summary.metrics["environment_state_restored_exactly"]).toBe(2);
    expect(summary.metrics["interactions_with_prior_lived_evidence_retrieved"]).toBeGreaterThanOrEqual(3);
    // Every interaction is recorded, including the horizon extension.
    for (let index = 1; index <= 8; index += 1) {
      expect(existsSync(join(REVALIDATION, `interaction-${index}.json`))).toBe(true);
    }
    const gates = readJson<Record<string, unknown>>("quality-gates.json");
    expect(gates["all_pass"]).toBe(true);
    expect(gates["no_context_truncation"]).toBe(true);
    expect(gates["provider_terminal_telemetry_persisted"]).toBe(true);
  });

  it("E7 — the prompt that was truncated at 4096 tokens now completes under the explicit 8192 budget", () => {
    if (!existsSync(join(REVALIDATION, "provider-budget-timeline.json"))) return;
    const timeline = readJson<{
      context_window_tokens_configured: number;
      max_output_tokens_configured: number;
      per_interaction: {
        interaction: number;
        prompt_eval_count: number | null;
        eval_count: number | null;
        total_sequence_tokens: number | null;
        context_window_tokens: number | null;
        remaining: number | null;
        done_reason: string | null;
        cognition_status: string;
        interaction_status: string;
      }[];
    }>("provider-budget-timeline.json");
    expect(timeline.context_window_tokens_configured).toBe(8192);
    expect(timeline.max_output_tokens_configured).toBe(2048);
    expect(timeline.per_interaction).toHaveLength(8);

    const e7 = timeline.per_interaction[6]!;
    // The frozen prompt token count is identical to the failed run's E7 prompt.
    expect(e7.prompt_eval_count).toBe(3568);
    expect(e7.eval_count).not.toBeNull();
    expect(e7.done_reason).toBe("stop");
    expect(e7.interaction_status).toBe("COMPLETE");
    expect(e7.cognition_status).toBe("VALID");
    expect(e7.total_sequence_tokens!).toBeLessThan(8192);

    // E8 is the horizon-extension check: no truncation one interaction later.
    const e8 = timeline.per_interaction[7]!;
    expect(e8.done_reason).toBe("stop");
    expect(e8.interaction_status).toBe("COMPLETE");
    expect(e8.cognition_status).toBe("VALID");
    expect(e8.total_sequence_tokens!).toBeLessThan(8192);
    expect(e8.total_sequence_tokens!).toBeGreaterThan(e7.total_sequence_tokens!);
    expect(e8.remaining).toBeGreaterThan(0);
  });

  it("provider terminal telemetry is persisted for every call and auditable without the Ollama server log", () => {
    if (!existsSync(join(REVALIDATION, "provider-terminal-trace-audit.json"))) return;
    const audit = readJson<{
      requires_ollama_server_log: boolean;
      cognition_calls: number;
      language_calls: number;
      failed_calls: number;
      every_cognition_call_has_terminal_trace: boolean;
      every_call_has_prompt_eval_count: boolean;
      every_call_has_eval_count: boolean;
      every_call_has_done_reason: boolean;
      done_reason_values_observed: (string | null)[];
      configured: { context_window_tokens: number; max_output_tokens: number };
      per_call: { stage: string; prompt_eval_count: number | null; eval_count: number | null; done_reason: string | null; context_window_tokens: number | null; max_output_tokens: number | null }[];
    }>("provider-terminal-trace-audit.json");
    expect(audit.requires_ollama_server_log).toBe(false);
    expect(audit.cognition_calls).toBe(8);
    expect(audit.language_calls).toBe(8);
    expect(audit.failed_calls).toBe(0);
    expect(audit.every_cognition_call_has_terminal_trace).toBe(true);
    expect(audit.every_call_has_prompt_eval_count).toBe(true);
    expect(audit.every_call_has_eval_count).toBe(true);
    expect(audit.every_call_has_done_reason).toBe(true);
    expect(audit.done_reason_values_observed).toEqual(["stop"]);
    expect(audit.configured).toEqual({ context_window_tokens: 8192, max_output_tokens: 2048 });
    for (const call of audit.per_call) {
      expect(call.context_window_tokens).toBe(8192);
      expect(call.max_output_tokens).toBe(2048);
      expect(call.prompt_eval_count).not.toBeNull();
      expect(call.eval_count).not.toBeNull();
    }
  });

  it("records the run-of-record harness defect without hiding it", () => {
    if (!existsSync(join(REVALIDATION, "provider-request-identity-audit.json"))) return;
    const identity = readJson<{
      per_call_all_match: boolean;
      per_call_verified: number;
      per_call_total: number;
      session_level_field_verified: number;
      session_level_field_defect: Record<string, unknown> | null;
    }>("provider-request-identity-audit.json");
    // The request identity property holds for every call, including num_ctx.
    expect(identity.per_call_all_match).toBe(true);
    expect(identity.per_call_verified).toBe(16);
    expect(identity.per_call_total).toBe(16);
    // The session-level field is false in this run and the defect is documented.
    expect(identity.session_level_field_verified).toBe(0);
    expect(identity.session_level_field_defect).not.toBeNull();
    expect(identity.session_level_field_defect!["defect"]).toBe("HARNESS_TRACE_WIRING_DEFECT_IN_RUN_OF_RECORD");
    expect(identity.session_level_field_defect!["all_interactions_show_the_same_signature"]).toBe(true);
    const gates = readJson<Record<string, unknown>>("quality-gates.json");
    expect(gates["provider_request_identity_session_level_field_defect"]).toBe(true);
  });

  it("both restores were authoritative and exact, and prior-life Memory continued to reach cognition", () => {
    if (!existsSync(join(REVALIDATION, "restore-2.json"))) return;
    for (const index of [1, 2]) {
      const restore = readJson<{ kind: string; identity_classification: string; environment_state_hash_pre: string; environment_state_hash_post: string }>(`restore-${index}.json`);
      expect(restore.kind).toBe("RESTORED");
      expect(restore.identity_classification).toBe("EXACT");
      expect(restore.environment_state_hash_pre).toBe(restore.environment_state_hash_post);
    }
    const retrieval = readJson<{ per_interaction: { interaction: number; provider_memory_section_present: boolean; resolved_evidence_entry_count: number }[] }>("retrieval-timeline.json");
    const withPriorLife = retrieval.per_interaction.filter((row) => row.provider_memory_section_present && row.resolved_evidence_entry_count > 0);
    expect(withPriorLife.length).toBeGreaterThanOrEqual(3);
    // Continuity across both restore boundaries.
    expect(retrieval.per_interaction.slice(3).some((row) => row.provider_memory_section_present)).toBe(true);
    expect(retrieval.per_interaction.slice(6).some((row) => row.provider_memory_section_present)).toBe(true);
  });

  it("no manual steering occurred during the revalidation", () => {
    if (!existsSync(join(REVALIDATION, "autonomy-audit.json"))) return;
    const autonomy = readJson<{ per_interaction: Record<string, unknown>[] }>("autonomy-audit.json");
    expect(autonomy.per_interaction.length).toBe(8);
    for (const row of autonomy.per_interaction) {
      expect(row["host_selected_memory_ref"]).toBe("NO");
      expect(row["host_set_current_intent"]).toBe("NO");
      expect(row["host_selected_directive"]).toBe("NO");
      expect(row["host_wrote_behavior"]).toBe("NO");
      expect(row["host_wrote_memory"]).toBe("NO");
      expect(row["host_manually_summarized_history"]).toBe("NO");
      expect(row["host_trimmed_context"]).toBe("NO");
    }
    const transcript = readJson<{ MANUAL_CONVERSATION_RECAP: string; RAW_TRANSCRIPT_CONTINUITY_BYPASS: string }>("transcript-bypass-audit.json");
    expect(transcript.MANUAL_CONVERSATION_RECAP).toBe("NO");
    expect(transcript.RAW_TRANSCRIPT_CONTINUITY_BYPASS).toBe("NO");
  });

  it("the original failed experiment remains untouched and permanently FAILED", () => {
    const original = join(
      process.cwd(),
      "research/experiments/long-horizon-autonomous-subject-session-v0/evidence/run-1-real-provider"
    );
    const originalSummary = JSON.parse(readFileSync(join(original, "summary.json"), "utf8")) as { verdict: string; metrics: Record<string, unknown> };
    expect(originalSummary.verdict).toBe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED");
    expect(originalSummary.metrics["completed_interactions"]).toBe(6);
    const failure = JSON.parse(readFileSync(join(original, "provider-failure.json"), "utf8")) as { failure: { interaction: number } };
    expect(failure.failure.interaction).toBe(7);
  });
});
