/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — reusable subject-session orchestrator.
 *
 * The session owns SEQUENCING and OPERATIONAL CONTINUITY only. Given the next
 * observable interaction from an environment, it automatically runs the lawful
 * internal lifecycle through observable behavior and durable learning, and can
 * checkpoint/restore that continuity. It never chooses Memory, intent, directive
 * or wording, and it implements no psychology.
 *
 * Observable fields reported alongside behavior (current_intent,
 * considered_context_refs, ...) are READ FROM THE RAW MODEL RESPONSE the
 * provider actually returned — never injected by the session, never re-decided.
 *
 * Public surface (intentionally small):
 *   createLongHorizonSubjectSessionV0(options) → session
 *   session.processInteraction()               → one interaction, end to end
 *   session.checkpoint()                       → durable + operational snapshot
 *   session.restore(checkpoint)                → fresh authority from durable state
 *   session.status()                           → read-only operator projection
 *   session.ledger() / session.pendingWork()   → observational trace / work queue
 */

import { hashEnvelope, sha256HashV1 } from "@characteros-next/subject-core";
import type { ModelTransportV0 } from "../transports/model-transport.js";
import type { ModelTransportTraceV0 } from "../transports/model-transport-trace-v0.js";
import { InMemoryConversationDeliveryLedger } from "../transitions/conversation/behavior-delivery-ledger.js";
import { InMemoryConversationIngressLedger } from "../transitions/conversation/conversation-ingress-ledger.js";
import type {
  EnvironmentStateV0,
  PendingLifecycleWorkV0,
  SessionCheckpointV0,
  SessionInteractionOutcomeV0,
  SessionRestoreOutcomeV0,
  SubjectEnvironmentV0,
  SubjectSessionStatusV0
} from "./session-contracts-v0.js";
import {
  ExplicitV4SessionAuthorityV0,
  type ExplicitV4SessionAuthorityOptionsV0,
  type SessionResponseResultV0
} from "./explicit-v4-session-authority-v0.js";

export interface LongHorizonSubjectSessionOptionsV0 extends ExplicitV4SessionAuthorityOptionsV0 {
  readonly session_id: string;
  readonly environment: SubjectEnvironmentV0;
  /** Lawful interval between interactions (frozen cadence for V0). */
  readonly interaction_interval_ticks: number;
  /** Provider request identity inputs (optional; enables the identity audit). */
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  readonly clock?: () => string;
}

interface CapturedExchange {
  readonly request: { readonly system_content: string; readonly user_content: string };
  readonly response: string;
}

/** Records the exact messages handed to a transport and the raw response, then
 * forwards unchanged — a pure observation seam over production transports. */
function recordingTransport(target: ModelTransportV0, sink: (exchange: CapturedExchange) => void): ModelTransportV0 {
  return {
    complete: async (request) => {
      const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
      const response = await target.complete(request);
      sink({
        request: {
          system_content: messages.find((message) => message.role === "system")?.content ?? "",
          user_content: messages.find((message) => message.role === "user")?.content ?? ""
        },
        response: (response as { content: string }).content
      });
      return response;
    }
  } as ModelTransportV0;
}

/** Observational read of the raw cognition response (never a re-decision). */
function readRawCognition(container: Record<string, unknown>): { cognition: Record<string, unknown> | null; directive: string | null } {
  const raw = container["cognition"];
  if (typeof raw !== "object" || raw === null) return { cognition: null, directive: null };
  const directive = (container["communication_directive"] as { kind?: string } | undefined)?.kind ?? null;
  return { cognition: raw as Record<string, unknown>, directive };
}

function asRefArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is string => typeof entry === "string");
}

export class LongHorizonSubjectSessionV0 {
  private authority: ExplicitV4SessionAuthorityV0;
  private readonly options: LongHorizonSubjectSessionOptionsV0;
  private interactionIndex = 0;
  private readonly outcomes: SessionInteractionOutcomeV0[] = [];
  private readonly restores: SessionRestoreOutcomeV0[] = [];
  private readonly checkpoints: SessionCheckpointV0[] = [];
  /** Internal capture slot populated by the recording transports. */
  captureHolder: { cognition: CapturedExchange | null; language: CapturedExchange | null } = { cognition: null, language: null };
  /** The recording transports, reused across restore so capture never lapses. */
  private wrappedTransports: { cognition: ModelTransportV0; language: ModelTransportV0 } | null = null;

  private constructor(authority: ExplicitV4SessionAuthorityV0, options: LongHorizonSubjectSessionOptionsV0) {
    this.authority = authority;
    this.options = options;
    authority.setSubjectId(options.subject.subject_id);
  }

  static async create(options: LongHorizonSubjectSessionOptionsV0): Promise<LongHorizonSubjectSessionV0> {
    const holder: { cognition: CapturedExchange | null; language: CapturedExchange | null } = { cognition: null, language: null };
    const cognitionTransport = recordingTransport(options.conversationCognitionTransport, (exchange) => {
      holder.cognition = exchange;
    });
    const languageTransport = recordingTransport(options.languageTransport, (exchange) => {
      holder.language = exchange;
    });
    const authority = await ExplicitV4SessionAuthorityV0.createFresh({
      ...options,
      conversationCognitionTransport: cognitionTransport,
      languageTransport
    });
    const session = new LongHorizonSubjectSessionV0(authority, options);
    session.captureHolder = holder;
    session.wrappedTransports = { cognition: cognitionTransport, language: languageTransport };
    return session;
  }

  /** Non-narrowing read of the last captured exchange (method call avoids CFA narrowing). */
  private readCapture(kind: "cognition" | "language"): CapturedExchange | null {
    return kind === "cognition" ? this.captureHolder.cognition : this.captureHolder.language;
  }

  /** §5/§16 — one observable interaction, processed automatically end to end. */
  async processInteraction(): Promise<SessionInteractionOutcomeV0> {
    const index = this.interactionIndex;
    const interaction = this.options.environment.nextInteraction(index);
    const tag = `i${index}`;
    const envBefore = this.options.environment.exportState();
    const before = await this.authority.readSnapshot();
    const base = {
      sessionId: this.options.session_id,
      subjectId: this.options.subject.subject_id,
      index,
      interaction,
      envBefore,
      logicalTimeBefore: before.runtime_metadata.logical_time as number,
      affectBefore: before.affect.valence,
      revisionBefore: before.runtime_metadata.state_revision as number,
      repositoryBefore: before.memory_state.repository_revision as string
    };

    try {
      // §24 lawful interval, then §15/§16 mandatory outstanding lifecycle work.
      await this.authority.advanceTime(this.options.interaction_interval_ticks, tag);
      await this.authority.completePendingLifecycleWork();

      // Admit the observable factual event and queue its affect work.
      const admitted = await this.authority.admitFactualEvent(interaction.interaction_id, interaction.scene, index);
      this.authority.enqueuePending({
        event_ref: admitted.event_ref,
        observation_transition_id: admitted.observation_transition_id,
        observation_ref: admitted.observation_ref,
        source_event_id: interaction.interaction_id,
        kind: "PRIMARY"
      });

      // Governed observable context + production retrieval.
      const context = await this.authority.commitObservableContext({
        scene: interaction.scene,
        task: interaction.task,
        tag
      });

      const evidenceAudit = await this.authority.resolveWorkingEvidence();

      // ONE production conversation response (pre-cognition Appraisal →
      // cognition → directive → language/clarification).
      this.captureHolder.cognition = null;
      this.captureHolder.language = null;
      const response: SessionResponseResultV0 = await this.authority.respond({
        responseRequestId: `${this.options.session_id}-${tag}`,
        factualEvent: {
          source_event_id: interaction.interaction_id,
          observation_transition_id: admitted.observation_transition_id,
          observation_ref: admitted.observation_ref
        }
      });
      if (response.kind !== "OUTPUT_READY" || response.behavior === null) {
        return await this.fail(base, `conversation response failed (${response.validationStage ?? "UNKNOWN"}): ${response.validationDetail ?? "no detail"}`);
      }
      const behavior = response.behavior;
      const cognitionExchange = this.readCapture("cognition");
      const parsedRaw = cognitionExchange === null ? null : safeParse(cognitionExchange.response);
      const rawRead = parsedRaw === null ? { cognition: null, directive: null } : readRawCognition(parsedRaw);
      const rawCognition = rawRead.cognition;

      // Complete the primary event's AffectApplication (appraisal already ran
      // inside the production response), then deliver.
      const primaryWork = await this.authority.completePendingLifecycleWork();
      const deliveryId = await this.authority.recordDelivery(behavior);

      // Environment consequence: observable behavior + explicit external state only.
      const consequence = this.options.environment.observeBehavior({
        interaction_index: index,
        interaction_id: interaction.interaction_id,
        delivered_behavior_text: behavior.text
      });

      // Linked reply ingress → reply Observation → Experience → durable Memory.
      const reply = await this.authority.recordReply(
        consequence.reply_text,
        deliveryId,
        `${interaction.interaction_id}-reply`,
        index
      );
      const feedback = await this.authority.recordBehaviorOutcomeFeedback({
        sourceEventId: `${interaction.interaction_id}-reply`,
        observationTransitionId: reply.observation_transition_id,
        observationRef: reply.observation_ref
      });

      // Queue and complete the reply event's lawful Appraisal + Affect so the
      // work queue is terminal at every interaction boundary.
      this.authority.enqueuePending({
        event_ref: reply.event_ref,
        observation_transition_id: reply.observation_transition_id,
        observation_ref: reply.observation_ref,
        source_event_id: `${interaction.interaction_id}-reply`,
        kind: "REPLY"
      });
      const replyWork = await this.authority.completePendingLifecycleWork();

      const snapshotAfter = await this.authority.readSnapshot();
      const identity = cognitionExchange === null ? null : await this.requestIdentity(cognitionExchange);
      const traceHash = this.options.provider_identity?.last_trace?.()?.request_hash ?? null;
      const outcome: SessionInteractionOutcomeV0 = {
        schema_version: "subject-session-interaction-v0",
        session_id: base.sessionId,
        subject_id: base.subjectId,
        interaction_index: index,
        interaction_id: interaction.interaction_id,
        scene: interaction.scene,
        task: interaction.task,
        environment_state_hash_before: envBefore.state_hash,
        environment_state_before: envBefore.payload,
        environment_state_hash_after: consequence.state.state_hash,
        environment_state_after: consequence.state.payload,
        logical_time_before: base.logicalTimeBefore,
        logical_time_after: snapshotAfter.runtime_metadata.logical_time as number,
        affect_before: base.affectBefore,
        affect_after: snapshotAfter.affect.valence,
        state_revision_before: base.revisionBefore,
        state_revision_after: snapshotAfter.runtime_metadata.state_revision as number,
        repository_revision_before: base.repositoryBefore,
        repository_revision_after: snapshotAfter.memory_state.repository_revision as string,
        factual_event_ref: admitted.event_ref,
        appraisal_ref: response.cognitionTrace?.factual_appraisal?.appraisal_ref ?? null,
        reply_appraisal_ref: replyWork.at(-1)?.appraisal_ref ?? null,
        retrieved_refs: context.selected_refs,
        working_episode_refs: context.working_episode_refs,
        resolved_evidence_entry_count: evidenceAudit.entry_count,
        resolved_evidence: evidenceAudit.bundle,
        provider_memory_section_present: cognitionExchange !== null && cognitionExchange.request.user_content.includes("[PRIOR FACTUAL MEMORY"),
        provider_memory_section_hash: cognitionExchange === null ? null : await this.memorySectionHash(cognitionExchange.request.user_content),
        provider_request_hash: identity?.request_hash ?? null,
        transport_request_hash: traceHash,
        provider_request_identity_match: identity !== null && traceHash !== null && identity.request_hash === traceHash,
        current_intent: (rawCognition?.["current_intent"] as string | null | undefined) ?? null,
        directive: response.cognitionTrace?.communication_directive_kind ?? null,
        considered_context_refs: rawCognition === null ? null : asRefArray(rawCognition["considered_context_refs"]),
        relevant_memory_refs: rawCognition === null ? null : asRefArray(rawCognition["relevant_memory_refs"]),
        evidence_refs_cited: rawCognition === null ? null : asRefArray(rawCognition["evidence_refs"]),
        reasoning_summary: (rawCognition?.["reasoning_summary"] as string | undefined) ?? null,
        cognition_status: "VALID",
        language_call_required: response.cognitionTrace?.realization_source === "LANGUAGE_PROVIDER_V0",
        language_status: response.cognitionTrace?.realization_source === "LANGUAGE_PROVIDER_V0" ? "VALID" : "NOT_REQUIRED_CLARIFY",
        language_input_hash: response.cognitionTrace?.realization_input_hash ?? null,
        behavior_id: behavior.behavior_id,
        behavior_text: behavior.text,
        behavior_content_hash: await sha256HashV1(behavior.text),
        counterpart_reply: consequence.reply_text,
        delivery_id: deliveryId,
        reply_event_ref: reply.event_ref,
        reply_observation_ref: reply.observation_ref,
        experience_ref: feedback.experience_ref,
        episode_ref: feedback.episode_ref,
        memory_event_ref: feedback.event_ref,
        cognition_latency_ms: 0,
        cognition_total_tokens: null,
        language_total_tokens: null,
        raw_cognition_response: cognitionExchange?.response ?? null,
        raw_language_response: this.readCapture("language")?.response ?? null,
        status: "COMPLETE",
        failure: null
      };
      void primaryWork;
      this.outcomes.push(outcome);
      this.interactionIndex = index + 1;
      return outcome;
    } catch (error) {
      return await this.fail(base, error instanceof Error ? error.message : String(error));
    }
  }

  private async fail(
    base: {
      sessionId: string; subjectId: string; index: number;
      interaction: { interaction_id: string; scene: string; task: string | null };
      envBefore: EnvironmentStateV0; logicalTimeBefore: number; affectBefore: number;
      revisionBefore: number; repositoryBefore: string;
    },
    detail: string
  ): Promise<SessionInteractionOutcomeV0> {
    const snapshot = await this.authority.readSnapshot();
    const outcome: SessionInteractionOutcomeV0 = {
      schema_version: "subject-session-interaction-v0",
      session_id: base.sessionId,
      subject_id: base.subjectId,
      interaction_index: base.index,
      interaction_id: base.interaction.interaction_id,
      scene: base.interaction.scene,
      task: base.interaction.task,
      environment_state_hash_before: base.envBefore.state_hash,
      environment_state_before: base.envBefore.payload,
      environment_state_hash_after: base.envBefore.state_hash,
      environment_state_after: base.envBefore.payload,
      logical_time_before: base.logicalTimeBefore,
      logical_time_after: snapshot.runtime_metadata.logical_time as number,
      affect_before: base.affectBefore,
      affect_after: snapshot.affect.valence,
      state_revision_before: base.revisionBefore,
      state_revision_after: snapshot.runtime_metadata.state_revision as number,
      repository_revision_before: base.repositoryBefore,
      repository_revision_after: snapshot.memory_state.repository_revision as string,
      factual_event_ref: null,
      appraisal_ref: null,
      reply_appraisal_ref: null,
      retrieved_refs: [],
      working_episode_refs: [],
      resolved_evidence_entry_count: 0,
      resolved_evidence: null,
      provider_memory_section_present: false,
      provider_memory_section_hash: null,
      provider_request_hash: null,
      transport_request_hash: null,
      provider_request_identity_match: false,
      current_intent: null,
      directive: null,
      considered_context_refs: null,
      relevant_memory_refs: null,
      evidence_refs_cited: null,
      reasoning_summary: null,
      cognition_status: "NOT_REACHED",
      language_call_required: false,
      language_status: "NOT_REACHED",
      language_input_hash: null,
      behavior_id: null,
      behavior_text: "",
      behavior_content_hash: null,
      counterpart_reply: "",
      delivery_id: "",
      reply_event_ref: "",
      reply_observation_ref: "",
      experience_ref: null,
      episode_ref: null,
      memory_event_ref: null,
      cognition_latency_ms: 0,
      cognition_total_tokens: null,
      language_total_tokens: null,
      raw_cognition_response: null,
      raw_language_response: null,
      status: "FAILED",
      failure: `PARTIAL_INTERACTION_REQUIRES_OPERATOR_RECOVERY: ${detail}`
    };
    this.outcomes.push(outcome);
    return outcome;
  }

  private async memorySectionHash(userContent: string): Promise<string | null> {
    const start = userContent.indexOf("[PRIOR FACTUAL MEMORY");
    if (start < 0) return null;
    const end = userContent.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
    const section = end < 0 ? userContent.slice(start) : userContent.slice(start, end + "[END HISTORICAL FACTUAL CONTENT]".length);
    return hashEnvelope("characteros-next/runtime/session-memory-section-hash/v1", { section });
  }

  private async requestIdentity(exchange: CapturedExchange): Promise<{ readonly request_hash: string } | null> {
    const identity = this.options.provider_identity;
    if (identity === undefined) return null;
    const body = JSON.stringify({
      model: identity.model,
      messages: [
        { role: "system", content: exchange.request.system_content },
        { role: "user", content: exchange.request.user_content }
      ],
      think: false,
      stream: false,
      options: { temperature: 0, num_predict: identity.num_predict }
    });
    return { request_hash: await sha256HashV1(body) };
  }

  /** §17/§43 — durable checkpoint: subject authority + Memory + operational state. */
  async checkpoint(): Promise<SessionCheckpointV0> {
    await this.authority.completePendingLifecycleWork();
    const episodeRefs = this.outcomes.map((outcome) => outcome.episode_ref).filter((ref): ref is string => ref !== null);
    const durable = await this.authority.captureDurableState(episodeRefs);
    const environment = this.options.environment.exportState();
    const createdAt = (this.options.clock ?? (() => new Date().toISOString()))();
    const checkpointRef = await hashEnvelope("characteros-next/runtime/subject-session-checkpoint/v0", {
      session_id: this.options.session_id,
      subject_id: this.options.subject.subject_id,
      next_interaction_index: this.interactionIndex,
      completed_interactions: this.outcomes.length,
      environment_state: environment,
      durable
    });
    const checkpoint: SessionCheckpointV0 = {
      schema_version: "subject-session-checkpoint-v0",
      session_id: this.options.session_id,
      subject_id: this.options.subject.subject_id,
      next_interaction_index: this.interactionIndex,
      completed_interactions: this.outcomes.length,
      environment_state: environment,
      durable,
      created_at: createdAt,
      checkpoint_ref: checkpointRef
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  /** §41/§42 — authoritative restore: rebuild fresh authority + operational state. */
  async restore(checkpoint: SessionCheckpointV0): Promise<SessionRestoreOutcomeV0> {
    const envBefore = this.options.environment.exportState();
    const pre = await this.authority.captureDurableState([]);
    const source = this.authority.durableSource();
    const deliveryLedger = new InMemoryConversationDeliveryLedger();
    const deliveryRestore = await (deliveryLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }).restoreState(checkpoint.durable.delivery_ledger_state);
    const ingressLedger = new InMemoryConversationIngressLedger();
    const ingressRestore = await (ingressLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }).restoreState(checkpoint.durable.ingress_ledger_state);
    if (!deliveryRestore.ok || !ingressRestore.ok) {
      const failed: SessionRestoreOutcomeV0 = {
        kind: "FAILED",
        checkpoint_ref: checkpoint.checkpoint_ref,
        restore_generation: this.restores.length + 1,
        next_interaction_index: this.interactionIndex,
        pre: pre.identity,
        post: pre.identity,
        environment_state_hash_pre: envBefore.state_hash,
        environment_state_hash_post: envBefore.state_hash,
        identity_classification: "FAILURE",
        detail: `ledger restore failed (delivery=${deliveryRestore.ok}, ingress=${ingressRestore.ok})`
      };
      this.restores.push(failed);
      return failed;
    }
    let rebuilt: Awaited<ReturnType<typeof ExplicitV4SessionAuthorityV0.restoreFromDurableState>>;
    try {
      rebuilt = await ExplicitV4SessionAuthorityV0.restoreFromDurableState(
        {
          ...this.options,
          // Keep observing the SAME recording transports after restore.
          conversationCognitionTransport: this.wrappedTransports?.cognition ?? this.options.conversationCognitionTransport,
          languageTransport: this.wrappedTransports?.language ?? this.options.languageTransport,
          deliveryLedger,
          ingressLedger
        },
        checkpoint.durable,
        source
      );
    } catch (error) {
      const failed: SessionRestoreOutcomeV0 = {
        kind: "FAILED",
        checkpoint_ref: checkpoint.checkpoint_ref,
        restore_generation: this.restores.length + 1,
        next_interaction_index: this.interactionIndex,
        pre: pre.identity,
        post: pre.identity,
        environment_state_hash_pre: envBefore.state_hash,
        environment_state_hash_post: envBefore.state_hash,
        identity_classification: "FAILURE",
        detail: error instanceof Error ? error.message : String(error)
      };
      this.restores.push(failed);
      return failed;
    }
    rebuilt.authority.setSubjectId(this.options.subject.subject_id);
    this.authority = rebuilt.authority;
    this.options.environment.restoreState(checkpoint.environment_state);
    this.interactionIndex = checkpoint.next_interaction_index;
    const post = await this.authority.captureDurableState([]);
    const envAfter = this.options.environment.exportState();
    const classification = post.identity.subject_state_hash === checkpoint.durable.identity.subject_state_hash &&
      post.identity.repository_revision === checkpoint.durable.identity.repository_revision &&
      post.identity.subject_head.commit_ref === checkpoint.durable.identity.subject_head.commit_ref
      ? "EXACT"
      : "EXPECTED_RECONSTRUCTED_IDENTITY";
    const outcome: SessionRestoreOutcomeV0 = {
      kind: "RESTORED",
      checkpoint_ref: checkpoint.checkpoint_ref,
      restore_generation: this.restores.length + 1,
      next_interaction_index: this.interactionIndex,
      pre: pre.identity,
      post: post.identity,
      environment_state_hash_pre: envBefore.state_hash,
      environment_state_hash_post: envAfter.state_hash,
      identity_classification: classification,
      detail: rebuilt.detail
    };
    this.restores.push(outcome);
    return outcome;
  }

  async status(): Promise<SubjectSessionStatusV0> {
    const snapshot = await this.authority.readSnapshot();
    const latest = this.outcomes.at(-1) ?? null;
    return {
      schema_version: "subject-session-status-v0",
      session_id: this.options.session_id,
      subject_id: this.options.subject.subject_id,
      environment_id: this.options.environment.environment_id,
      interaction_index: this.interactionIndex,
      completed_interactions: this.outcomes.filter((outcome) => outcome.status === "COMPLETE").length,
      interaction_count: this.options.environment.interaction_count,
      logical_time: snapshot.runtime_metadata.logical_time as number,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      repository_revision: snapshot.memory_state.repository_revision as string,
      subject_state_hash: await hashEnvelope("characteros-next/runtime/session-subject-state-hash/v1", snapshot as never),
      affect: { valence: snapshot.affect.valence, activation: snapshot.affect.activation },
      latest_current_intent: latest === null ? null : latest.current_intent,
      latest_directive: latest === null ? null : latest.directive,
      latest_behavior: latest === null ? null : latest.behavior_text,
      latest_retrieved_memory_refs: latest === null ? [] : [...latest.working_episode_refs],
      latest_provider_request_identity_match: latest === null ? null : latest.provider_request_identity_match,
      pending_lifecycle_work: this.authority.pendingWork().length,
      checkpoint_count: this.checkpoints.length,
      restore_generation: this.restores.length,
      last_checkpoint_ref: this.checkpoints.at(-1)?.checkpoint_ref ?? null,
      last_restore_identity_classification: this.restores.at(-1)?.identity_classification ?? null
    };
  }

  ledger(): readonly SessionInteractionOutcomeV0[] {
    return [...this.outcomes];
  }

  pendingWork(): readonly PendingLifecycleWorkV0[] {
    return this.authority.pendingWork();
  }

  restoreOutcomes(): readonly SessionRestoreOutcomeV0[] {
    return [...this.restores];
  }
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function createLongHorizonSubjectSessionV0(
  options: LongHorizonSubjectSessionOptionsV0
): Promise<LongHorizonSubjectSessionV0> {
  return LongHorizonSubjectSessionV0.create(options);
}
