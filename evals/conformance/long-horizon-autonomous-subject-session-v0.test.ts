/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — CI conformance gate (zero real
 * model calls; persisted evidence only).
 *
 * Asserts the HONEST outcome of the validation run: the reusable session
 * capability exists and is exercised end-to-end; six of eight interactions
 * completed with the operator status, retrieval accumulation, provider request
 * identity and BOTH authoritative restores all holding; the run then failed
 * closed at interaction 7 on a deterministic provider-output failure, and the
 * evidence records that exactly rather than papering over it.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion -- Conformance assertions over a frozen evidence ledger: indices are bounds-checked by the assertions immediately before each read. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE = join(
  process.cwd(),
  "research/experiments/long-horizon-autonomous-subject-session-v0/evidence/run-1-real-provider"
);

function readJson<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(readFileSync(join(EVIDENCE, name), "utf8")) as T;
}

describe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — conformance (honest run outcome)", () => {
  it("Phase A froze the session plan with zero real model calls", () => {
    if (!existsSync(join(EVIDENCE, "phase-a-complete.json"))) {
      console.log("long-horizon evidence absent (pre-run checkout); skipping");
      return;
    }
    const phaseA = readJson("phase-a-complete.json") as { all_pass: boolean; real_model_calls: number };
    expect(phaseA.all_pass).toBe(true);
    expect(phaseA.real_model_calls).toBe(0);
    const audit = readJson("session-architecture-audit.json") as { phase_a_answers: Record<string, unknown> };
    for (const key of ["1_manually_composed_entrypoints", "2_smallest_reusable_orchestrator", "5_pending_appraisal_affect_queue", "6_interaction_complete_boundary", "7_fresh_runtime_without_live_authority", "8_reusable_vs_validation"]) {
      expect(audit.phase_a_answers[key]).toBeDefined();
    }
    const budget = readJson("call-budget.json") as { cognition_calls: number; language_calls_max: number; maximum_run_of_record_calls: number };
    expect(budget.cognition_calls).toBe(8);
    expect(budget.maximum_run_of_record_calls).toBe(16);
    const environment = readJson("environment-contract.json") as { never_inspects: string[]; separate_from_subject_authority: boolean };
    expect(environment.never_inspects).toContain("affect");
    expect(environment.never_inspects).toContain("current_intent");
    expect(environment.separate_from_subject_authority).toBe(true);
  });

  it("six interactions completed lawfully with durable Memory, and BOTH restores were exact", () => {
    if (!existsSync(join(EVIDENCE, "summary.json"))) return;
    const summary = readJson("summary.json") as {
      verdict: string;
      memory_continuity_verdict: string;
      restore_verdict: string;
      autonomous_orchestration_verdict: string;
      metrics: Record<string, unknown>;
    };
    expect(summary.verdict).toBe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED");
    expect(summary.restore_verdict).toBe("TWO_BOUNDARY_RESTORE_SUPPORTED");
    expect(summary.autonomous_orchestration_verdict).toBe("AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL");
    expect(summary.memory_continuity_verdict).toBe("LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL");
    expect(summary.metrics["completed_interactions"]).toBe(6);
    expect(summary.metrics["durable_memory_commits"]).toBe(6);
    expect(summary.metrics["restores_completed"]).toBe(2);
    expect(summary.metrics["environment_state_restored_exactly"]).toBe(2);
    expect(summary.metrics["provider_request_identity_verified"]).toBe(6);
    expect(summary.metrics["interactions_with_prior_lived_evidence_retrieved"]).toBeGreaterThanOrEqual(5);
    // Both restores were EXACT (pre/post head, state hash, repository revision, environment hash).
    const timeline = readJson("repository-revision-timeline.json") as { entries: { interaction: number }[]; memory_commits: number };
    expect(timeline.memory_commits).toBe(6);
    // Six completed interactions; the failed seventh is recorded too, so the
    // revision timeline shows the whole attempt honestly.
    expect(timeline.entries.map((entry) => entry.interaction)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const env = readJson("environment-state-timeline.json") as { restored_independently: boolean };
    expect(env.restored_independently).toBe(true);
    const identity = readJson("provider-request-identity-audit.json") as { all_match: boolean; verified: number; per_interaction: { match: boolean }[] };
    expect(identity.verified).toBe(6);
    // The six COMPLETED interactions all verified; the failed seventh could not.
    expect(identity.per_interaction.slice(0, 6).every((row) => row.match)).toBe(true);
    expect(identity.all_match).toBe(false);
  });

  it("the run failed closed at interaction 7 on a deterministic provider-output failure", () => {
    const failurePath = join(EVIDENCE, "provider-failure.json");
    if (!existsSync(failurePath)) return;
    const failure = readJson("provider-failure.json") as {
      run_outcome: string;
      failure: { interaction: number; actual_mechanism: string; raw_response_length_chars: number; surfaced_error: string };
      reproducibility: { attempts: number; byte_identical_response: boolean; response_length_attempt_1: number; response_length_attempt_2: number };
      interaction_repetition_for_output_quality: number;
      prompt_or_setting_changes_after_phase_a: number;
      retrieval_tuning: number;
      manual_injection: number;
    };
    expect(failure.run_outcome).toBe("FAILED_AT_INTERACTION_7");
    expect(failure.failure.interaction).toBe(7);
    expect(failure.failure.actual_mechanism).toContain("TRUNCATED JSON");
    expect(failure.reproducibility.attempts).toBe(2);
    expect(failure.reproducibility.byte_identical_response).toBe(true);
    expect(failure.reproducibility.response_length_attempt_1).toBe(failure.reproducibility.response_length_attempt_2);
    expect(failure.interaction_repetition_for_output_quality).toBe(0);
    expect(failure.prompt_or_setting_changes_after_phase_a).toBe(0);
    expect(failure.retrieval_tuning).toBe(0);
    expect(failure.manual_injection).toBe(0);
    // The failed interaction was recorded and never counted as complete.
    const failed = readJson("interaction-7.json") as { status: string; failure: string; experience_ref: string | null };
    expect(failed.status).toBe("FAILED");
    expect(failed.failure).toContain("PARTIAL_INTERACTION_REQUIRES_OPERATOR_RECOVERY");
    expect(failed.experience_ref).toBeNull();
    // Attempt accounting covers both attempts.
    const attempts = readJson<{ attempt: number; outcome: string }[]>(join("real-provider", "attempt-history.json"));
    expect(attempts.length).toBe(2);
    expect(attempts[0]!.outcome).not.toBe("COMPLETED");
    expect(attempts[1]!.outcome).toBe("FAILED");
  });

  it("autonomy, transcript and injection audits are clean and the operator status exposes no authority", () => {
    if (!existsSync(join(EVIDENCE, "autonomy-audit.json"))) return;
    const autonomy = readJson("autonomy-audit.json") as {
      per_interaction: Record<string, unknown>[];
    };
    expect(autonomy.per_interaction.length).toBeGreaterThanOrEqual(6);
    for (const row of autonomy.per_interaction) {
      expect(row["host_selected_memory_ref"]).toBe("NO");
      expect(row["host_set_current_intent"]).toBe("NO");
      expect(row["host_selected_directive"]).toBe("NO");
      expect(row["host_wrote_behavior"]).toBe("NO");
      expect(row["host_wrote_memory"]).toBe("NO");
      expect(row["host_manually_summarized_history"]).toBe("NO");
    }
    const transcript = readJson("transcript-bypass-audit.json") as { MANUAL_CONVERSATION_RECAP: string; RAW_TRANSCRIPT_CONTINUITY_BYPASS: string };
    expect(transcript.MANUAL_CONVERSATION_RECAP).toBe("NO");
    expect(transcript.RAW_TRANSCRIPT_CONTINUITY_BYPASS).toBe("NO");
    const status = readJson("operator-status-example.json") as Record<string, unknown>;
    for (const key of Object.keys(status)) {
      // `authority_tokens_exposed` is a self-documenting declaration whose value is NONE.
      if (key === "authority_tokens_exposed") continue;
      expect(/token|capability|issuer|ledger|secret|private/i.test(key)).toBe(false);
    }
    expect(status["authority_tokens_exposed"]).toBe("NONE");
    for (const key of ["session_id", "subject_id", "current_intent", "latest_behavior", "retrieved_memories", "last_restore"]) {
      expect(status[key]).toBeDefined();
    }
    const gates = readJson("quality-gates.json") as Record<string, unknown>;
    expect(gates["all_pass"]).toBe(false); // the run is incomplete by construction
    expect(gates["no_manual_injection"]).toBe(true);
    expect(gates["no_transcript_bypass"]).toBe(true);
    expect(gates["no_new_psychology"]).toBe(true);
    expect(gates["retrieval_unchanged"]).toBe(true);
  });
});
