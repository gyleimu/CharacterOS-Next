
/* -------------------------------------------------------------------------- */
/* Durable-state extraction — mechanical, from committed records only          */
/* -------------------------------------------------------------------------- */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import type { LivedMemoryInspectionV0 } from "./explicit-v4-session-authority-v0.js";
import {
  EVOLUTION_UNAVAILABLE_REASONS,
  SUBJECT_EVOLUTION_VIEW_SCHEMA_VERSION,
  type EffectAttributionV0,
  type EvolutionAffectTransitionV0,
  type EvolutionBeliefTransitionV0,
  type EvolutionLivedEventV0,
  type SubjectEvolutionViewV0
} from "./subject-evolution-projection-v0.js";

/** One committed AffectApplication as stored in the session's committed bundles. */
export interface AffectApplicationBundleViewV0 {
  readonly transition_id: string;
  readonly next_revision: number;
  readonly cause_refs: readonly string[];
  /** The applied affect value carried by the transition's own `/affect` operation. */
  readonly affect_value: { readonly valence: number; readonly activation: number } | null;
}

/**
 * The ONE committed-bundle parser: reads a bundle's own recorded fields
 * (transition identity, `next_revision`, `cause_refs` and the `/affect` delta
 * operation). It understands nothing else and invents nothing: a bundle whose
 * affect value is absent is reported with `affect_value: null`.
 */
export function readAffectApplicationBundleV0(bundle: unknown): AffectApplicationBundleViewV0 | null {
  if (bundle === null || typeof bundle !== "object") return null;
  const record = bundle as Record<string, unknown>;
  if (record["transition_type"] !== "AffectApplication") return null;
  const transitionId = record["transition_id"];
  const nextRevision = record["next_revision"];
  if (typeof transitionId !== "string" || typeof nextRevision !== "number") return null;
  const proposal = (record["canonical_proposal"] ?? null) as Record<string, unknown> | null;
  const causeRefs = Array.isArray(proposal?.["cause_refs"]) ? (proposal?.["cause_refs"] as unknown[]) : [];
  const domainDeltas = Array.isArray(proposal?.["domain_deltas"]) ? (proposal?.["domain_deltas"] as unknown[]) : [];
  let affectValue: AffectApplicationBundleViewV0["affect_value"] = null;
  for (const delta of domainDeltas) {
    if (delta === null || typeof delta !== "object") continue;
    const operations = ((delta as Record<string, unknown>)["operations"] ?? null) as unknown;
    if (!Array.isArray(operations)) continue;
    for (const operation of operations) {
      if (operation === null || typeof operation !== "object") continue;
      const op = operation as Record<string, unknown>;
      if (op["path"] !== "/affect") continue;
      const value = op["value"] as Record<string, unknown> | null;
      if (value !== null && typeof value === "object" && typeof value["valence"] === "number") {
        affectValue = {
          valence: value["valence"] as number,
          activation: typeof value["activation"] === "number" ? (value["activation"] as number) : 0
        };
      }
    }
  }
  return {
    transition_id: transitionId,
    next_revision: nextRevision,
    cause_refs: causeRefs.filter((ref): ref is string => typeof ref === "string"),
    affect_value: affectValue
  };
}

function refByPrefix(refs: readonly string[], prefix: string): CanonicalRefV0 | null {
  const found = refs.find((ref) => ref.startsWith(`${prefix}:`));
  return found === undefined ? null : (found as CanonicalRefV0);
}

/**
 * Affect transitions, oldest first, from committed AffectApplication bundles of
 * THIS subject. A bundle whose recorded cause refs do not carry the complete
 * appraisal/event/observation chain is SKIPPED — the projection never guesses a
 * source. `valence_before` is the previous recorded applied value in the same
 * lineage, or null when none precedes it.
 */
export function affectTransitionsFromBundlesV0(
  bundles: readonly AffectApplicationBundleViewV0[]
): readonly EvolutionAffectTransitionV0[] {
  const ordered = [...bundles]
    .filter((bundle) => bundle.affect_value !== null)
    .sort((left, right) => left.next_revision - right.next_revision);
  const transitions: EvolutionAffectTransitionV0[] = [];
  let previous: { readonly valence: number; readonly activation: number } | null = null;
  for (const bundle of ordered) {
    const observationRef = refByPrefix(bundle.cause_refs, "observation");
    const eventRef = refByPrefix(bundle.cause_refs, "event");
    const appraisalRef = refByPrefix(bundle.cause_refs, "appraisal");
    if (observationRef === null || eventRef === null || appraisalRef === null) continue;
    const value = bundle.affect_value;
    if (value === null) continue;
    transitions.push(
      Object.freeze({
        transition_id: bundle.transition_id,
        next_revision: bundle.next_revision,
        observation_ref: observationRef,
        event_ref: eventRef,
        appraisal_ref: appraisalRef,
        valence_after: value.valence,
        activation_after: value.activation,
        valence_before: previous === null ? null : previous.valence,
        activation_before: previous === null ? null : previous.activation
      })
    );
    previous = value;
  }
  return Object.freeze(transitions);
}

/** The durable belief workflow record fields this projection reads. */
export interface BeliefWorkflowRecordViewV0 {
  readonly workflow_id: string;
  readonly subject_id: string;
  readonly evidence_episode_refs: readonly string[];
  readonly terminal_kind: string | null;
  readonly route: "EXISTING_PROPOSITION" | "NEW_PROPOSITION_CANDIDATE" | "NO_BEARING" | null;
  readonly proposition_id: string | null;
  readonly relation: "SUPPORTS" | "CONTRADICTS" | null;
  readonly prior_credence: number | null;
  readonly next_credence: number | null;
}

/**
 * Shape-agnostic reader for one durable belief workflow record image. Every field
 * is read from the record's own stored values (terminal, semantic candidate and
 * plasticity receipt); anything absent stays null.
 */
export function readBeliefWorkflowRecordV0(record: unknown): BeliefWorkflowRecordViewV0 | null {
  if (record === null || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const workflowId = row["workflow_id"];
  const subjectId = row["subject_id"];
  if (typeof workflowId !== "string" || typeof subjectId !== "string") return null;
  const bindings = Array.isArray(row["evidence_bindings"]) ? (row["evidence_bindings"] as unknown[]) : [];
  const evidenceRefs = bindings
    .map((binding) =>
      binding !== null && typeof binding === "object" ? (binding as Record<string, unknown>)["episode_ref"] : null
    )
    .filter((ref): ref is string => typeof ref === "string")
    .sort();
  const terminal = (row["terminal_result"] ?? null) as Record<string, unknown> | null;
  const candidate = (row["semantic_candidate"] ?? null) as Record<string, unknown> | null;
  const receipt = (row["plasticity_receipt"] ?? null) as Record<string, unknown> | null;
  const outcome = (receipt?.["outcome"] ?? null) as Record<string, unknown> | null;
  const route =
    candidate === null
      ? null
      : candidate["kind"] === "EXISTING_PROPOSITION" ||
          candidate["kind"] === "NEW_PROPOSITION_CANDIDATE" ||
          candidate["kind"] === "NO_BEARING"
        ? (candidate["kind"] as BeliefWorkflowRecordViewV0["route"])
        : null;
  return {
    workflow_id: workflowId,
    subject_id: subjectId,
    evidence_episode_refs: evidenceRefs,
    terminal_kind: typeof terminal?.["kind"] === "string" ? (terminal["kind"] as string) : null,
    route,
    proposition_id: typeof receipt?.["proposition_id"] === "string" ? (receipt["proposition_id"] as string) : null,
    relation:
      receipt?.["relation"] === "SUPPORTS" || receipt?.["relation"] === "CONTRADICTS"
        ? (receipt["relation"] as "SUPPORTS" | "CONTRADICTS")
        : null,
    prior_credence: typeof receipt?.["current_credence"] === "number" ? (receipt["current_credence"] as number) : null,
    next_credence:
      outcome?.["kind"] === "CREDENCE_CHANGE" && typeof outcome["next_credence"] === "number"
        ? (outcome["next_credence"] as number)
        : null
  };
}

/** Terminals that PROVE a canonical Belief commit happened. */
const BELIEF_COMMITTED_TERMINALS: readonly string[] = Object.freeze([
  "COMPLETE_COMMITTED",
  "COMPLETE_ALREADY_COMMITTED"
]);

/**
 * Belief transitions, newest first, from THIS subject's durable workflow records.
 *
 * ONLY terminals that prove a canonical commit are durable EFFECTS: a workflow
 * that abstained (NO_BEARING), found no change, or was rejected changed no state
 * and is therefore not reported here — the per-turn belief report is where that
 * disposition belongs.
 */
export function beliefTransitionsFromRecordsV0(
  records: readonly BeliefWorkflowRecordViewV0[],
  labelsById: ReadonlyMap<string, string>
): readonly EvolutionBeliefTransitionV0[] {
  return Object.freeze(
    records
      .filter((record) => record.terminal_kind !== null && BELIEF_COMMITTED_TERMINALS.includes(record.terminal_kind))
      .sort((left, right) => (left.workflow_id < right.workflow_id ? 1 : left.workflow_id > right.workflow_id ? -1 : 0))
      .map((record) =>
        Object.freeze({
          workflow_id: record.workflow_id,
          terminal_kind: record.terminal_kind as string,
          proposition_id: record.proposition_id ?? "",
          proposition_label:
            record.proposition_id === null ? null : (labelsById.get(record.proposition_id) ?? null),
          relation: record.relation,
          prior_credence: record.prior_credence,
          next_credence: record.next_credence,
          evidence_episode_refs: record.evidence_episode_refs
        })
      )
  );
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

export interface BuildSubjectEvolutionViewInputV0 {
  readonly subject_id: string;
  readonly state_revision: number;
  readonly logical_time: number;
  readonly repository_revision: string;
  readonly memory: LivedMemoryInspectionV0;
  /** Committed AffectApplication bundles of this subject (already subject-scoped). */
  readonly affect_bundles: readonly AffectApplicationBundleViewV0[];
  /** Durable belief workflow records of this subject (already subject-scoped). */
  readonly belief_records: readonly BeliefWorkflowRecordViewV0[];
  readonly current: {
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
  };
  /** Episode refs the cognition projection carries (canonical working/retrieval refs). */
  readonly cognition_memory_episode_refs: readonly string[];
}

/**
 * Deterministic, read-only assembly. Every section is either CURRENT_STATE taken
 * verbatim from canonical state, a DURABLE_TRANSITION derived from a committed
 * record, or material labelled AVAILABLE_TO_COGNITION with its source identity.
 * The result is detached plain data (JSON-safe), safe to serialize or print.
 */
export function buildSubjectEvolutionViewV0(
  input: BuildSubjectEvolutionViewInputV0
): SubjectEvolutionViewV0 {
  const labelsById = new Map(input.current.beliefs.map((item) => [item.proposition_id, item.proposition_label]));
  const affectTransitions = affectTransitionsFromBundlesV0(input.affect_bundles);
  const beliefTransitions = beliefTransitionsFromRecordsV0(input.belief_records, labelsById);
  const affectAttribution: EffectAttributionV0 =
    affectTransitions.length === 0
      ? {
          status: "UNAVAILABLE",
          reason: "no committed AffectApplication transition with a recorded cause chain exists for this subject yet"
        }
      : {
          status: "UPDATED_FROM",
          source: "committed AffectApplication transition: cause_refs = [appraisal_ref, factual_event_ref, source_observation_ref]"
        };
  const beliefAttribution: EffectAttributionV0 =
    beliefTransitions.length === 0
      ? {
          status: "UNAVAILABLE",
          reason: "no durable belief workflow record has reached a terminal for this subject yet"
        }
      : {
          status: "UPDATED_FROM",
          source: "durable belief workflow record: evidence_bindings + committed plasticity receipt"
        };
  return Object.freeze({
    schema_version: SUBJECT_EVOLUTION_VIEW_SCHEMA_VERSION,
    subject: Object.freeze({
      subject_id: input.subject_id,
      state_revision: input.state_revision,
      logical_time: input.logical_time,
      repository_revision: input.repository_revision
    }),
    recent_lived_events: Object.freeze(
      input.memory.entries
        .map((entry): EvolutionLivedEventV0 =>
          entry.kind === "OBSERVATION"
            ? Object.freeze({
                kind: "OBSERVATION" as const,
                occurrence_logical_time: entry.occurrence_logical_time,
                episode_ref: entry.episode_ref,
                scene: entry.scene,
                delivered_behavior_text: null,
                outcome_reply_text: null
              })
            : Object.freeze({
                kind: "BEHAVIOR_OUTCOME" as const,
                occurrence_logical_time: entry.occurrence_logical_time,
                episode_ref: entry.episode_ref,
                scene: null,
                delivered_behavior_text: entry.delivered_behavior_text,
                outcome_reply_text: entry.outcome_reply_text
              })
        )
        .reverse()
    ),
    durable_effects: Object.freeze({
      affect: Object.freeze([...affectTransitions].reverse()),
      belief: beliefTransitions
    }),
    current: Object.freeze({
      affect: Object.freeze({ ...input.current.affect }),
      regulation: Object.freeze({ ...input.current.regulation }),
      beliefs: Object.freeze(input.current.beliefs.map((item) => Object.freeze({ ...item }))),
      relationships: Object.freeze(
        input.current.relationships.map((counterpart) =>
          Object.freeze({
            counterpart_ref: counterpart.counterpart_ref,
            dimensions: Object.freeze(counterpart.dimensions.map((dimension) => Object.freeze({ ...dimension })))
          })
        )
      ),
      personality: Object.freeze(input.current.personality.map((dimension) => Object.freeze({ ...dimension }))),
      memory: Object.freeze({
        total_episode_count: input.memory.total_episode_count,
        repository_revision: input.memory.repository_revision
      })
    }),
    cognition_visible: Object.freeze({
      policy: "AVAILABLE_TO_COGNITION" as const,
      memory_episode_refs: Object.freeze([...new Set(input.cognition_memory_episode_refs)].sort()),
      belief_proposition_ids: Object.freeze(input.current.beliefs.map((item) => item.proposition_id).sort()),
      relationship_counterpart_refs: Object.freeze(
        input.current.relationships.map((counterpart) => counterpart.counterpart_ref).sort()
      ),
      personality_dimension_ids: Object.freeze(input.current.personality.map((dimension) => dimension.dimension_id).sort()),
      affect: Object.freeze({ ...input.current.affect })
    }),
    attribution: Object.freeze({
      affect: Object.freeze(affectAttribution),
      belief: Object.freeze(beliefAttribution),
      relationship: Object.freeze({
        status: "UNAVAILABLE" as const,
        reason: EVOLUTION_UNAVAILABLE_REASONS.relationship
      }),
      personality: Object.freeze({
        status: "UNAVAILABLE" as const,
        reason: EVOLUTION_UNAVAILABLE_REASONS.personality
      })
    })
  });
}
