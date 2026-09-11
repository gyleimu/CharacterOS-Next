/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production orchestration that
 * feeds already-committed canonical lived evidence into the FROZEN Personality
 * plasticity chain.
 *
 * This module owns NO Personality semantics. It sequences existing authorities:
 *
 *   committed episodes (canonical Memory)
 *   → MemoryInfluenceProjectionV0[] (frozen projection)
 *   → PersonalitySemanticEvidenceViewV0 (trusted, subject-scoped revision)
 *   → PersonalitySemanticChannel (provider selects one allowlisted channel or ABSTAIN)
 *   → PersonalityEvidenceChannel bridge / PersonalityPlasticityProducerV0
 *   → PersonalityTransitionExecutor → SubjectCore canonical commit → P1
 *
 * Boundaries preserved:
 *  - only already-committed canonical episodes are consumed; no raw text,
 *    transcript, host sentiment, label, or numeric delta enters here;
 *  - the provider may only select an allowlisted channel or ABSTAIN — trusted
 *    code owns evidence validation, channel→dimension/direction mapping,
 *    eligibility, numeric step, and canonical mutation;
 *  - evidence membership is the canonical revision-bounded historical
 *    visibility law (`validateRefsBelong`) enforced by the semantic runner and
 *    the executor; the wiring adds no weaker runtime check;
 *  - the write-once adaptation store makes the SAME evidence set apply at most
 *    once (replay/restart cannot double-apply);
 *  - an empty Personality fails closed: no dimensions are ever created;
 *  - any provider/selection failure leaves Personality unchanged (§ fail-closed).
 */

import {
  sha256HashV1,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  type IdentifierV0,
  type LogicalTimeV0,
  type PersonalityStateV0,
  type ProducerAuthorizationIssuer,
  type StateRevisionV0,
  type SubjectStateV4
} from "@characteros-next/subject-core";
import {
  aggregateInfluenceEvidence,
  type InfluenceEvidenceAggregateV0
} from "@characteros-next/influence-evidence";
import {
  ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY,
  projectMemoryInfluences,
  type MemoryInfluencePolicyV0
} from "@characteros-next/memory-influence";
import type { EpisodicMemoryRecordV0, MemoryPreparationAuthority } from "@characteros-next/memory";
import {
  PersonalityTransitionExecutor,
  type PersonalityExecutionResult,
  type SubjectCorePort
} from "@characteros-next/runtime";

import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityPolicyV0
} from "./personality-plasticity-producer.js";
import type { PersonalityEvidenceChannelPolicyV0 } from "./personality-evidence-channel.js";
import {
  personalitySemanticEvidenceViewFromV4,
  producePersonalityPlasticityFromSemanticChannelProposal,
  runPersonalitySemanticChannelProposalV0,
  type PersonalitySemanticChannelCatalogV0,
  type PersonalitySemanticChannelProviderV0
} from "./personality-semantic-channel.js";
import {
  buildPersonalityProductionChannelPolicyV0,
  buildPersonalityProductionSemanticCatalogV0
} from "./personality-production-channels-v0.js";
import {
  InMemoryPersonalityAdaptationStoreV0,
  type PersonalityAdaptationRecordV0,
  type PersonalityAdaptationTerminalV0
} from "./personality-adaptation-store-v0.js";

export interface PersonalityAdaptationWiringDepsV0 {
  /** Subject-scoped canonical core (reads the SAME subject whose repository is supplied). */
  readonly subjectCore: SubjectCorePort;
  /** Subject-scoped memory repository: membership verdicts + canonical payload hashes. */
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  /** Canonical episode payload reader (fail-closed when unreadable). */
  readonly readEpisodePayload: (ref: string) => Promise<unknown>;
  /** Null disables personality adaptation entirely (no store writes, no provider calls). */
  readonly semanticProvider: PersonalitySemanticChannelProviderV0 | null;
  readonly store: InMemoryPersonalityAdaptationStoreV0;
  readonly channelPolicy?: PersonalityEvidenceChannelPolicyV0;
  readonly semanticCatalog?: PersonalitySemanticChannelCatalogV0;
  readonly plasticityPolicy?: PersonalityPlasticityPolicyV0;
  readonly memoryInfluencePolicy?: MemoryInfluencePolicyV0;
}

export type PersonalityAdaptationStatusV0 =
  | "DISABLED"
  | "EVIDENCE_UNAVAILABLE"
  | "SKIPPED_EMPTY_PERSONALITY"
  | "SKIPPED_ALREADY_CONSUMED"
  | "COMPLETED";

export interface PersonalityAdaptationReportV0 {
  readonly status: PersonalityAdaptationStatusV0;
  readonly terminal: PersonalityAdaptationTerminalV0 | "REJECTED" | null;
  readonly evidence_episode_refs: readonly string[];
  readonly evidence_member_count: number | null;
  readonly total_activation: number | null;
  readonly mean_activation: number | null;
  readonly channel_id: string | null;
  readonly dimension_id: string | null;
  readonly direction: string | null;
  readonly prior_value: number | null;
  readonly next_value: number | null;
  readonly transition_ref: string | null;
  readonly rejection_code: string | null;
  readonly detail: string | null;
  readonly provider_calls: number;
}

/** Host-minted counting proxy: exact provider-call accounting, no semantic role. */
class CountingPersonalitySemanticProviderV0 implements PersonalitySemanticChannelProviderV0 {
  calls = 0;
  constructor(private readonly inner: PersonalitySemanticChannelProviderV0) {}
  async propose(input: Parameters<PersonalitySemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    return this.inner.propose(input);
  }
}

function brandIdentifier(value: string): IdentifierV0 {
  const checked = validateIdentifier(value, "personality_adaptation.subject_id");
  if (!checked.ok) throw new Error(`PERSONALITY_ADAPTATION_INVALID: ${checked.error.detail}`);
  return checked.value;
}

function brandLogicalTime(value: number): LogicalTimeV0 {
  const checked = validateLogicalTime(value, "personality_adaptation.logical_time");
  if (!checked.ok) throw new Error(`PERSONALITY_ADAPTATION_INVALID: ${checked.error.detail}`);
  return checked.value;
}

function brandStateRevision(value: number): StateRevisionV0 {
  const checked = validateStateRevision(value, "personality_adaptation.state_revision");
  if (!checked.ok) throw new Error(`PERSONALITY_ADAPTATION_INVALID: ${checked.error.detail}`);
  return checked.value;
}

function emptyReport(
  status: PersonalityAdaptationStatusV0,
  extra: Partial<PersonalityAdaptationReportV0> = {}
): PersonalityAdaptationReportV0 {
  return {
    status,
    terminal: null,
    evidence_episode_refs: [],
    evidence_member_count: null,
    total_activation: null,
    mean_activation: null,
    channel_id: null,
    dimension_id: null,
    direction: null,
    prior_value: null,
    next_value: null,
    transition_ref: null,
    rejection_code: null,
    detail: null,
    provider_calls: 0,
    ...extra
  };
}

export class PersonalityAdaptationWiringV0 {
  private readonly executor: PersonalityTransitionExecutor;

  constructor(private readonly deps: PersonalityAdaptationWiringDepsV0) {
    this.executor = new PersonalityTransitionExecutor({
      subjectCore: deps.subjectCore,
      issuer: deps.producerAuthorizationIssuer,
      memoryRepository: deps.memoryRepository
    });
  }

  exportState(): unknown {
    return this.deps.store.exportState();
  }

  async restoreState(
    state: unknown
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly detail: string }> {
    return this.deps.store.restoreState(state);
  }

  /**
   * Offer this turn's already-committed canonical episodes to the frozen
   * Personality plasticity chain. Never throws: every failure is reported and
   * Personality remains unchanged.
   */
  async runForEpisodeRefs(input: {
    readonly subject_id: string;
    readonly episode_refs: readonly string[];
  }): Promise<PersonalityAdaptationReportV0> {
    if (this.deps.semanticProvider === null) {
      return emptyReport("DISABLED", { evidence_episode_refs: [...input.episode_refs] });
    }
    const newRefs = [...new Set(input.episode_refs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (newRefs.length === 0) {
      return emptyReport("EVIDENCE_UNAVAILABLE", { detail: "no committed lived episode this turn" });
    }
    try {
      const snapshotRaw = await this.deps.subjectCore.readCurrentSnapshot(input.subject_id as never);
      if (snapshotRaw === null) {
        return emptyReport("EVIDENCE_UNAVAILABLE", {
          evidence_episode_refs: newRefs,
          detail: "canonical subject state unavailable"
        });
      }
      const snapshot = snapshotRaw as unknown as SubjectStateV4;
      if (snapshot.personality.dimensions.length === 0) {
        // §17 fail-closed: plasticity never invents dimensions.
        return emptyReport("SKIPPED_EMPTY_PERSONALITY", { evidence_episode_refs: newRefs });
      }

      // Accumulate this subject's coherent committed-evidence window so the
      // frozen eligibility thresholds can be reached by genuinely distinct
      // experiences (never by duplicating one episode). Episodes from ancestor
      // revisions remain lawfully visible at the bound revision.
      const episodeRefs = [
        ...new Set([...this.deps.store.evidenceRefsForSubject(input.subject_id), ...newRefs])
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const evidenceKey = await this.deriveEvidenceKey(input.subject_id, episodeRefs);
      if (this.deps.store.has(evidenceKey)) {
        return emptyReport("SKIPPED_ALREADY_CONSUMED", {
          evidence_episode_refs: episodeRefs,
          detail: "this exact canonical evidence set has already been offered"
        });
      }

      const records = await this.readEpisodes(episodeRefs);
      if (records === null) {
        return emptyReport("EVIDENCE_UNAVAILABLE", {
          evidence_episode_refs: episodeRefs,
          detail: "episode payload unreadable for evidence refs"
        });
      }

      const logicalTime = brandLogicalTime(snapshot.runtime_metadata.logical_time as number);
      const projections = projectMemoryInfluences(
        records,
        logicalTime,
        this.deps.memoryInfluencePolicy ?? ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY
      );
      const aggregate = aggregateInfluenceEvidence(projections);

      const policy = this.deps.channelPolicy ?? buildPersonalityProductionChannelPolicyV0();
      const catalog = this.deps.semanticCatalog ?? (await buildPersonalityProductionSemanticCatalogV0());
      const counting = new CountingPersonalitySemanticProviderV0(
        this.deps.semanticProvider as PersonalitySemanticChannelProviderV0
      );

      const semanticResult = await runPersonalitySemanticChannelProposalV0({
        evidence_view: personalitySemanticEvidenceViewFromV4(snapshot),
        selected_records: records,
        repository: this.deps.memoryRepository,
        channel_policy: policy,
        semantic_catalog: catalog,
        provider: counting
      });

      if (semanticResult.kind === "REJECTED") {
        return emptyReport("COMPLETED", {
          terminal: "REJECTED",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          rejection_code: semanticResult.code,
          detail: semanticResult.detail,
          provider_calls: counting.calls
        });
      }

      if (semanticResult.proposal.kind === "ABSTAIN") {
        this.recordTerminal(evidenceKey, input.subject_id, episodeRefs, "ABSTAIN", aggregate, null);
        return emptyReport("COMPLETED", {
          terminal: "ABSTAIN",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          provider_calls: counting.calls
        });
      }

      const plasticityContext: PersonalityPlasticityContextV0 = {
        subject_id: brandIdentifier(snapshot.identity.subject_id as string),
        expected_state_revision: brandStateRevision(snapshot.runtime_metadata.state_revision as number),
        current_personality: snapshot.personality as unknown as PersonalityStateV0
      };
      const bridged = await producePersonalityPlasticityFromSemanticChannelProposal(
        semanticResult,
        policy,
        plasticityContext,
        projections,
        this.deps.plasticityPolicy ?? ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
      );

      if (bridged.kind === "ABSTAIN") {
        this.recordTerminal(evidenceKey, input.subject_id, episodeRefs, "ABSTAIN", aggregate, null);
        return emptyReport("COMPLETED", {
          terminal: "ABSTAIN",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          provider_calls: counting.calls
        });
      }
      if (bridged.kind === "REJECTED") {
        return emptyReport("COMPLETED", {
          terminal: "REJECTED",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          rejection_code: bridged.code,
          detail: bridged.detail,
          provider_calls: counting.calls
        });
      }

      const channelResult = bridged.channel_result;
      if (channelResult.kind !== "RESOLVED") {
        // Evidence-channel/config rejection: no mutation, no consumption.
        return emptyReport("COMPLETED", {
          terminal: "REJECTED",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          rejection_code: channelResult.kind,
          detail: channelResult.detail,
          provider_calls: counting.calls
        });
      }
      const { decision, producerResult } = channelResult;
      const priorValue = this.dimensionValue(
        plasticityContext.current_personality,
        decision.target_dimension_id as string
      );

      if (producerResult.kind !== "PROPOSED") {
        const terminal: PersonalityAdaptationTerminalV0 =
          producerResult.kind === "NOT_ELIGIBLE" ? "NOT_ELIGIBLE" : "NO_CHANGE";
        this.recordTerminal(evidenceKey, input.subject_id, episodeRefs, terminal, aggregate, {
          channel_id: decision.channel_id as string,
          dimension_id: decision.target_dimension_id as string,
          direction: decision.direction,
          prior_value: priorValue
        });
        return emptyReport("COMPLETED", {
          terminal,
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          channel_id: decision.channel_id as string,
          dimension_id: decision.target_dimension_id as string,
          direction: decision.direction,
          prior_value: priorValue,
          detail:
            producerResult.kind === "NOT_ELIGIBLE"
              ? producerResult.reasons.join(",")
              : producerResult.detail,
          provider_calls: counting.calls
        });
      }

      const runtimeContext = {
        subject_id: plasticityContext.subject_id,
        current_logical_time: logicalTime,
        state_revision: plasticityContext.expected_state_revision
      };
      const executed: PersonalityExecutionResult = await this.executor.execute(
        runtimeContext,
        producerResult.proposal
      );
      if (executed.kind !== "COMMITTED" && executed.kind !== "ALREADY_COMMITTED") {
        return emptyReport("COMPLETED", {
          terminal: "REJECTED",
          evidence_episode_refs: episodeRefs,
          evidence_member_count: aggregate.member_count,
          total_activation: aggregate.total_activation,
          mean_activation: aggregate.mean_activation,
          channel_id: decision.channel_id as string,
          dimension_id: decision.target_dimension_id as string,
          direction: decision.direction,
          prior_value: priorValue,
          rejection_code: executed.kind,
          detail: executed.detail,
          provider_calls: counting.calls
        });
      }
      const terminal: PersonalityAdaptationTerminalV0 =
        executed.kind === "COMMITTED" ? "COMMITTED" : "ALREADY_COMMITTED";
      const nextValue = producerResult.proposal.updates[0]?.next_value ?? null;
      const transitionRef =
        typeof executed.bundle.transition_id === "string" ? executed.bundle.transition_id : null;
      this.recordTerminal(evidenceKey, input.subject_id, episodeRefs, terminal, aggregate, {
        channel_id: decision.channel_id as string,
        dimension_id: decision.target_dimension_id as string,
        direction: decision.direction,
        prior_value: priorValue,
        next_value: typeof nextValue === "number" ? nextValue : null,
        transition_ref: transitionRef
      });
      return emptyReport("COMPLETED", {
        terminal,
        evidence_episode_refs: episodeRefs,
        evidence_member_count: aggregate.member_count,
        total_activation: aggregate.total_activation,
        mean_activation: aggregate.mean_activation,
        channel_id: decision.channel_id as string,
        dimension_id: decision.target_dimension_id as string,
        direction: decision.direction,
        prior_value: priorValue,
        next_value: typeof nextValue === "number" ? nextValue : null,
        transition_ref: transitionRef,
        provider_calls: counting.calls
      });
    } catch (error) {
      return emptyReport("EVIDENCE_UNAVAILABLE", {
        evidence_episode_refs: newRefs,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async deriveEvidenceKey(subjectId: string, episodeRefs: readonly string[]): Promise<string> {
    const hash = await sha256HashV1(
      JSON.stringify({
        projection: "characteros-next/personality/adaptation-evidence-key/v1",
        subject_id: subjectId,
        episode_refs: [...episodeRefs]
      })
    );
    return hash;
  }

  private async readEpisodes(refs: readonly string[]): Promise<EpisodicMemoryRecordV0[] | null> {
    const records: EpisodicMemoryRecordV0[] = [];
    for (const ref of refs) {
      const payload = await this.deps.readEpisodePayload(ref);
      if (payload === null || payload === undefined) return null;
      records.push(payload as EpisodicMemoryRecordV0);
    }
    return records;
  }

  private dimensionValue(personality: PersonalityStateV0, dimensionId: string): number | null {
    const dimension = personality.dimensions.find((entry) => entry.dimension_id === dimensionId);
    return dimension === undefined ? null : (dimension.value as number);
  }

  private recordTerminal(
    evidenceKey: string,
    subjectId: string,
    episodeRefs: readonly string[],
    terminal: PersonalityAdaptationTerminalV0,
    aggregate: InfluenceEvidenceAggregateV0,
    routing: {
      readonly channel_id: string;
      readonly dimension_id: string;
      readonly direction: string;
      readonly prior_value: number | null;
      readonly next_value?: number | null;
      readonly transition_ref?: string | null;
    } | null
  ): void {
    const record: PersonalityAdaptationRecordV0 = {
      evidence_key: evidenceKey,
      subject_id: subjectId,
      evidence_episode_refs: [...episodeRefs],
      terminal,
      channel_id: routing?.channel_id ?? null,
      dimension_id: routing?.dimension_id ?? null,
      direction: routing?.direction ?? null,
      prior_value: routing?.prior_value ?? null,
      next_value: routing?.next_value ?? null,
      member_count: aggregate.member_count,
      total_activation: aggregate.total_activation,
      mean_activation: aggregate.mean_activation,
      transition_ref: routing?.transition_ref ?? null
    };
    this.deps.store.record(record);
  }
}
