/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — reusable session contracts.
 *
 * These types are OPERATIONAL, never psychological authority. The session layer
 * sequences existing frozen authorities; it owns no Memory, Affect, Belief,
 * Relationship, cognition or language semantics. Environment state is explicit
 * external world state and is deliberately separate from subject state.
 */

import type { ModelTransportTraceV0 } from "../transports/model-transport-trace-v0.js";

/** A single observable external situation supplied by the environment. */
export interface EnvironmentInteractionV0 {
  /** Environment-owned stable interaction id (observable; never an authority). */
  readonly interaction_id: string;
  /** The observable current situation as it would be spoken/seen. */
  readonly scene: string;
  /** The observable current task, or null when none is stated. */
  readonly task: string | null;
}

/** The environment observes ONLY the delivered observable behavior. */
export interface EnvironmentObservationInputV0 {
  readonly interaction_index: number;
  readonly interaction_id: string;
  readonly delivered_behavior_text: string;
}

/** Explicit external environment state (opaque payload + canonical hash). */
export interface EnvironmentStateV0 {
  readonly schema_version: "subject-environment-state-v0";
  readonly state_hash: string;
  readonly payload: Record<string, unknown>;
}

export interface EnvironmentConsequenceV0 {
  /** The counterpart's observable reply text. */
  readonly reply_text: string;
  /** The environment's EXTERNAL state after observing the behavior. */
  readonly state: EnvironmentStateV0;
}

/**
 * The smallest reusable environment contract: it produces observable
 * interactions and reacts to observable behavior. It must never inspect Affect,
 * Memory, current_intent, cognition internals or authority tokens.
 */
export interface SubjectEnvironmentV0 {
  readonly environment_id: string;
  /** Total interactions this bounded environment will supply. */
  readonly interaction_count: number;
  /** Deterministic next observable interaction at `index`. */
  nextInteraction(index: number): EnvironmentInteractionV0;
  /** Deterministic consequence of the observable behavior (own state + behavior only). */
  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0;
  exportState(): EnvironmentStateV0;
  restoreState(state: EnvironmentStateV0): void;
  stateHash(): string;
}

/** Durable authority identity captured at a checkpoint (ids/hashes only). */
export interface SessionDurableIdentityV0 {
  readonly subject_state_hash: string;
  readonly state_revision: number;
  readonly logical_time: number;
  readonly repository_revision: string;
  readonly subject_head: {
    readonly revision: number;
    readonly commit_ref: string;
    readonly record_checksum: string;
    readonly state_hash: string;
    readonly snapshot_hash: string;
  };
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly episode_refs: readonly string[];
}

/** Host-supplied opaque durable payloads needed to rebuild fresh authority. */
export interface SessionDurableStateV0 {
  readonly schema_version: "subject-session-durable-state-v0";
  readonly identity: SessionDurableIdentityV0;
  /** Revision-zero v4 genesis envelope (required by the trusted boundary law). */
  readonly genesis_envelope: unknown;
  /** Serialized delivery/ingress ledger states (authoritative durable ledgers). */
  readonly delivery_ledger_state: unknown;
  readonly ingress_ledger_state: unknown;
  /**
   * BELIEF_ADAPTATION_SESSION_WIRING_V0: serialized durable belief adaptation
   * workflow store (INFRASTRUCTURE state only — never canonical subject state).
   * Additive and optional: snapshots created before belief wiring carry no key
   * and restore with an empty store.
   */
  readonly belief_workflow_store_state?: unknown;
  /**
   * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0: serialized durable
   * personality-adaptation idempotency ledger (INFRASTRUCTURE state only —
   * never canonical subject state). Additive and optional.
   */
  readonly personality_adaptation_state?: unknown;
}

export interface SessionCheckpointV0 {
  readonly schema_version: "subject-session-checkpoint-v0";
  readonly session_id: string;
  readonly subject_id: string;
  /** Index of the NEXT interaction to process. */
  readonly next_interaction_index: number;
  readonly completed_interactions: number;
  readonly environment_state: EnvironmentStateV0;
  readonly durable: SessionDurableStateV0;
  readonly created_at: string;
  /** Content-addressed checkpoint ref (binding of all the above). */
  readonly checkpoint_ref: string;
}

export interface SessionRestoreOutcomeV0 {
  readonly kind: "RESTORED" | "FAILED";
  readonly checkpoint_ref: string;
  readonly restore_generation: number;
  readonly next_interaction_index: number;
  readonly pre: SessionDurableIdentityV0;
  readonly post: SessionDurableIdentityV0;
  readonly environment_state_hash_pre: string;
  readonly environment_state_hash_post: string;
  readonly identity_classification: "EXACT" | "EXPECTED_RECONSTRUCTED_IDENTITY" | "FAILURE";
  readonly detail: string | null;
}

/** One interaction's full observable/durable trace (observational, not authority). */
export interface SessionInteractionOutcomeV0 {
  readonly schema_version: "subject-session-interaction-v0";
  readonly session_id: string;
  readonly subject_id: string;
  readonly interaction_index: number;
  readonly interaction_id: string;
  readonly scene: string;
  readonly task: string | null;
  readonly environment_state_hash_before: string;
  readonly environment_state_before: Record<string, unknown>;
  readonly environment_state_hash_after: string;
  readonly environment_state_after: Record<string, unknown>;
  readonly logical_time_before: number;
  readonly logical_time_after: number;
  readonly affect_before: number;
  readonly affect_after: number;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  readonly factual_event_ref: string | null;
  readonly appraisal_ref: string | null;
  readonly reply_appraisal_ref: string | null;
  readonly retrieved_refs: readonly string[];
  readonly working_episode_refs: readonly string[];
  /** Resolved production factual memory evidence for this interaction (audit). */
  readonly resolved_evidence_entry_count: number;
  readonly resolved_evidence: unknown;
  readonly provider_memory_section_present: boolean;
  readonly provider_memory_section_hash: string | null;
  readonly provider_request_hash: string | null;
  readonly transport_request_hash: string | null;
  readonly provider_request_identity_match: boolean;
  /**
   * Provider terminal trace for this interaction's cognition call: finish reason,
   * prompt/generation token counts and the configured generation budget. This is
   * what makes provider budget exhaustion diagnosable from CharacterOS evidence
   * alone, without reading a rotating OS-level provider log.
   *
   * Operational/provider evidence ONLY: never canonical state, never Memory,
   * never prompt content, never behavior. Null when no transport trace was
   * available (the call never reached the transport).
   */
  readonly provider_terminal_trace: ModelTransportTraceV0 | null;
  readonly current_intent: string | null;
  readonly directive: string | null;
  readonly considered_context_refs: readonly string[] | null;
  readonly relevant_memory_refs: readonly string[] | null;
  readonly evidence_refs_cited: readonly string[] | null;
  readonly reasoning_summary: string | null;
  readonly cognition_status: string;
  readonly language_call_required: boolean;
  readonly language_status: string;
  readonly language_input_hash: string | null;
  readonly behavior_id: string | null;
  readonly behavior_text: string;
  readonly behavior_content_hash: string | null;
  readonly counterpart_reply: string;
  readonly delivery_id: string;
  readonly reply_event_ref: string;
  readonly reply_observation_ref: string;
  readonly experience_ref: string | null;
  readonly episode_ref: string | null;
  readonly memory_event_ref: string | null;
  readonly cognition_latency_ms: number;
  readonly cognition_total_tokens: number | null;
  readonly language_total_tokens: number | null;
  readonly raw_cognition_response: string | null;
  readonly raw_language_response: string | null;
  readonly status: "COMPLETE" | "FAILED";
  readonly failure: string | null;
}

/** Read-only operator status projection. Contains NO authority capabilities. */
export interface SubjectSessionStatusV0 {
  readonly schema_version: "subject-session-status-v0";
  readonly session_id: string;
  readonly subject_id: string;
  readonly environment_id: string;
  readonly interaction_index: number;
  readonly completed_interactions: number;
  readonly interaction_count: number;
  readonly logical_time: number;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly subject_state_hash: string;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly latest_current_intent: string | null;
  readonly latest_directive: string | null;
  readonly latest_behavior: string | null;
  readonly latest_retrieved_memory_refs: readonly string[];
  readonly latest_provider_request_identity_match: boolean | null;
  readonly pending_lifecycle_work: number;
  readonly checkpoint_count: number;
  readonly restore_generation: number;
  readonly last_checkpoint_ref: string | null;
  readonly last_restore_identity_classification: string | null;
}

/** Internal lifecycle-work item: an admitted event awaiting terminal disposition. */
export interface PendingLifecycleWorkV0 {
  readonly event_ref: string;
  readonly observation_transition_id: string;
  readonly observation_ref: string;
  readonly source_event_id: string;
  readonly kind: "PRIMARY" | "REPLY";
}
