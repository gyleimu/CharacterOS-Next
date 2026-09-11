/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — turn-based persistent subject
 * runtime.
 *
 * WHY A SECOND ORCHESTRATOR: the frozen `LongHorizonSubjectSessionV0` obtains
 * the counterpart reply inside ONE environment-driven `processInteraction()`
 * call. A real interactive host cannot: the counterpart reply to the subject's
 * delivered behavior is the user's NEXT message, which does not exist yet when
 * the behavior is delivered. The existing feedback authority (BEHAVIOR_
 * EXPERIENCE_FEEDBACK_V0) requires a reply ingress explicitly linked to a
 * DELIVERED parent (`in_reply_to_delivery_id`) before Experience/Memory can be
 * committed — there is no delivery-receipt-only path. So this runtime keeps ONE
 * deferred delivery and, on the next user turn, records that user text as the
 * counterpart reply FIRST (closing the previous turn's Experience/Memory
 * lawfully), then admits the same text as the new primary factual event.
 *
 * Nothing is faked: no synthetic reply text, no neutral feedback, no manual
 * memory refs, no transcript. A turn that has been delivered but not yet
 * answered simply has its outcome Experience still pending — a truthful state,
 * surfaced in status and durably resumed after a restart.
 *
 * This class sequences ONLY the frozen authorities. It owns no Memory, Affect,
 * Belief, Relationship, cognition or language semantics.
 */

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { sha256HashV1, validateSubjectState } from "@characteros-next/subject-core";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import type { ModelTransportV0 } from "../transports/model-transport.js";
import type { ModelTransportTraceV0 } from "../transports/model-transport-trace-v0.js";
import { InMemoryConversationDeliveryLedger } from "../transitions/conversation/behavior-delivery-ledger.js";
import { InMemoryConversationIngressLedger } from "../transitions/conversation/conversation-ingress-ledger.js";
import { s0 } from "../transitions/observation/observation-fixtures.js";
import {
  buildGenesisPersonalityFromPriorV0,
  type PersonalityGenesisPriorV0
} from "../transitions/personality/index.js";
import type { PendingLifecycleWorkV0, SessionDurableStateV0 } from "./session-contracts-v0.js";
import type { BeliefAdaptationTurnReportV0 } from "./belief-adaptation-wiring-v0.js";
import {
  ExplicitV4SessionAuthorityV0,
  type ExplicitV4SessionAuthorityOptionsV0,
  type LivedMemoryInspectionV0,
  type SessionResponseResultV0
} from "./explicit-v4-session-authority-v0.js";
import {
  captureSessionStoreImageV0,
  rebuildSessionStoreSourceV0,
  type SessionStoreImageV0
} from "./session-store-image-v0.js";

export interface InteractiveSubjectRuntimeOptionsV0 extends ExplicitV4SessionAuthorityOptionsV0 {
  readonly session_id: string;
  /** Lawful interval ticks between consecutive user turns. */
  readonly interval_ticks?: number;
  /** Provider request identity inputs (enables the identity audit). */
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly context_window_tokens?: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  readonly clock?: () => string;
}

/** The deferred counterpart: the delivered behavior awaiting the user's next message. */
export interface PendingBehaviorOutcomeV0 {
  readonly delivery_id: string;
  readonly turn_index: number;
  readonly turn_source_id: string;
}

/** One user turn's full observable/durable trace (observational, not authority). */
export interface InteractiveTurnOutcomeV0 {
  readonly schema_version: "interactive-subject-turn-v0";
  readonly session_id: string;
  readonly subject_id: string;
  readonly turn_index: number;
  readonly user_text: string;
  readonly status: "COMPLETE" | "FAILED";
  readonly failure: string | null;
  /** LanguageRealization output — the ONLY user-visible reply. */
  readonly subject_text: string;
  readonly behavior_id: string | null;
  readonly delivery_id: string | null;
  readonly directive: string | null;
  readonly current_intent: string | null;
  readonly language_call_required: boolean;
  readonly language_status: string;
  /** Feedback committed for the PREVIOUS turn's delivered behavior on this turn. */
  readonly completed_prior_outcome: {
    readonly turn_index: number;
    readonly experience_ref: string;
    readonly episode_ref: string;
    readonly memory_event_ref: string;
  } | null;
  /**
   * BELIEF_ADAPTATION_SESSION_WIRING_V0 — observable report of offering this
   * turn's newly committed lived evidence to the frozen belief plasticity
   * chain (runs AFTER this turn's cognition; a changed Belief reaches only
   * FUTURE turns). Null when the step was never reached (turn failure earlier
   * in the lifecycle). A failure here NEVER fails the turn: belief remains
   * unchanged (§55/§65 fail-closed).
   */
  readonly belief_adaptation: BeliefAdaptationTurnReportV0 | null;
  /**
   * Observation-sourced episode ref when THIS user event had no behavior-outcome
   * role (e.g. a new subject's first message) and was admitted through the
   * generic Learning path. Null when the event was admitted as a behavior outcome.
   */
  readonly observational_experience_ref: string | null;
  readonly retrieved_refs: readonly string[];
  readonly working_episode_refs: readonly string[];
  readonly resolved_evidence_entry_count: number;
  readonly provider_memory_section_present: boolean;
  readonly provider_request_hash: string | null;
  readonly transport_request_hash: string | null;
  readonly provider_request_identity_match: boolean;
  readonly provider_terminal_trace: ModelTransportTraceV0 | null;
  readonly logical_time_before: number;
  readonly logical_time_after: number;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly affect_before: number;
  readonly affect_after: number;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  /** Operator/debug only — never displayed as conversation. */
  readonly raw_cognition_response: string | null;
  readonly raw_language_response: string | null;
}

/** Serializable operational + durable snapshot sufficient for a REAL restart. */
export interface InteractiveSubjectSnapshotV0 {
  readonly schema_version: "interactive-subject-snapshot-v0";
  readonly session_id: string;
  readonly subject_id: string;
  readonly subject: {
    readonly subject_id: string;
    readonly display_name: string;
    readonly identity_anchors: readonly string[];
  };
  readonly next_turn_index: number;
  readonly pending_behavior_outcome: PendingBehaviorOutcomeV0 | null;
  readonly durable: SessionDurableStateV0;
  readonly store: SessionStoreImageV0;
  readonly saved_at: string;
}

/** Read-only operator status projection. No authority token, no capability. */
export interface InteractiveSubjectStatusV0 {
  readonly schema_version: "interactive-subject-status-v0";
  readonly session_id: string;
  readonly subject_id: string;
  readonly origin: "NEW_SUBJECT" | "SUBJECT_RESTORED";
  readonly turn_index: number;
  readonly completed_turns: number;
  readonly pending_behavior_outcome: boolean;
  readonly logical_time: number;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly pending_lifecycle_work: number;
}

interface CapturedExchange {
  readonly request: { readonly system_content: string; readonly user_content: string };
  readonly response: string;
}

/**
 * The observable conversational task context for a product turn. The frozen
 * pre-cognition Appraisal law requires a non-null CURRENT_TASK to be eligible
 * for AffectApplication; an open conversation's task is to respond to the
 * user's latest message. This is host-supplied observable context, not subject
 * behavior, Affect, intent or wording.
 */
const CONVERSATIONAL_TASK_V0 = "Respond to the user's latest message.";

/**
 * The observable situation for one turn. The user's exact words are quoted as
 * the observed utterance (third-person framing), so the subject responds to a
 * situation rather than treating its own input as the thing to realize.
 */
function conversationalSceneV0(text: string): string {
  return `The user says: "${text}"`;
}

function recordingTransport(
  target: ModelTransportV0,
  sink: (exchange: CapturedExchange) => void
): ModelTransportV0 {
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

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readCurrentIntent(parsed: Record<string, unknown> | null): string | null {
  if (parsed === null) return null;
  const cognition = parsed["cognition"] as { current_intent?: string | null } | undefined;
  return cognition?.current_intent ?? null;
}

/**
 * The smallest lawful default v3 source for a product subject: the canonical
 * reference v3 subject state with ONLY the identity fields set to the requested
 * subject.
 *
 * PERSONALITY_GENESIS_PRIOR_ADMISSION_V0: when an explicit, validated
 * `personalityGenesisPrior` is supplied, genesis admits it as P0 —
 * `traits_seed = canonical P0` (immutable) and `personality(t=0) = P0` (mutable
 * copy). When it is omitted, genesis stays honestly empty:
 * `traits_seed = { dimensions: {} }`, `personality = { dimensions: [] }`. There
 * is no default value, no 0.5 fallback, no randomness, and no model inference.
 * The prior is creation-time authority only: it is never consulted by restore.
 * No Memory/Experience/Belief/Relationship is created here.
 */
export function createInteractiveSubjectSeedV0(
  subjectId: string,
  displayName = "",
  identityAnchors: readonly string[] = [],
  personalityGenesisPrior?: PersonalityGenesisPriorV0
): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  const identity = { ...(base["identity"] as Record<string, unknown>) };
  // Fail-closed before any state is built: an invalid prior creates no subject.
  const genesisPersonality =
    personalityGenesisPrior === undefined
      ? null
      : buildGenesisPersonalityFromPriorV0(personalityGenesisPrior);
  const raw = {
    ...base,
    identity: {
      ...identity,
      subject_id: subjectId,
      display_name: displayName,
      identity_anchors: [...identityAnchors]
    },
    ...(genesisPersonality === null
      ? {}
      : {
          traits_seed: genesisPersonality.traits_seed,
          personality: genesisPersonality.personality
        })
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) {
    throw new Error(`interactive subject seed invalid: ${checked.error?.detail ?? "unknown"}`);
  }
  return checked.value;
}

export class InteractiveSubjectRuntimeV0 {
  private readonly authority: ExplicitV4SessionAuthorityV0;
  private readonly options: InteractiveSubjectRuntimeOptionsV0;
  private turnIndex: number;
  private pendingBehaviorOutcome: PendingBehaviorOutcomeV0 | null;
  private readonly origin: "NEW_SUBJECT" | "SUBJECT_RESTORED";
  private readonly outcomes: InteractiveTurnOutcomeV0[] = [];
  private completedTurns = 0;
  private captureHolder: { cognition: CapturedExchange | null; language: CapturedExchange | null } = {
    cognition: null,
    language: null
  };
  private readonly wrappedTransports: { cognition: ModelTransportV0; language: ModelTransportV0 };

  private constructor(input: {
    authority: ExplicitV4SessionAuthorityV0;
    options: InteractiveSubjectRuntimeOptionsV0;
    turnIndex: number;
    pendingBehaviorOutcome: PendingBehaviorOutcomeV0 | null;
    origin: "NEW_SUBJECT" | "SUBJECT_RESTORED";
    completedTurns: number;
    wrappedTransports: { cognition: ModelTransportV0; language: ModelTransportV0 };
    holder: { cognition: CapturedExchange | null; language: CapturedExchange | null };
  }) {
    this.authority = input.authority;
    this.options = input.options;
    this.turnIndex = input.turnIndex;
    this.pendingBehaviorOutcome = input.pendingBehaviorOutcome;
    this.origin = input.origin;
    this.completedTurns = input.completedTurns;
    this.wrappedTransports = input.wrappedTransports;
    this.captureHolder = input.holder;
  }

  /** Fresh subject: explicit-v4 genesis through the existing production factory. */
  static async create(options: InteractiveSubjectRuntimeOptionsV0): Promise<InteractiveSubjectRuntimeV0> {
    const holder: { cognition: CapturedExchange | null; language: CapturedExchange | null } = { cognition: null, language: null };
    const cognition = recordingTransport(options.conversationCognitionTransport, (exchange) => {
      holder.cognition = exchange;
    });
    const language = recordingTransport(options.languageTransport, (exchange) => {
      holder.language = exchange;
    });
    const authority = await ExplicitV4SessionAuthorityV0.createFresh({
      ...options,
      conversationCognitionTransport: cognition,
      languageTransport: language
    });
    authority.setSubjectId(options.subject.subject_id);
    return new InteractiveSubjectRuntimeV0({
      authority,
      options,
      turnIndex: 0,
      pendingBehaviorOutcome: null,
      origin: "NEW_SUBJECT",
      completedTurns: 0,
      wrappedTransports: { cognition, language },
      holder
    });
  }

  /** Real restart: rebuild durable ledgers + store from the snapshot, then
   * authoritative restore. Never silently creates a new subject. */
  static async restore(
    options: InteractiveSubjectRuntimeOptionsV0,
    snapshot: InteractiveSubjectSnapshotV0
  ): Promise<InteractiveSubjectRuntimeV0> {
    if (snapshot.schema_version !== "interactive-subject-snapshot-v0") {
      throw new Error("interactive subject restore: unsupported snapshot schema");
    }
    if (snapshot.subject_id !== options.subject.subject_id) {
      throw new Error(
        `interactive subject restore: snapshot subject ${snapshot.subject_id} != configured subject ${options.subject.subject_id}`
      );
    }
    const deliveryLedger = new InMemoryConversationDeliveryLedger();
    const deliveryRestore = await (
      deliveryLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }
    ).restoreState(snapshot.durable.delivery_ledger_state);
    const ingressLedger = new InMemoryConversationIngressLedger();
    const ingressRestore = await (
      ingressLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }
    ).restoreState(snapshot.durable.ingress_ledger_state);
    if (!deliveryRestore.ok || !ingressRestore.ok) {
      throw new Error(
        `interactive subject restore: ledger restore failed (delivery=${deliveryRestore.ok}, ingress=${ingressRestore.ok})`
      );
    }
    const source = await rebuildSessionStoreSourceV0(snapshot.store);
    const holder: { cognition: CapturedExchange | null; language: CapturedExchange | null } = { cognition: null, language: null };
    const cognition = recordingTransport(options.conversationCognitionTransport, (exchange) => {
      holder.cognition = exchange;
    });
    const language = recordingTransport(options.languageTransport, (exchange) => {
      holder.language = exchange;
    });
    const rebuilt = await ExplicitV4SessionAuthorityV0.restoreFromDurableState(
      {
        ...options,
        conversationCognitionTransport: cognition,
        languageTransport: language,
        deliveryLedger,
        ingressLedger
      },
      snapshot.durable,
      source
    );
    rebuilt.authority.setSubjectId(options.subject.subject_id);
    return new InteractiveSubjectRuntimeV0({
      authority: rebuilt.authority,
      options,
      turnIndex: snapshot.next_turn_index,
      pendingBehaviorOutcome: snapshot.pending_behavior_outcome,
      origin: "SUBJECT_RESTORED",
      completedTurns: snapshot.next_turn_index,
      wrappedTransports: { cognition, language },
      holder
    });
  }

  subjectId(): string {
    return this.options.subject.subject_id;
  }

  sessionId(): string {
    return this.options.session_id;
  }

  originClass(): "NEW_SUBJECT" | "SUBJECT_RESTORED" {
    return this.origin;
  }

  currentTurnIndex(): number {
    return this.turnIndex;
  }

  hasPendingBehaviorOutcome(): boolean {
    return this.pendingBehaviorOutcome !== null;
  }

  pendingWork(): readonly PendingLifecycleWorkV0[] {
    return this.authority.pendingWork();
  }

  ledger(): readonly InteractiveTurnOutcomeV0[] {
    return [...this.outcomes];
  }

  /** §14/§38 — one user turn, serialized by the host.
   *
   * ORDER MATTERS: the user text is admitted and answered BEFORE it is recorded
   * as the counterpart reply to the previous delivery. If the reply ingress were
   * recorded first, this turn's own message would already be a committed memory
   * episode when production retrieval runs, and the subject could treat its own
   * input as recalled content. Recording prior feedback after the response keeps
   * the retrieval boundary purely about PRIOR lived history. */
  async submitUserText(text: string): Promise<InteractiveTurnOutcomeV0> {
    const index = this.turnIndex;
    const tag = `t${index}`;
    const sourceEventId = `turn-${index}`;
    const snapshotBefore = await this.authority.readSnapshot();
    const pending = this.pendingBehaviorOutcome;
    let completedPriorOutcome: InteractiveTurnOutcomeV0["completed_prior_outcome"] = null;
    let observationalExperienceRef: string | null = null;
    let beliefAdaptation: BeliefAdaptationTurnReportV0 | null = null;

    try {
      await this.authority.advanceTime(this.options.interval_ticks ?? 1, tag);
      await this.authority.completePendingLifecycleWork();

      // ---- this user message as the new primary factual event
      const observableSituation = { scene: conversationalSceneV0(text), task: CONVERSATIONAL_TASK_V0 };
      const admitted = await this.authority.admitFactualEvent(sourceEventId, text, index, observableSituation);
      this.authority.enqueuePending({
        event_ref: admitted.event_ref,
        observation_transition_id: admitted.observation_transition_id,
        observation_ref: admitted.observation_ref,
        source_event_id: sourceEventId,
        kind: "PRIMARY"
      });
      const context = await this.authority.commitObservableContext({ scene: conversationalSceneV0(text), task: CONVERSATIONAL_TASK_V0, tag });
      const evidence = await this.authority.resolveWorkingEvidence();

      this.captureHolder.cognition = null;
      this.captureHolder.language = null;
      const response: SessionResponseResultV0 = await this.authority.respond({
        responseRequestId: `${this.options.session_id}-${tag}`,
        factualEvent: {
          source_event_id: sourceEventId,
          observation_transition_id: admitted.observation_transition_id,
          observation_ref: admitted.observation_ref
        }
      });
      if (response.kind !== "OUTPUT_READY" || response.behavior === null) {
        throw new Error(
          `cognition/language path failed (${response.validationStage ?? "UNKNOWN"}): ${response.validationDetail ?? "no detail"}`
        );
      }
      const behavior: CharacterLanguageBehaviorV0 = response.behavior;

      await this.authority.completePendingLifecycleWork();
      const deliveryId = await this.authority.recordDelivery(behavior);

      // ---- Memory admission: the user event is admitted exactly ONCE.
      // If it answers a prior delivered behavior, the existing behavior-outcome
      // feedback path records that two-sided interaction (and thereby the user
      // text). Otherwise — e.g. a brand-new subject's first message, which has
      // no behavior parent — the SAME committed Observation is admitted as an
      // observation-sourced Experience through the existing generic Learning
      // path. Both run AFTER this turn's cognition, so the event never enters
      // its own retrieval context.
      if (pending === null) {
        const observational = await this.authority.recordObservationalExperience({
          observationTransitionId: admitted.observation_transition_id,
          declaredSalience: 0.5
        });
        observationalExperienceRef = observational.episode_ref;
      } else {
        const replySourceId = `${pending.turn_source_id}-reply`;
        const reply = await this.authority.recordReply(text, pending.delivery_id, replySourceId, pending.turn_index);
        this.authority.enqueuePending({
          event_ref: reply.event_ref,
          observation_transition_id: reply.observation_transition_id,
          observation_ref: reply.observation_ref,
          source_event_id: replySourceId,
          kind: "REPLY"
        });
        const feedback = await this.authority.recordBehaviorOutcomeFeedback({
          sourceEventId: replySourceId,
          observationTransitionId: reply.observation_transition_id,
          observationRef: reply.observation_ref
        });
        await this.authority.completePendingLifecycleWork();
        completedPriorOutcome = {
          turn_index: pending.turn_index,
          experience_ref: feedback.experience_ref,
          episode_ref: feedback.episode_ref,
          memory_event_ref: feedback.event_ref
        };
      }

      this.pendingBehaviorOutcome = {
        delivery_id: deliveryId,
        turn_index: index,
        turn_source_id: sourceEventId
      };
      this.turnIndex = index + 1;
      this.completedTurns += 1;

      // ---- BELIEF_ADAPTATION_SESSION_WIRING_V0: the turn's newly committed
      // lived evidence is offered to the frozen belief plasticity chain AFTER
      // this turn's cognition and after turn bookkeeping, so a belief-path
      // failure can never corrupt the completed canonical turn (§65: belief
      // remains unchanged, fail closed). §31 same-turn isolation: the changed
      // Belief reaches only FUTURE turns' cognition, never the cognition that
      // already responded to this event.
      const beliefEpisodeRefs =
        completedPriorOutcome !== null
          ? [completedPriorOutcome.episode_ref]
          : observationalExperienceRef !== null
            ? [observationalExperienceRef]
            : [];
      beliefAdaptation =
        beliefEpisodeRefs.length > 0
          ? await this.authority.runLivedEvidenceBeliefAdaptation(beliefEpisodeRefs)
          : { status: "EVIDENCE_UNAVAILABLE", resumed: [], current: null, failure: "no lived episode committed this turn" };

      const snapshotAfter = await this.authority.readSnapshot();
      const cognitionExchange = this.readCapture("cognition");
      const parsedRaw = cognitionExchange === null ? null : safeParse(cognitionExchange.response);
      const identity = cognitionExchange === null ? null : await this.requestIdentity(cognitionExchange);
      const terminalTrace = this.options.provider_identity?.last_trace?.() ?? null;
      const traceHash = terminalTrace?.request_hash ?? null;
      const outcome: InteractiveTurnOutcomeV0 = {
        schema_version: "interactive-subject-turn-v0",
        session_id: this.options.session_id,
        subject_id: this.options.subject.subject_id,
        turn_index: index,
        user_text: text,
        status: "COMPLETE",
        failure: null,
        subject_text: behavior.text,
        behavior_id: behavior.behavior_id,
        delivery_id: deliveryId,
        directive: response.cognitionTrace?.communication_directive_kind ?? null,
        current_intent: readCurrentIntent(parsedRaw),
        language_call_required: response.cognitionTrace?.realization_source === "LANGUAGE_PROVIDER_V0",
        language_status: response.cognitionTrace?.realization_source === "LANGUAGE_PROVIDER_V0" ? "VALID" : "NOT_REQUIRED_CLARIFY",
        completed_prior_outcome: completedPriorOutcome,
        belief_adaptation: beliefAdaptation,
        observational_experience_ref: observationalExperienceRef,
        retrieved_refs: context.selected_refs,
        working_episode_refs: context.working_episode_refs,
        resolved_evidence_entry_count: evidence.entry_count,
        provider_memory_section_present:
          cognitionExchange !== null && cognitionExchange.request.user_content.includes("[PRIOR FACTUAL MEMORY"),
        provider_request_hash: identity?.request_hash ?? null,
        transport_request_hash: traceHash,
        provider_request_identity_match: identity !== null && traceHash !== null && identity.request_hash === traceHash,
        provider_terminal_trace: terminalTrace,
        logical_time_before: snapshotBefore.runtime_metadata.logical_time as number,
        logical_time_after: snapshotAfter.runtime_metadata.logical_time as number,
        state_revision_before: snapshotBefore.runtime_metadata.state_revision as number,
        state_revision_after: snapshotAfter.runtime_metadata.state_revision as number,
        affect_before: snapshotBefore.affect.valence,
        affect_after: snapshotAfter.affect.valence,
        repository_revision_before: snapshotBefore.memory_state.repository_revision as string,
        repository_revision_after: snapshotAfter.memory_state.repository_revision as string,
        raw_cognition_response: cognitionExchange?.response ?? null,
        raw_language_response: this.readCapture("language")?.response ?? null
      };
      this.outcomes.push(outcome);
      return outcome;
    } catch (error) {
      // Fail closed: no index advance, no fabricated delivery. The host must
      // surface this and stop, or restore the last durable snapshot.
      const snapshotAfter = await this.authority.readSnapshot();
      const failure = error instanceof Error ? error.message : String(error);
      const outcome: InteractiveTurnOutcomeV0 = {
        schema_version: "interactive-subject-turn-v0",
        session_id: this.options.session_id,
        subject_id: this.options.subject.subject_id,
        turn_index: index,
        user_text: text,
        status: "FAILED",
        failure: `TURN_FAILED_CLOSED: ${failure}`,
        subject_text: "",
        behavior_id: null,
        delivery_id: null,
        directive: null,
        current_intent: null,
        language_call_required: false,
        language_status: "NOT_REACHED",
        completed_prior_outcome: completedPriorOutcome,
        belief_adaptation: beliefAdaptation,
        observational_experience_ref: null,
        retrieved_refs: [],
        working_episode_refs: [],
        resolved_evidence_entry_count: 0,
        provider_memory_section_present: false,
        provider_request_hash: null,
        transport_request_hash: null,
        provider_request_identity_match: false,
        provider_terminal_trace: this.options.provider_identity?.last_trace?.() ?? null,
        logical_time_before: snapshotBefore.runtime_metadata.logical_time as number,
        logical_time_after: snapshotAfter.runtime_metadata.logical_time as number,
        state_revision_before: snapshotBefore.runtime_metadata.state_revision as number,
        state_revision_after: snapshotAfter.runtime_metadata.state_revision as number,
        affect_before: snapshotBefore.affect.valence,
        affect_after: snapshotAfter.affect.valence,
        repository_revision_before: snapshotBefore.memory_state.repository_revision as string,
        repository_revision_after: snapshotAfter.memory_state.repository_revision as string,
        raw_cognition_response: this.readCapture("cognition")?.response ?? null,
        raw_language_response: this.readCapture("language")?.response ?? null
      };
      this.outcomes.push(outcome);
      return outcome;
    }
  }

  /** §39 — durable snapshot for a REAL restart (operational + durable state). */
  async snapshot(): Promise<InteractiveSubjectSnapshotV0> {
    await this.authority.completePendingLifecycleWork();
    const durable = await this.authority.captureDurableState([]);
    const store = await captureSessionStoreImageV0(this.authority.durableSource());
    return {
      schema_version: "interactive-subject-snapshot-v0",
      session_id: this.options.session_id,
      subject_id: this.options.subject.subject_id,
      subject: {
        subject_id: this.options.subject.subject_id,
        display_name: this.options.subject.display_name,
        identity_anchors: [...this.options.subject.identity_anchors]
      },
      next_turn_index: this.turnIndex,
      pending_behavior_outcome: this.pendingBehaviorOutcome,
      durable,
      store,
      saved_at: (this.options.clock ?? (() => new Date().toISOString()))()
    };
  }

  /**
   * INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0 — read-only factual projection of
   * durable lived episodes. Causes no subject-state change and no provider call.
   */
  async livedMemory(input?: { readonly limit?: number }): Promise<LivedMemoryInspectionV0> {
    return this.authority.readLivedMemoryV0(input);
  }

  async status(): Promise<InteractiveSubjectStatusV0> {
    const snapshot = await this.authority.readSnapshot();
    return {
      schema_version: "interactive-subject-status-v0",
      session_id: this.options.session_id,
      subject_id: this.options.subject.subject_id,
      origin: this.origin,
      turn_index: this.turnIndex,
      completed_turns: this.completedTurns,
      pending_behavior_outcome: this.pendingBehaviorOutcome !== null,
      logical_time: snapshot.runtime_metadata.logical_time as number,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      repository_revision: snapshot.memory_state.repository_revision as string,
      affect: { valence: snapshot.affect.valence, activation: snapshot.affect.activation },
      pending_lifecycle_work: this.authority.pendingWork().length
    };
  }

  /** Non-narrowing read of the last captured exchange (method call avoids CFA narrowing). */
  private readCapture(kind: "cognition" | "language"): CapturedExchange | null {
    return kind === "cognition" ? this.captureHolder.cognition : this.captureHolder.language;
  }

  private async requestIdentity(exchange: CapturedExchange): Promise<{ readonly request_hash: string } | null> {    const identity = this.options.provider_identity;
    if (identity === undefined) return null;
    const options: Record<string, number> = { temperature: 0, num_predict: identity.num_predict };
    if (identity.context_window_tokens !== undefined) {
      options["num_ctx"] = identity.context_window_tokens;
    }
    const body = JSON.stringify({
      model: identity.model,
      messages: [
        { role: "system", content: exchange.request.system_content },
        { role: "user", content: exchange.request.user_content }
      ],
      think: false,
      stream: false,
      options
    });
    return { request_hash: await sha256HashV1(body) };
  }
}

export async function createInteractiveSubjectRuntimeV0(
  options: InteractiveSubjectRuntimeOptionsV0
): Promise<InteractiveSubjectRuntimeV0> {
  return InteractiveSubjectRuntimeV0.create(options);
}
