/**
 * BELIEF_ADAPTATION_SESSION_WIRING_V0 — minimal interactive orchestration that
 * feeds canonical lived evidence into the FROZEN belief plasticity chain.
 *
 * This module owns NO Belief semantics. It exclusively sequences the frozen
 * authorities after each turn's lived evidence is durably committed:
 *
 *   committed episode refs (canonical Memory)
 *   → existing BeliefAdaptationWorkflowStoreV0 (durable, restored with session)
 *   → §32 resume of non-terminal workflows (never silently abandoned)
 *   → runBeliefAdaptationWorkflowV0 (frozen: semantic resolution → plasticity
 *     → BeliefTransitionExecutor → SubjectCore canonical commit)
 *
 * Lawful boundaries preserved:
 *  - the host chooses WHICH episode refs are offered (this turn's newly
 *    committed episodes) and supplies the candidate universe (ALL current
 *    canonical proposition ids); it never supplies credences, relations,
 *    labels, evidence labels, or mutation values;
 *  - the semantic provider is the ONLY assessor of evidence bearing; host
 *    labels (SUPPORTIVE/CONTRADICTORY) are never passed;
 *  - one deterministic workflow id per (subject, evidence set): replaying the
 *    same evidence can never create a second workflow identity, so a committed
 *    plasticity can never be applied twice (§52/§64);
 *  - the workflow's strict stale policy (MAX_STALE_REBUILDS 0) and write-once
 *    terminals are preserved untouched; RESTART_REQUIRED/FATAL outcomes are
 *    reported observably and never retried inside the same invocation;
 *  - a wiring/provider failure NEVER fails the interactive turn: canonical
 *    turn work (cognition/delivery/Memory) is already complete; belief simply
 *    remains unchanged (§65 fail-closed, no neutral update).
 */

import type { IdentifierV0 } from "@characteros-next/subject-core";
import { sha256HashV1 } from "@characteros-next/subject-core";
import type { EpisodicMemoryRecordV0, MemoryPreparationAuthority } from "@characteros-next/memory";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import {
  BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
  runBeliefAdaptationWorkflowV0,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowDepsV0,
  type BeliefAdaptationWorkflowRecordV0
} from "../transitions/belief/belief-adaptation-workflow.js";
import type { BeliefSemanticTargetResolutionProviderV0 } from "../transitions/belief/belief-semantic-target-resolution.js";
import { InMemoryBeliefAdaptationWorkflowStoreV0 } from "../transitions/belief/belief-adaptation-workflow-store.js";

/** Exact observable disposition of ONE workflow invocation (resumed or current). */
export interface BeliefAdaptationWorkflowOutcomeV0 {
  readonly workflow_id: string;
  /** Exact frozen terminal kind, or "NOT_TERMINAL" for RESTART_REQUIRED/FATAL paths. */
  readonly terminal_kind: string;
  readonly detail: string | null;
  readonly evidence_episode_refs: readonly string[];
  readonly provider_calls: number;
  /** Filled only when a canonical Belief commit (or its reconciliation) is proven. */
  readonly proposition_id: string | null;
  readonly prior_credence: number | null;
  readonly next_credence: number | null;
}

/** Observable per-turn belief-adaptation report (host/audit surface only). */
export interface BeliefAdaptationTurnReportV0 {
  readonly status:
    | "DISABLED"
    | "SKIPPED_NO_CANDIDATE_PROPOSITIONS"
    | "EVIDENCE_UNAVAILABLE"
    | "COMPLETED";
  /** §32 resume results for pre-existing non-terminal workflows (in id order). */
  readonly resumed: readonly BeliefAdaptationWorkflowOutcomeV0[];
  /** This invocation's own evidence workflow outcome (null when skipped). */
  readonly current: BeliefAdaptationWorkflowOutcomeV0 | null;
  /** Wiring-level failure detail (never a belief mutation). */
  readonly failure: string | null;
}

export interface BeliefAdaptationWiringDepsV0 {
  readonly subjectCore: SubjectCorePort;
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly producerAuthorizationIssuer: BeliefAdaptationWorkflowDepsV0["producerAuthorizationIssuer"];
  /** Null disables belief adaptation entirely (no store, no provider calls). */
  readonly semanticProvider: BeliefSemanticTargetResolutionProviderV0 | null;
  readonly workflowStore: InMemoryBeliefAdaptationWorkflowStoreV0;
  /** Public committed-bundle read authority (commit-before-terminal reconciliation). */
  readonly readCommittedBundle: BeliefAdaptationWorkflowDepsV0["readCommittedBundle"];
  /** Canonical episode payload reader (fail-closed when a ref is unreadable). */
  readonly readEpisodePayload: (ref: string) => Promise<unknown>;
}

/** Host-minted counting proxy: exact provider-call accounting, no semantic role. */
class CountingSemanticProviderV0 implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  constructor(private readonly inner: BeliefSemanticTargetResolutionProviderV0) {}
  async propose(input: Parameters<BeliefSemanticTargetResolutionProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    return this.inner.propose(input);
  }
}

/**
 * Deterministic workflow identity for one (subject, evidence set): the SAME
 * evidence can never open a second workflow, so replay/restore can never
 * double-apply an already-consumed plasticity (§52/§64).
 */
async function deriveBeliefAdaptationWorkflowIdV0(
  subjectId: string,
  episodeRefs: readonly string[]
): Promise<IdentifierV0> {
  const digest = await sha256HashV1(
    JSON.stringify({ projection: "characteros-next/runtime/belief-adaptation-workflow-id/v1", subject_id: subjectId, episode_refs: [...episodeRefs].sort() })
  );
  const raw = `wf-belief-adapt-${digest.replace(/^sha256:/, "").slice(0, 24)}`;
  return raw as IdentifierV0;
}

function notTerminal(terminal: BeliefAdaptationTerminalV0): string | null {
  if (
    terminal.kind === "RESTART_REQUIRED" ||
    terminal.kind === "FATAL_REUSE_CONFLICT"
  ) {
    return null;
  }
  return terminal.kind;
}

export class BeliefAdaptationWiringV0 {
  constructor(private readonly deps: BeliefAdaptationWiringDepsV0) {}

  /**
   * Offers canonical lived evidence to the frozen belief plasticity chain.
   * Never throws: every failure is reported observably and belief remains
   * unchanged (§55/§65 — non-change is a lawful disposition).
   */
  async runForEpisodeRefs(input: {
    readonly subject_id: string;
    readonly episode_refs: readonly string[];
  }): Promise<BeliefAdaptationTurnReportV0> {
    if (this.deps.semanticProvider === null) {
      return { status: "DISABLED", resumed: [], current: null, failure: null };
    }
    const resumed: BeliefAdaptationWorkflowOutcomeV0[] = [];
    try {
      // ---- §32: drive pre-existing non-terminal workflows to their lawful
      // terminal BEFORE new work, so a checkpointed canonical Belief
      // transition is never silently abandoned by turn progression.
      for (const workflowId of this.deps.workflowStore.listNonTerminalWorkflowIds()) {
        resumed.push(await this.resumeOne(input.subject_id, workflowId));
      }

      const snapshot = await this.deps.subjectCore.readCurrentSnapshot(input.subject_id as never);
      if (snapshot === null) {
        return { status: "EVIDENCE_UNAVAILABLE", resumed, current: null, failure: "canonical subject state unavailable" };
      }
      const candidateIds = snapshot.beliefs.items
        .map((item) => item.proposition_id as string)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (candidateIds.length === 0) {
        // Truthful no-op disposition: with an empty canonical proposition
        // catalog no lawful EXISTING_PROPOSITION decision is possible, so the
        // evidence is not offered and NO provider call is spent (§55).
        return { status: "SKIPPED_NO_CANDIDATE_PROPOSITIONS", resumed, current: null, failure: null };
      }
      const episodes = await this.readEpisodes(input.episode_refs);
      if (episodes === null) {
        return { status: "EVIDENCE_UNAVAILABLE", resumed, current: null, failure: "episode payload unreadable for evidence refs" };
      }
      const current = await this.invokeWorkflow({
        subject_id: input.subject_id,
        episodeRefs: input.episode_refs,
        episodes,
        candidateIds
      });
      return { status: "COMPLETED", resumed, current, failure: null };
    } catch (error) {
      return {
        status: "EVIDENCE_UNAVAILABLE",
        resumed,
        current: null,
        failure: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /** §32 resume: reconstruct the EXACT original request and re-invoke. */
  private async resumeOne(subjectId: string, workflowId: string): Promise<BeliefAdaptationWorkflowOutcomeV0> {
    const record: BeliefAdaptationWorkflowRecordV0 | null = await this.deps.workflowStore.load(workflowId as never);
    if (record === null || record.subject_id !== subjectId) {
      return {
        workflow_id: workflowId,
        terminal_kind: "NOT_TERMINAL",
        detail: "resumable workflow record unavailable or foreign subject; left untouched",
        evidence_episode_refs: [],
        provider_calls: 0,
        proposition_id: null,
        prior_credence: null,
        next_credence: null
      };
    }
    const refs = record.evidence_bindings.map((binding) => binding.episode_ref as string);
    const episodes = await this.readEpisodes(refs);
    if (episodes === null) {
      return {
        workflow_id: workflowId,
        terminal_kind: "NOT_TERMINAL",
        detail: "resumable workflow evidence payload unreadable; left untouched",
        evidence_episode_refs: refs,
        provider_calls: 0,
        proposition_id: null,
        prior_credence: null,
        next_credence: null
      };
    }
    return this.invokeWorkflow({
      subject_id: subjectId,
      episodeRefs: refs,
      episodes,
      candidateIds: [...record.proposition_candidate_ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      workflowId,
      // The reconstructed request must be byte-identical to the original:
      // the workflow identity binds the ORIGINAL revisions, never current ones.
      expected_initial_state_revision: record.initial_state_revision as number,
      expected_repository_revision: record.repository_revision as string
    });
  }

  private async readEpisodes(refs: readonly string[]): Promise<EpisodicMemoryRecordV0[] | null> {
    const episodes: EpisodicMemoryRecordV0[] = [];
    for (const ref of [...refs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const payload = await this.deps.readEpisodePayload(ref);
      if (payload === null || payload === undefined) return null;
      episodes.push(payload as EpisodicMemoryRecordV0);
    }
    return episodes;
  }

  private async invokeWorkflow(input: {
    readonly subject_id: string;
    readonly episodeRefs: readonly string[];
    readonly episodes: readonly EpisodicMemoryRecordV0[];
    readonly candidateIds: readonly string[];
    readonly workflowId?: string;
    /** Required for resume reconstruction; defaults to the current canonical binding. */
    readonly expected_initial_state_revision?: number;
    readonly expected_repository_revision?: string;
  }): Promise<BeliefAdaptationWorkflowOutcomeV0> {
    const priorSnapshot = await this.deps.subjectCore.readCurrentSnapshot(input.subject_id as never);
    if (priorSnapshot === null) {
      return {
        workflow_id: input.workflowId ?? "",
        terminal_kind: "NOT_TERMINAL",
        detail: "canonical subject state unavailable",
        evidence_episode_refs: input.episodeRefs,
        provider_calls: 0,
        proposition_id: null,
        prior_credence: null,
        next_credence: null
      };
    }
    const priorBeliefs = new Map(
      priorSnapshot.beliefs.items.map((item) => [item.proposition_id as string, item.credence as number])
    );
    const workflowId =
      input.workflowId ??
      (await deriveBeliefAdaptationWorkflowIdV0(input.subject_id, input.episodeRefs));
    const counting = new CountingSemanticProviderV0(this.deps.semanticProvider as BeliefSemanticTargetResolutionProviderV0);
    const terminal = await runBeliefAdaptationWorkflowV0(
      {
        subjectCore: this.deps.subjectCore,
        memoryRepository: this.deps.memoryRepository,
        producerAuthorizationIssuer: this.deps.producerAuthorizationIssuer,
        semanticProvider: counting,
        workflowStore: this.deps.workflowStore,
        readCommittedBundle: this.deps.readCommittedBundle
      },
      {
        schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
        workflow_id: workflowId,
        subject_id: input.subject_id,
        expected_initial_state_revision:
          input.expected_initial_state_revision ?? (priorSnapshot.runtime_metadata.state_revision as number),
        expected_repository_revision:
          input.expected_repository_revision ?? (priorSnapshot.memory_state.repository_revision as string),
        proposition_candidate_ids: input.candidateIds,
        selected_episodes: [...input.episodes]
      }
    );
    const kind = notTerminal(terminal) ?? "NOT_TERMINAL";
    const committed =
      terminal.kind === "COMPLETE_COMMITTED" || terminal.kind === "COMPLETE_ALREADY_COMMITTED";
    if (!committed) {
      const detailSource = terminal as { readonly detail?: string; readonly code?: string; readonly source?: string };
      const diagnostic =
        terminal.kind === "REJECTED_SEMANTIC" || terminal.kind === "REJECTED_EXECUTOR"
          ? `${terminal.kind}:${detailSource.code ?? "?"}: ${detailSource.detail ?? ""}`.trimEnd()
          : terminal.kind === "RESTART_REQUIRED" || terminal.kind === "FATAL_REUSE_CONFLICT"
            ? `${terminal.kind}:${detailSource.code ?? detailSource.source ?? "?"}: ${detailSource.detail ?? ""}`.trimEnd()
            : null;
      return {
        workflow_id: workflowId,
        terminal_kind: kind,
        detail: diagnostic,
        evidence_episode_refs: input.episodeRefs,
        provider_calls: counting.calls,
        proposition_id: null,
        prior_credence: null,
        next_credence: null
      };
    }
    // Canonical post-read is the ONLY credence authority for the report.
    const afterSnapshot = await this.deps.subjectCore.readCurrentSnapshot(input.subject_id as never);
    const record: BeliefAdaptationWorkflowRecordV0 | null = await this.deps.workflowStore.load(workflowId as never);
    const proposal = record?.proposal_checkpoint?.proposal ?? null;
    const propositionId =
      proposal !== null && proposal.mutation.kind === "UPDATE" ? (proposal.mutation.proposition_id as string) : null;
    const nextCredence =
      afterSnapshot !== null && propositionId !== null
        ? (afterSnapshot.beliefs.items.find((item) => item.proposition_id === propositionId)?.credence as number | undefined) ?? null
        : null;
    return {
      workflow_id: workflowId,
      terminal_kind: kind,
      detail: null,
      evidence_episode_refs: input.episodeRefs,
      provider_calls: counting.calls,
      proposition_id: propositionId,
      // prior_credence is only meaningful for a commit performed by THIS
      // invocation; an ALREADY_COMMITTED reconciliation reports the reconciled
      // next_credence only.
      prior_credence:
        terminal.kind === "COMPLETE_COMMITTED" && propositionId !== null
          ? (priorBeliefs.get(propositionId) ?? null)
          : null,
      next_credence: nextCredence
    };
  }
}
