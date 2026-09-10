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
  InteractiveTurnOutcomeV0,
  LivedMemoryInspectionV0,
  ModelTransportTraceV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0
} from "@characteros-next/runtime";
import type { InteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import { FileInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";

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
}

export interface InteractiveSubjectHostDepsV0 {
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly appraisalProvider: FactualEventAppraisalProviderV0;
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly context_window_tokens?: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  /** Override for tests; defaults to the file-backed store under storage_root. */
  readonly snapshotStore?: InteractiveSnapshotStoreV0;
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

  private constructor(
    private readonly runtime: InteractiveSubjectRuntimeV0,
    private readonly store: InteractiveSnapshotStoreV0,
    private readonly resolutionValue: SubjectResolutionV0,
    private readonly displayNameValue: string,
    private readonly onSnapshotPersisted: (() => Promise<void>) | undefined
  ) {}

  static async open(
    config: InteractiveSubjectHostConfigV0,
    deps: InteractiveSubjectHostDepsV0
  ): Promise<InteractiveSubjectHostV0> {
    const store =
      deps.snapshotStore ?? new FileInteractiveSnapshotStoreV0(config.storage_root, config.subject_id);
    const loaded = await store.load();
    const runtimeOptions: InteractiveSubjectRuntimeOptionsV0 = {
      session_id: config.session_id,
      subject: {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: [...(config.identity_anchors ?? [])]
      },
      v3_source: createInteractiveSubjectSeedV0(
        config.subject_id,
        config.display_name,
        config.identity_anchors ?? []
      ),
      conversationCognitionTransport: deps.conversationCognitionTransport,
      languageTransport: deps.languageTransport,
      factualEventAppraisalProvider: deps.appraisalProvider,
      ...(config.interval_ticks === undefined ? {} : { interval_ticks: config.interval_ticks }),
      ...(deps.provider_identity === undefined ? {} : { provider_identity: deps.provider_identity }),
      ...(deps.clock === undefined ? {} : { clock: deps.clock })
    };
    if (loaded.kind === "NONE") {
      const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions);
      return new InteractiveSubjectHostV0(
        runtime,
        store,
        "NEW_SUBJECT_CREATED",
        config.display_name,
        deps.onSnapshotPersisted
      );
    }
    // Durable history exists: authoritative restore ONLY. A restore failure
    // propagates and must never fall back to a fresh subject.
    const runtime = await InteractiveSubjectRuntimeV0.restore(runtimeOptions, loaded.snapshot);
    return new InteractiveSubjectHostV0(
      runtime,
      store,
      "SUBJECT_RESTORED",
      config.display_name,
      deps.onSnapshotPersisted
    );
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
    await this.store.save(snapshot);
    if (this.onSnapshotPersisted !== undefined) {
      await this.onSnapshotPersisted();
    }
  }

  async status(): Promise<InteractiveSubjectStatusV0> {
    return this.runtime.status();
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
