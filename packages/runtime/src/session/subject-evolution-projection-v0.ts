/**
 * SUBJECT_EVOLUTION_VIEW_V0 — a READ-ONLY product projection that answers
 * "why is this subject like this now?" from EXISTING durable sources only.
 *
 * It is NOT state, NOT an authority, NOT a cache and NOT a causal-graph engine:
 * it adds no durable schema, holds no reference to live objects after returning,
 * and deleting it changes nothing about subject behaviour. Every field is either
 * read straight out of canonical stores or mechanically derived from a committed
 * transition that already records its own cause refs.
 *
 * OBSERVABILITY LEVELS (kept separate on purpose, never merged into one graph):
 *   CURRENT_STATE        — values as they are now (canonical snapshot).
 *   DURABLE_TRANSITION   — a committed change with its recorded cause refs.
 *   SOURCE_EVIDENCE      — the episode/observation/appraisal refs a transition cites.
 *   COGNITION_VISIBLE    — the durable material a cognition projection receives.
 *
 * CAUSAL LANGUAGE POLICY (§9): this module may say UPDATED_FROM only where a
 * committed transition or durable receipt records the binding; it says
 * AVAILABLE_TO_COGNITION for material the projection carries; it never says a
 * state CAUSED a behavior, and it never reports model-internal reasoning. Where a
 * module has no reliable source binding, it reports `UNAVAILABLE` with a reason
 * rather than guessing (§19).
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";

export const SUBJECT_EVOLUTION_VIEW_SCHEMA_VERSION = "subject-evolution-view-v0" as const;

/** How a durable value can be attributed, stated in the projection itself. */
export type EffectAttributionV0 =
  /** A committed transition / durable receipt records the exact source refs. */
  | { readonly status: "UPDATED_FROM"; readonly source: string }
  /** No reliable source binding exists in durable state: the value is shown alone. */
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export interface EvolutionSubjectV0 {
  readonly subject_id: string;
  readonly state_revision: number;
  readonly logical_time: number;
  readonly repository_revision: string;
}

/** One lived event, straight from the canonical lived-memory projection. */
export interface EvolutionLivedEventV0 {
  readonly kind: "OBSERVATION" | "BEHAVIOR_OUTCOME";
  readonly occurrence_logical_time: number;
  readonly episode_ref: string;
  readonly scene: string | null;
  readonly delivered_behavior_text: string | null;
  readonly outcome_reply_text: string | null;
}

/**
 * A committed AffectApplication: the transition's own `cause_refs` are exactly
 * `[appraisal_ref, factual_event_ref, source_observation_ref]`, so the binding
 * below is the transition's recorded provenance — not an inference.
 */
export interface EvolutionAffectTransitionV0 {
  readonly transition_id: string;
  readonly next_revision: number;
  readonly observation_ref: CanonicalRefV0;
  readonly event_ref: CanonicalRefV0;
  readonly appraisal_ref: CanonicalRefV0;
  /** Applied value carried by the transition's own affect delta. */
  readonly valence_after: number;
  readonly activation_after: number;
  /** Previous recorded applied value in this lineage, or null when none precedes it. */
  readonly valence_before: number | null;
  readonly activation_before: number | null;
}

/**
 * A durable belief workflow record's committed plasticity receipt: the node
 * records the target proposition, the relation the evidence carried, the exact
 * evidence episode refs and the frozen prior/next credence.
 */
export interface EvolutionBeliefTransitionV0 {
  readonly workflow_id: string;
  readonly terminal_kind: string;
  readonly proposition_id: string;
  readonly proposition_label: string | null;
  readonly relation: "SUPPORTS" | "CONTRADICTS" | "HOST_ROUTED_NEW_CANDIDATE" | null;
  readonly prior_credence: number | null;
  readonly next_credence: number | null;
  readonly evidence_episode_refs: readonly string[];
}

export interface EvolutionCurrentStateV0 {
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly regulation: {
    readonly energy: number;
    readonly stress: number;
    readonly arousal: number;
    readonly fatigue: number;
  };
  readonly beliefs: readonly {
    readonly proposition_id: string;
    readonly proposition_label: string;
    readonly credence: number;
  }[];
  readonly relationships: readonly {
    readonly counterpart_ref: string;
    readonly dimensions: readonly { readonly dimension_id: string; readonly value: number }[];
  }[];
  readonly personality: readonly { readonly dimension_id: string; readonly value: number }[];
  readonly memory: { readonly total_episode_count: number; readonly repository_revision: string };
}

/** The durable material a cognition projection receives — source identity ONLY. */
export interface EvolutionCognitionVisibleV0 {
  readonly policy: "AVAILABLE_TO_COGNITION";
  readonly memory_episode_refs: readonly string[];
  readonly belief_proposition_ids: readonly string[];
  readonly relationship_counterpart_refs: readonly string[];
  readonly personality_dimension_ids: readonly string[];
  readonly affect: { readonly valence: number; readonly activation: number };
}

export interface SubjectEvolutionViewV0 {
  readonly schema_version: typeof SUBJECT_EVOLUTION_VIEW_SCHEMA_VERSION;
  readonly subject: EvolutionSubjectV0;
  /** Newest first within each list; bounded by the caller's limit. */
  readonly recent_lived_events: readonly EvolutionLivedEventV0[];
  readonly durable_effects: {
    readonly affect: readonly EvolutionAffectTransitionV0[];
    readonly belief: readonly EvolutionBeliefTransitionV0[];
  };
  readonly current: EvolutionCurrentStateV0;
  readonly cognition_visible: EvolutionCognitionVisibleV0;
  /** Per-domain attribution honesty, including the domains that cannot be traced. */
  readonly attribution: {
    readonly affect: EffectAttributionV0;
    readonly belief: EffectAttributionV0;
    readonly relationship: EffectAttributionV0;
    readonly personality: EffectAttributionV0;
  };
}

/**
 * Canonical relationship and personality items carry NO provenance field, and no
 * durable receipt binds them to an episode in a product-readable way: they are
 * therefore reported as CURRENT_STATE with an honest UNAVAILABLE attribution
 * rather than attributed by guesswork.
 */
export const EVOLUTION_UNAVAILABLE_REASONS = Object.freeze({
  relationship:
    "canonical relationship dimensions carry no provenance field and no product-readable receipt binds them to an episode",
  personality:
    "canonical personality dimensions carry no provenance field and no product-readable receipt binds them to an episode"
} as const);
