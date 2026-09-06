/**
 * STATE_RETENTION_AND_RECOVERY_E1 — deterministic helpers and the B2 native
 * snapshot fixture. No randomness, no wall clock, no LLM.
 */

/* eslint-disable no-restricted-imports -- Isolated research experiment host over frozen built roots (v1 convention). */
import { createHash } from "node:crypto";
import type { SubjectStateV0 } from "../../../packages/subject-core/dist/index.js";
import type { AppraisalFixtureE1 } from "./contract.ts";

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`E1: ${message}`);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function equal(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

/** §31 payload hash: canonical JSON of the event identity triple. */
export function eventPayloadHash(eventId: string, timestamp: number, appraisal: AppraisalFixtureE1): string {
  return sha256(canonicalJson({ event_id: eventId, timestamp, appraisal }));
}

/** Numeric rounding used ONLY for bounded-precision JSON serialization of samples. */
export function round12(value: number): number {
  return Number(value.toPrecision(12));
}

// ----------------------------------------------------------------------------------
// B2 native fixture: the exact FAST_EMA_V0 snapshot shape (frozen production
// reference defaults; mood baseline starts at 0 like the production genesis).
// ----------------------------------------------------------------------------------

export function b2Snapshot(channels: readonly {
  channel_id: "anger" | "fear" | "sadness" | "joy";
  intensity: number;
  phase: "ACTIVE" | "RELEASING";
  started_at: number;
  source_appraisal_ref: string;
}[], mood: number, logicalTime: number): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: "subject-e1-b2", display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [], self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      working_refs: [], active_episode_refs: [], autobiographical_index_revision: null,
      repository_revision: "R0", consolidation_cursor: null,
      retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
      recent_retrieval_trace: [], lifecycle_metadata: {}, pending_encoding_refs: [], last_retrieval_at: null
    },
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: { schema_version: "relationship-state-v0", counterparts: [] },
    mood: { baseline: mood, generated_under_profile: null, last_update: null },
    affect: { active_channels: channels, generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: { scene: "E1_B2_native_drive", task: null, focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: null },
    mechanism_config: {
      affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
      legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
      feature_flags: {}, thresholds: {}
    },
    trace_window: {
      trace_window_schema_version: "trace-window-v1", capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0", state_revision: 0, logical_time: logicalTime,
      last_transition_time: null, last_transition_type: null, created_at: 0, updated_at: 0
    }
  } as unknown as SubjectStateV0;
}
