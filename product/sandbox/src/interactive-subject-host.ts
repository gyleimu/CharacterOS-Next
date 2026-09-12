/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product host.
 *
 * Thin product adapter over the existing production runtime. The host:
 *   - resolves ONE persistent subject (create on first launch, authoritative
 *     restore when durable history exists, fail closed on unreadable history);
 *   - accepts natural-language user text as the only input boundary;
 *   - invokes the production runtime for one serialized turn;
 *   - persists the durable snapshot after every completed turn.
 *
 * It never chooses Memory refs, sets Affect/beliefs/relationship, writes
 * current_intent, selects a directive, authors behavior, writes Memory or
 * fabricates Experience.
 */

import type {
  FactualEventAppraisalProviderV0,
  InteractiveSubjectRuntimeOptionsV0,
  InteractiveSubjectSnapshotV0,
  InteractiveSubjectStatusV0,
  InteractiveSubjectStateViewV0,
  InteractiveTurnOutcomeV0,
  LivedMemoryInspectionV0,
  BeliefSemanticTargetResolutionProviderV0,
  ModelTransportTraceV0,
  ModelTransportV0,
  PersonalityAdaptationFactoryV0,
  PersonalityGenesisPriorV0,
  RelationshipInteractionQualifyingAdmissionProviderV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0
} from "@characteros-next/runtime";
import {
  InMemoryPersonalityAdaptationStoreV0,
  PersonalityAdaptationWiringV0,
  type PersonalitySemanticChannelProviderV0
} from "@characteros-next/personality";
import type { InteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import { FileInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import {
  persistCanonicalSubjectV0,
  resolveCanonicalSubjectV0,
  type SharedSubjectSourceStoreV0
} from "./cross-context-canonical.js";

export interface InteractiveSubjectHostConfigV0 {
  readonly subject_id: string;
  /** Canonical human-visible identity field (never used for storage paths). */
  readonly display_name: string;
  /** Canonical identity anchors (V0: empty). */
  readonly identity_anchors?: readonly string[];
  readonly session_id: string;
  /** Deterministic local directory holding durable subject data. */
  readonly storage_root: string;
  readonly interval_ticks?: number;
  /**
   * PERSONALITY_GENESIS_PRIOR_ADMISSION_V0 — explicit authoring of this
   * character's starting Personality P0. Creation-only: it is consulted ONLY
   * when no durable subject exists. On restore, canonical stored state always
   * wins and this input is never applied. Omitted ⇒ honest empty genesis.
   */
  readonly personality_genesis_prior?: PersonalityGenesisPriorV0;
}

export interface InteractiveSubjectHostDepsV0 {
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly appraisalProvider: FactualEventAppraisalProviderV0;
  /**
   * BELIEF_ADAPTATION_SESSION_WIRING_V0: the belief semantic bearing provider
   * (e.g. OllamaBeliefSemanticProviderV0). Omitted ⇒ belief adaptation stays
   * DISABLED: lived evidence is never offered to belief plasticity, no belief
   * provider calls occur.
   */
  readonly beliefSemanticProvider?: BeliefSemanticTargetResolutionProviderV0;
  /**
   * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0: the personality semantic
   * bearing provider. Omitted ⇒ personality adaptation stays DISABLED: lived
   * evidence is never offered to personality plasticity, no provider calls occur.
   */
  readonly personalitySemanticProvider?: PersonalitySemanticChannelProviderV0;
  /**
   * RELATIONSHIP_LIVED_DEVELOPMENT_V0: the qualifying-interaction admission
   * provider for the FROZEN familiarity chain (e.g.
   * ModelRelationshipFamiliarityQualifyingAdmissionProviderV0 over the existing
   * cognition transport). Omitted ⇒ relationship familiarity stays DISABLED.
   */
  readonly relationshipFamiliarityAdmissionProvider?: RelationshipInteractionQualifyingAdmissionProviderV0;
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly context_window_tokens?: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  /** Override for tests; defaults to the file-backed store under storage_root. */
  readonly snapshotStore?: InteractiveSnapshotStoreV0;
  /**
   * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — when supplied, canonical subject
   * state is read from and written to this ONE shared source; the interactive
   * snapshot becomes a human-context sidecar (turn bookkeeping) whose embedded
   * canonical copy is no longer authoritative.
   */
  readonly sharedSourceStore?: SharedSubjectSourceStoreV0;
  /**
   * Called after a durable snapshot has been persisted (used by the product
   * layer to mark the subject config durable_state PRESENT). Idempotent.
   */
  readonly onSnapshotPersisted?: () => Promise<void>;
  readonly clock?: () => string;
}

export type SubjectResolutionV0 = "NEW_SUBJECT_CREATED" | "SUBJECT_RESTORED";

export interface InteractiveSubjectOpenResultV0 {
  readonly resolution: SubjectResolutionV0;
  readonly storage_location: string | null;
}

export class InteractiveSubjectHostV0 {
  private failed = false;
  private busy = false;
  private lastFailureDetailValue: string | null = null;

  private baseRevision: number | null = null;
  private constructor(
    private runtime: InteractiveSubjectRuntimeV0,
    private readonly store: InteractiveSnapshotStoreV0,
    private readonly resolutionValue: SubjectResolutionV0,
    private readonly displayNameValue: string,
    private readonly onSnapshotPersisted: (() => Promise<void>) | undefined,
    private readonly sharedStore: SharedSubjectSourceStoreV0 | null,
    private readonly subjectIdValue: string,
    private readonly clock: () => string,
    private readonly runtimeOptions: InteractiveSubjectRuntimeOptionsV0,
    baseRevision: number | null
  ) {
    this.baseRevision = baseRevision;
  }

  static async open(
    config: InteractiveSubjectHostConfigV0,
    deps: InteractiveSubjectHostDepsV0
  ): Promise<InteractiveSubjectHostV0> {
    const store =
      deps.snapshotStore ?? new FileInteractiveSnapshotStoreV0(config.storage_root, config.subject_id);
    const loaded = await store.load();
    const sharedStore = deps.sharedSourceStore ?? null;
    const clock = deps.clock ?? (() => new Date().toISOString());
    // SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — ONE authoritative canonical
    // subject source decides NEW vs RESTORE (shared source, else a single legacy
    // artifact, else fresh). Two divergent legacy artifacts fail closed.
    const resolution = await resolveCanonicalSubjectV0({
      sharedStore,
      storageRoot: config.storage_root,
      subjectId: config.subject_id,
      ownLegacy:
        loaded.kind === "SNAPSHOT"
          ? {
              provenance: "ADOPTED_HUMAN",
              source_path: store.location() ?? "in-memory-human-snapshot",
              subject_id: loaded.snapshot.subject_id,
              head_ref: loaded.snapshot.durable.identity.subject_head.commit_ref,
              durable: loaded.snapshot.durable,
              store: loaded.snapshot.store
            }
          : null
    });
    const isNewSubject = resolution.kind === "CREATE_FRESH";
    // Creation-only authoring: the explicit genesis prior is consulted ONLY when
    // no durable subject exists. A restore never applies (or validates) it, so a
    // later-supplied prior can never rewrite an existing subject's personality.
    const v3Source =
      isNewSubject
        ? createInteractiveSubjectSeedV0(
            config.subject_id,
            config.display_name,
            config.identity_anchors ?? [],
            config.personality_genesis_prior
          )
        : createInteractiveSubjectSeedV0(
            config.subject_id,
            config.display_name,
            config.identity_anchors ?? []
          );
    const personalitySemanticProvider = deps.personalitySemanticProvider;
    // The factory receives THIS session's subject-scoped authorities, so a
    // personality-adaptation ledger and its evidence membership can never cross
    // subjects; the store is rebuilt on restore from the durable ledger image.
    const personalityAdaptationFactory: PersonalityAdaptationFactoryV0 | undefined =
      personalitySemanticProvider === undefined
        ? undefined
        : (authorities) =>
            new PersonalityAdaptationWiringV0({
              subjectCore: authorities.subjectCore,
              memoryRepository: authorities.memoryRepository,
              producerAuthorizationIssuer: authorities.producerAuthorizationIssuer,
              readEpisodePayload: authorities.readEpisodePayload,
              semanticProvider: personalitySemanticProvider,
              store: new InMemoryPersonalityAdaptationStoreV0()
            });
    const runtimeOptions: InteractiveSubjectRuntimeOptionsV0 = {
      session_id: config.session_id,
      subject: {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: [...(config.identity_anchors ?? [])]
      },
      v3_source: v3Source,
      conversationCognitionTransport: deps.conversationCognitionTransport,
      languageTransport: deps.languageTransport,
      factualEventAppraisalProvider: deps.appraisalProvider,
      ...(deps.beliefSemanticProvider === undefined ? {} : { beliefSemanticProvider: deps.beliefSemanticProvider }),
      ...(personalityAdaptationFactory === undefined ? {} : { personalityAdaptationFactory }),
      ...(deps.relationshipFamiliarityAdmissionProvider === undefined
        ? {}
        : { relationshipFamiliarityAdmissionProvider: deps.relationshipFamiliarityAdmissionProvider }),
      ...(config.interval_ticks === undefined ? {} : { interval_ticks: config.interval_ticks }),
      ...(deps.provider_identity === undefined ? {} : { provider_identity: deps.provider_identity }),
      ...(deps.clock === undefined ? {} : { clock: deps.clock })
    };
    if (resolution.kind === "CREATE_FRESH") {
      const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions);
      return new InteractiveSubjectHostV0(
        runtime,
        store,
        "NEW_SUBJECT_CREATED",
        config.display_name,
        deps.onSnapshotPersisted,
        sharedStore,
        config.subject_id,
        clock,
        runtimeOptions,
        null
      );
    }
    // Durable history exists: authoritative restore ONLY. A restore failure
    // propagates and must never fall back to a fresh subject. When a shared
    // canonical source is configured it decides the subject; the interactive
    // snapshot supplies only human turn bookkeeping.
    const canonical = resolution.canonical;
    const sidecar = loaded.kind === "SNAPSHOT" ? loaded.snapshot : null;
    const restoreSnapshot: InteractiveSubjectSnapshotV0 = {
      schema_version: "interactive-subject-snapshot-v0",
      session_id: config.session_id,
      subject_id: config.subject_id,
      subject: {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: [...(config.identity_anchors ?? [])]
      },
      next_turn_index: sidecar?.next_turn_index ?? 0,
      pending_behavior_outcome: sidecar?.pending_behavior_outcome ?? null,
      durable: canonical.durable,
      store: canonical.store,
      saved_at: clock()
    };
    const runtime = await InteractiveSubjectRuntimeV0.restore(runtimeOptions, restoreSnapshot);
    const host = new InteractiveSubjectHostV0(
      runtime,
      store,
      "SUBJECT_RESTORED",
      config.display_name,
      deps.onSnapshotPersisted,
      sharedStore,
      config.subject_id,
      clock,
      runtimeOptions,
      canonical.provenance === "SHARED" ? canonical.base_revision : null
    );
    if (canonical.provenance !== "SHARED" && sharedStore !== null) {
      await host.adoptIntoShared();
    }
    return host;
  }

  resolution(): SubjectResolutionV0 {
    return this.resolutionValue;
  }

  displayName(): string {
    return this.displayNameValue;
  }

  storageLocation(): string | null {
    return this.store.location();
  }

  subjectId(): string {
    return this.runtime.subjectId();
  }

  isFailed(): boolean {
    return this.failed;
  }

  lastFailureDetail(): string | null {
    return this.lastFailureDetailValue;
  }

  /** One serialized user turn. Refuses concurrent/re-entrant submissions. */
  async send(text: string): Promise<InteractiveTurnOutcomeV0> {
    if (this.failed) {
      throw new Error(
        `The runtime is in a failed state${this.lastFailureDetailValue === null ? "" : ` (${this.lastFailureDetailValue})`}. Exit and relaunch to resume from durable state.`
      );
    }
    if (this.busy) {
      throw new Error("concurrent turns are not supported: the previous turn has not completed");
    }
    this.busy = true;
    try {
      const outcome = await this.runtime.submitUserText(text);
      if (outcome.status === "FAILED") {
        this.failed = true;
        this.lastFailureDetailValue = outcome.failure;
        return outcome;
      }
      // The interaction is complete ONLY once durable state is captured.
      try {
        await this.save();
      } catch (error) {
        this.failed = true;
        this.lastFailureDetailValue = `durable snapshot failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      return outcome;
    } finally {
      this.busy = false;
    }
  }

  async save(): Promise<void> {
    const snapshot = await this.runtime.snapshot();
    // ONE authoritative canonical subject source first (stale base fails
    // closed); the interactive snapshot is the human-context sidecar.
    await this.persistCanonicalFrom(snapshot);
    await this.store.save(snapshot);
    if (this.onSnapshotPersisted !== undefined) {
      await this.onSnapshotPersisted();
    }
  }

  private async persistCanonicalFrom(snapshot: InteractiveSubjectSnapshotV0): Promise<void> {
    if (this.sharedStore === null) return;
    const canonical = await persistCanonicalSubjectV0({
      sharedStore: this.sharedStore,
      subjectId: this.subjectIdValue,
      durable: snapshot.durable,
      store: snapshot.store,
      expectedBaseRevision: this.baseRevision,
      updatedAt: this.clock()
    });
    this.baseRevision = canonical.base_revision;
  }

  /** Publishes an adopted legacy canonical subject into the shared source. */
  private async adoptIntoShared(): Promise<void> {
    if (this.sharedStore === null) return;
    await this.persistCanonicalFrom(await this.runtime.snapshot());
  }

  /** Shared canonical subject revision this host last read/wrote (null before first persist). */
  sharedRevision(): number | null {
    return this.baseRevision;
  }

  /** True when no mandatory lifecycle work is outstanding. */
  isQuiescent(): boolean {
    return !this.busy && this.pendingLifecycleWork() === 0;
  }

  async status(): Promise<InteractiveSubjectStatusV0> {
    return this.runtime.status();
  }

  /** Read-only canonical subject state inspection; no provider call. */
  async subjectStateView(): Promise<InteractiveSubjectStateViewV0> {
    return this.runtime.subjectStateView();
  }

  /**
   * CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0 — re-adopt the ONE shared
   * canonical subject source after another product context (structured external
   * observation / explicit time / environment) advanced it. Rebuilds a fresh
   * runtime from the shared durable state; the interactive snapshot remains the
   * human-turn sidecar. Fails closed if the shared source is absent/mismatched.
   */
  async reloadFromShared(): Promise<void> {
    if (this.sharedStore === null) return;
    const loaded = await this.sharedStore.load();
    if (loaded.kind !== "DOCUMENT") {
      throw new Error("shared canonical subject source missing during reload");
    }
    if (loaded.document.subject_id !== this.subjectIdValue) {
      throw new Error("shared canonical subject identity mismatch during reload");
    }
    const sidecar = await this.store.load();
    const restoreSnapshot: InteractiveSubjectSnapshotV0 = {
      schema_version: "interactive-subject-snapshot-v0",
      session_id: this.runtimeOptions.session_id,
      subject_id: this.subjectIdValue,
      subject: {
        subject_id: this.subjectIdValue,
        display_name: this.displayNameValue,
        identity_anchors: [...(this.runtimeOptions.subject.identity_anchors ?? [])]
      },
      next_turn_index: sidecar.kind === "SNAPSHOT" ? sidecar.snapshot.next_turn_index : 0,
      pending_behavior_outcome: sidecar.kind === "SNAPSHOT" ? sidecar.snapshot.pending_behavior_outcome : null,
      durable: loaded.document.durable,
      store: loaded.document.store,
      saved_at: this.clock()
    };
    this.runtime = await InteractiveSubjectRuntimeV0.restore(this.runtimeOptions, restoreSnapshot);
    this.baseRevision = loaded.document.base_revision;
    this.failed = false;
    this.lastFailureDetailValue = null;
  }

  /** Read-only durable lived-memory projection; performs no provider call. */
  async livedMemory(input?: { readonly limit?: number }): Promise<LivedMemoryInspectionV0> {
    return this.runtime.livedMemory(input);
  }

  async durableSnapshot(): Promise<InteractiveSubjectSnapshotV0> {
    return this.runtime.snapshot();
  }

  /** §39 — verify no mandatory pending lifecycle work remains before exit. */
  pendingLifecycleWork(): number {
    return this.runtime.pendingWork().length;
  }
}
