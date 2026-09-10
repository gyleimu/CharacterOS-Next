/**
 * LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0 — CI conformance gate (zero real
 * model calls; persisted evidence only).
 *
 * Proves one subject completed four chronological episodes in which
 * behavior-linked consequences became durable Memory, later cognition received
 * factual evidence from prior lived episodes, accumulated life survived an
 * authoritative restore, and post-restore cognition continued with access to
 * pre-restart lived history — with no manual history/Memory injection.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion -- Conformance assertions over a frozen four-episode ledger: episode keys and arm membership are asserted immediately before each indexed read. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE = join(
  process.cwd(),
  "research/experiments/longitudinal-multi-episode-subject-life-v0/evidence/run-1-real-provider"
);
const EPISODE_KEYS = ["E1", "E2", "E3", "E4"] as const;

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(EVIDENCE, name), "utf8")) as Record<string, unknown>;
}
function readEpisode(key: string): {
  episode: string;
  post_restore: boolean;
  cognition: { status: string; current_intent: string | null; directive: string | null; considered_context_refs: readonly string[] | null };
  behavior: { text: string; content_hash: string | null };
  retrieval: { evidence_origin: { classes: readonly string[] }; working_episode_refs: readonly string[] };
  provider_surface: { memory_section_present: boolean; request_identity_match: boolean; memory_section: string; request_hash: string };
  counterpart: { reply: string };
  experience_ref: string | null;
  episode_ref: string | null;
  repository_revision_before: string;
  repository_revision_after: string;
} {
  return JSON.parse(readFileSync(join(EVIDENCE, `episode-${key.slice(1)}.json`), "utf8"));
}

describe("LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0 — conformance", () => {
  it("Phase A froze the life contract with zero real model calls and a single subject", () => {
    if (!existsSync(join(EVIDENCE, "phase-a-complete.json"))) {
      console.log("longitudinal evidence absent (pre-run checkout); skipping");
      return;
    }
    const phaseA = readJson("phase-a-complete.json");
    expect(phaseA["all_pass"]).toBe(true);
    expect(phaseA["real_model_calls"]).toBe(0);
    const contract = readJson("life-contract.json") as {
      single_subject: boolean; no_control_arms: boolean; no_memory_ablation: boolean;
      chronological_episodes: readonly string[]; restore_boundary: string;
    };
    expect(contract.single_subject).toBe(true);
    expect(contract.no_control_arms).toBe(true);
    expect(contract.no_memory_ablation).toBe(true);
    expect(contract.chronological_episodes).toEqual(["E1", "E2", "E3", "E4"]);
    expect(contract.restore_boundary).toContain("after E3");
  });

  it("all four episodes completed lawfully with E1–E3 committing durable Memory", () => {
    if (!existsSync(join(EVIDENCE, "episode-4.json"))) return;
    for (const key of EPISODE_KEYS) {
      const episode = readEpisode(key);
      expect(["VALID", "DIRECTIVE_CLARIFY"]).toContain(episode.cognition.status);
      expect(episode.behavior.text.length).toBeGreaterThan(0);
      expect(episode.counterpart.reply.length).toBeGreaterThan(0);
    }
    for (const key of ["E1", "E2", "E3"] as const) {
      const episode = readEpisode(key);
      expect(episode.experience_ref).not.toBeNull();
      expect(episode.episode_ref).not.toBeNull();
      expect(episode.repository_revision_after).not.toBe(episode.repository_revision_before);
    }
    // E4 is the §44 preferred endpoint: no new Memory required post-restore.
    const e4 = readEpisode("E4");
    expect(e4.post_restore).toBe(true);
    const timeline = readJson("repository-revision-timeline.json") as { memory_commits: number };
    expect(timeline.memory_commits).toBe(3);
  });

  it("later episodes retrieved prior lived episodes and the accumulated life survived restore", () => {
    if (!existsSync(join(EVIDENCE, "summary.json"))) return;
    const summary = readJson("summary.json") as {
      verdict: string;
      multi_episode_retrieval_verdict: string;
      post_restore_verdict: string;
      longitudinal_metrics: Record<string, number>;
      retrieval_contribution: Record<string, readonly string[]>;
      restore: { pre_post_state_equal: boolean; active_runtime_discarded: boolean };
    };
    expect(summary.verdict).toBe("LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_SUPPORTED");
    expect(summary.multi_episode_retrieval_verdict).toBe("MULTI_EPISODE_RETRIEVAL_SUPPORTED");
    expect(summary.post_restore_verdict).toBe("POST_RESTORE_LIFE_CONTINUITY_SUPPORTED");
    expect(summary.longitudinal_metrics["number_of_completed_episodes"]).toBe(4);
    expect(summary.longitudinal_metrics["number_of_durable_memory_commits"]).toBe(3);
    expect(summary.longitudinal_metrics["number_of_later_episodes_with_prior_memory_retrieved"]).toBe(3);
    expect(summary.longitudinal_metrics["number_of_post_restore_episodes_retrieving_pre_restore_memory"]).toBe(1);
    // Progressive accumulation: E2←E1, E3←E1+E2, E4←E1+E2+E3.
    expect([...summary.retrieval_contribution["E2"]!]).toEqual(["FROM_E1"]);
    expect([...summary.retrieval_contribution["E3"]!].sort()).toEqual(["FROM_E1", "FROM_E2"]);
    expect([...summary.retrieval_contribution["E4"]!].sort()).toEqual(["FROM_E1", "FROM_E2", "FROM_E3"]);
    expect(summary.restore.pre_post_state_equal).toBe(true);
    expect(summary.restore.active_runtime_discarded).toBe(true);
  });

  it("the model actually received its own life evidence (rendered section + reproduced request identity)", () => {
    if (!existsSync(join(EVIDENCE, "provider-memory-surface-audit.json"))) return;
    const audit = readJson("provider-memory-surface-audit.json") as {
      per_episode: Record<string, { memory_section_present: boolean; request_identity_match: boolean; memory_section: string }>;
      provider_actually_received_life_evidence: Record<string, boolean>;
    };
    // E1 is the first lived episode: nothing prior exists to render.
    expect(audit.per_episode["E1"]!.memory_section_present).toBe(false);
    for (const key of ["E2", "E3", "E4"] as const) {
      const episode = audit.per_episode[key]!;
      expect(episode.memory_section_present).toBe(true);
      expect(episode.request_identity_match).toBe(true);
      expect(episode.memory_section).toContain("[PRIOR FACTUAL MEMORY");
      expect(audit.provider_actually_received_life_evidence[key]).toBe(true);
    }
  });

  it("post-restore cognition cited the pre-restore episode refs (continuity through Memory, not a recap)", () => {
    if (!existsSync(join(EVIDENCE, "episode-4.json"))) return;
    const refs = EPISODE_KEYS.map((key) => readEpisode(key).episode_ref);
    const e1Ref = refs[0]!;
    const e2Ref = refs[1]!;
    const e3Ref = refs[2]!;
    const citedE4 = readEpisode("E4").cognition.considered_context_refs ?? [];
    expect([...citedE4]).toContain(e1Ref);
    expect([...citedE4]).toContain(e2Ref);
    expect([...citedE4]).toContain(e3Ref);
    const citedE3 = readEpisode("E3").cognition.considered_context_refs ?? [];
    expect([...citedE3]).toContain(e1Ref);
    expect([...citedE3]).toContain(e2Ref);
    const citedE2 = readEpisode("E2").cognition.considered_context_refs ?? [];
    expect([...citedE2]).toContain(e1Ref);
    // No recap shortcut: the episode-4 scene never states the prior facts.
    const plan = readJson("episode-plan.json") as { episodes: readonly { episode: string; scene: string }[] };
    const e4Scene = plan.episodes.find((entry) => entry.episode === "E4")!.scene;
    expect(e4Scene).not.toContain("implementation");
    expect(e4Scene).not.toContain("checklist");
  });

  it("no manual injection, calls within budget, honest attempt accounting, zero external cost", () => {
    if (!existsSync(join(EVIDENCE, "summary.json"))) return;
    const summary = readJson("summary.json") as {
      tokens: { cognition_calls: number; language_calls: number; external_api_monetary_cost: string; all_attempts: { attempts: readonly number[] } };
      manual_injection_audit: Record<string, string>;
      real_calls: { cognition: number; language: number; repetitions: number };
    };
    for (const value of Object.values(summary.manual_injection_audit)) expect(value).toBe("NO");
    expect(summary.real_calls.cognition).toBe(4);
    expect(summary.real_calls.language).toBeLessThanOrEqual(4);
    expect(summary.real_calls.repetitions).toBe(0);
    expect(summary.tokens.cognition_calls).toBe(4);
    expect(summary.tokens.external_api_monetary_cost).toContain("0");
    const gates = readJson("quality-gates.json") as Record<string, unknown>;
    expect(gates["all_pass"]).toBe(true);
    expect(gates["cache_continuity"]).toBe(false);
    expect(gates["transcript_shortcut"]).toBe(false);
    expect(gates["new_psychology_fields"]).toBe(false);
    expect(gates["retrieval_tuning"]).toBe(false);
    const attempts = readJson("attempt-history.json") as readonly { attempt: number; outcome: string }[];
    expect(attempts.some((entry) => entry.attempt === 1)).toBe(true);
    expect(attempts.some((entry) => entry.outcome === "COMPLETED")).toBe(true);
  });
});
