/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — deterministic factual context builder.
 *
 * Builds the SUBJECT-RELATIVE appraisal input from authoritative facts only.
 * The single entrypoint starts from `ExperienceReaderV0` (the ONE authority for
 * Experience/Event/Delivery lineage) and emits a deep-frozen, deterministic
 * context projection whose hash binds subject, Experience ref/hash, episode
 * ref/hash, event ref/hash, outcome ref, delivery/behavior hash, the exact
 * factual texts, the current task, the source state anchor and logical time.
 *
 * NO HOST SENTIMENT TRANSFORMATION (§9): the exact historical texts travel
 * verbatim — no rejection/criticism/sentiment/valence/reward/failure labels are
 * precomputed. The provider performs the subjective evaluation.
 *
 * SUBJECT CONTEXT V0 (§10): the ONLY semantic subject-state input is
 * `SubjectState.context.task`, plus authority anchors (subject, state
 * revision/hash, repository revision, logical time). No Relationship, Belief,
 * Personality, Affect, Mood or memory summaries.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0,
  StateRevisionV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, validateCanonicalText } from "@characteros-next/subject-core";
import { validateRefElement } from "@characteros-next/subject-core";
import type { ExperienceReaderV0 } from "../transitions/conversation/experience-reader.js";

export const EXPERIENCE_APPRAISAL_CONTEXT_SCHEMA_VERSION = "experience-appraisal-context-v0" as const;

/** The verified factual context the provider evaluates (deep frozen). */
export interface ExperienceAppraisalContextProjectionV0 {
  readonly schema_version: typeof EXPERIENCE_APPRAISAL_CONTEXT_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly state_revision: StateRevisionV0;
  readonly state_hash: HashV1;
  readonly logical_time: LogicalTimeV0;
  /** The ONLY semantic subject-state input in V0. */
  readonly current_task: string;
  /** Verified delivered behavior text (from the delivery ledger authority). */
  readonly delivered_behavior_text: string;
  readonly behavior_payload_hash: HashV1;
  readonly behavior_delivery_id: IdentifierV0;
  /** Exact historical reply text — factual, never classified. */
  readonly exact_outcome_text: string;
  readonly actor_ref: CanonicalRefV0;
  readonly outcome_ref: CanonicalRefV0;
  readonly outcome_logical_time: LogicalTimeV0;
  readonly episode_ref: CanonicalRefV0;
  readonly episode_payload_hash: HashV1;
  readonly experience_ref: CanonicalRefV0;
  readonly experience_payload_hash: HashV1;
  readonly event_ref: CanonicalRefV0;
  readonly event_payload_hash: HashV1;
  readonly source_observation_ref: CanonicalRefV0;
  /** Content-addressed integrity of the exact context body. */
  readonly context_projection_hash: HashV1;
}

export type ExperienceAppraisalContextFailureCodeV0 =
  | "READER_MISCONFIGURED"
  | "EPISODE_REF_INVALID"
  | "EXPERIENCE_UNRESOLVED"
  | "INSUFFICIENT_CONTEXT";

export type ExperienceAppraisalContextResultV0 =
  | { readonly ok: true; readonly context: ExperienceAppraisalContextProjectionV0 }
  | { readonly ok: false; readonly code: ExperienceAppraisalContextFailureCodeV0; readonly detail: string };

export interface ExperienceAppraisalContextDepsV0 {
  readonly reader: ExperienceReaderV0;
  /** Optional: authoritative subject-state hash recomputation seam. */
  readonly stateHashOf: (snapshot: SubjectStateV0) => Promise<HashV1>;
}

function contextFail(code: ExperienceAppraisalContextFailureCodeV0, detail: string): ExperienceAppraisalContextResultV0 {
  return { ok: false, code, detail };
}

/**
 * Deterministic context builder. Reads the authoritative factual chain through
 * the ExperienceReader, validates the episode ref grammar, reads the canonical
 * subject context (task) from the anchored snapshot, freezes the projection
 * and computes its content-addressed hash.
 */
export class ExperienceAppraisalContextBuilderV0 {
  constructor(private readonly deps: ExperienceAppraisalContextDepsV0) {}

  async build(input: unknown, snapshot: SubjectStateV0): Promise<ExperienceAppraisalContextResultV0> {
    if (this.deps.reader === undefined || this.deps.reader === null) {
      return contextFail("READER_MISCONFIGURED", "experience reader required");
    }
    if (!isRecord(input)) return contextFail("EPISODE_REF_INVALID", "input: expected object");
    if (typeof input["episode_ref"] !== "string") {
      return contextFail("EPISODE_REF_INVALID", "input.episode_ref: ref string required");
    }
    const episodeCheck = validateRefElement(input["episode_ref"], "input.episode_ref", ["episode"]);
    if (!episodeCheck.ok) return contextFail("EPISODE_REF_INVALID", episodeCheck.error.detail);
    const episodeRef = episodeCheck.value;

    // ---- NULL TASK LAW (§11): never fabricate a goal ------------------------------
    if (snapshot.context.task === null) {
      return contextFail("INSUFFICIENT_CONTEXT", "subject context.task is null: no goal to evaluate against");
    }
    const currentTask = validateCanonicalText(snapshot.context.task, "subject context.task");
    if (!currentTask.ok) return contextFail("INSUFFICIENT_CONTEXT", currentTask.error.detail);

    // ---- authoritative factual chain through the ONE reader ------------------------
    const read = await this.deps.reader.read({
      repository_revision: snapshot.memory_state.repository_revision,
      episode_ref: episodeRef
    });
    if (!read.ok) {
      return contextFail("EXPERIENCE_UNRESOLVED", `${read.code}: ${read.detail}`);
    }
    // The source Observation ref is verified grounding from the record.
    const observationCheck = validateRefElement(
      read.experience.source_observation_ref,
      "experience.source_observation_ref",
      ["observation"]
    );
    if (!observationCheck.ok) return contextFail("EXPERIENCE_UNRESOLVED", observationCheck.error.detail);

    const stateHash = await this.deps.stateHashOf(snapshot);
    const body = {
      schema_version: EXPERIENCE_APPRAISAL_CONTEXT_SCHEMA_VERSION,
      subject_id: snapshot.identity.subject_id as string,
      repository_revision: snapshot.memory_state.repository_revision as string,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      state_hash: stateHash,
      logical_time: snapshot.runtime_metadata.logical_time as number,
      current_task: currentTask.value,
      delivered_behavior_text: (read.behavior as { readonly text: string }).text,
      behavior_payload_hash: read.experience.behavior_payload_hash,
      behavior_delivery_id: read.experience.behavior_delivery_id,
      exact_outcome_text: read.experience.outcome.text,
      actor_ref: read.experience.outcome.actor_ref as string,
      outcome_ref: read.experience.outcome.outcome_ref as string,
      outcome_logical_time: read.experience.outcome.logical_time as number,
      episode_ref: read.episode.episode_ref as string,
      episode_payload_hash: read.hashes.episode,
      experience_ref: read.experience.experience_ref as string,
      experience_payload_hash: read.hashes.experience,
      event_ref: read.event.event_ref as string,
      event_payload_hash: read.hashes.event,
      source_observation_ref: observationCheck.value as string
    };
    const context_projection_hash = await hashEnvelope(
      "characteros-next/appraisal/experience-appraisal-context/v1",
      body
    );
    const context: ExperienceAppraisalContextProjectionV0 = Object.freeze({
      ...body,
      context_projection_hash
    }) as unknown as ExperienceAppraisalContextProjectionV0;
    return { ok: true, context };
  }
}
