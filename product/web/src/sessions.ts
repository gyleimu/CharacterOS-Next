/**
 * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — local product SUBJECT SESSIONS.
 *
 * The product's persistent subject is ONE subject per data root (the sandbox's
 * existing law). The visual product therefore gives each subject its OWN data root
 * under a subjects folder, and this module owns exactly that product-shell
 * concern:
 *
 *   subjects_root/<subject_id>/     one root per subject (config + snapshot + log)
 *
 * It creates, lists and opens subjects by DELEGATING to the existing product
 * runtime: `createProductRuntimeV0({ data_root })` performs the real
 * genesis/restore, and the runtime's own resolution law decides NEW vs RESTORED.
 * Nothing here writes canonical state, and switching subjects simply closes one
 * runtime and opens another — the subject's life continues from its own durable
 * files.
 *
 * It is NOT an authority: it holds no state, mints no identity, and its list is a
 * directory scan plus the configs those roots already persist.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  InstrumentedTurnResultV0,
  InteractiveSubjectStatusV0,
  LivedMemoryInspectionV0,
  ProductConfigViewV0,
  ProductDiagnosticsViewV0,
  ProductEnvironmentResultV0,
  ProductLifeViewV0,
  ProductObservationFieldsV0,
  ProductObservationOutcomeV0,
  ProductRuntimeBootstrapV0,
  ProductStateViewV0,
  ProductTurnResultV0,
  ProviderProgressEventV0,
  ProductCanonicalTimeResultV0
} from "@characteros-next/sandbox";
import {
  appendProductTurnTranscriptV0,
  deriveSubjectIdV0,
  listSnapshotSubjectIdsV0,
  productTurnTranscriptPathV0,
  readProductSubjectConfigV0,
  readProductTurnTranscriptV0,
  validateDisplayNameV0,
  type ProductTurnTranscriptRowV0
} from "@characteros-next/sandbox";

/** The runtime surface a subject session needs (satisfied by ProductRuntimeV0). */
export interface ProductWebSubjectRuntimeV0 {
  bootstrap(): Promise<ProductRuntimeBootstrapV0>;
  status(): Promise<InteractiveSubjectStatusV0>;
  stateView(): Promise<ProductStateViewV0>;
  lifeView(): Promise<ProductLifeViewV0>;
  livedMemory(limit?: number): Promise<LivedMemoryInspectionV0>;
  submitHumanText(text: string): Promise<InstrumentedTurnResultV0>;
  summarizeTurn(result: InstrumentedTurnResultV0): ProductTurnResultV0;
  subscribe(listener: (event: ProviderProgressEventV0) => void): () => void;
  submitExternalObservation(fields: ProductObservationFieldsV0): Promise<ProductObservationOutcomeV0>;
  runEnvironmentInteraction(count: number): Promise<ProductEnvironmentResultV0>;
  advanceCanonicalTime(ticks: number): Promise<ProductCanonicalTimeResultV0>;
  configView(): ProductConfigViewV0;
  diagnosticsView(): ProductDiagnosticsViewV0 | null;
  shutdown(): Promise<void>;
}

export interface ProductWebSubjectSummaryV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly durable_state: "NONE" | "PRESENT" | "UNKNOWN";
  readonly active: boolean;
  /** False for a root whose subject cannot be opened by this shell (legacy layout). */
  readonly openable: boolean;
}

export interface ProductWebSessionsOptionsV0 {
  /** Folder that holds one data root per subject. */
  readonly subjects_root: string;
  /**
   * Builds a runtime for one subject data root (real product or a test double).
   *  is supplied ONLY when the subject is being CREATED, so the
   * runtime performs its own genesis for exactly that identity; opening an
   * existing root passes nothing and the persisted config decides.
   */
  readonly open_runtime: (input: {
    readonly subject_id: string;
    readonly data_root: string;
    readonly display_name?: string | undefined;
  }) => Promise<ProductWebSubjectRuntimeV0>;
  readonly now?: () => string;
}

interface ActiveSessionV0 {
  readonly subject_id: string;
  readonly data_root: string;
  readonly runtime: ProductWebSubjectRuntimeV0;
}

export class ProductWebSessionsV0 {
  private active: ActiveSessionV0 | null = null;
  private readonly now: () => string;

  constructor(private readonly options: ProductWebSessionsOptionsV0) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  hasActive(): boolean {
    return this.active !== null;
  }

  private rootFor(subjectId: string): string {
    return join(this.options.subjects_root, subjectId);
  }

  /** Directory scan + the configs those roots already persist. Read-only. */
  list(): readonly ProductWebSubjectSummaryV0[] {
    if (!existsSync(this.options.subjects_root)) return [];
    const ids = readdirSync(this.options.subjects_root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.length > 0 && !name.startsWith("."))
      .sort();
    return ids.map((subjectId) => {
      const root = this.rootFor(subjectId);
      const config = readProductSubjectConfigV0(root);
      const snapshots = listSnapshotSubjectIdsV0(root);
      return {
        subject_id: subjectId,
        display_name: config.kind === "CONFIG" ? config.config.display_name : subjectId,
        durable_state: config.kind === "CONFIG" ? config.config.durable_state : snapshots.length > 0 ? "PRESENT" : "UNKNOWN",
        active: this.active?.subject_id === subjectId,
        openable: true
      };
    });
  }

  activeSummary(): ProductWebSubjectSummaryV0 | null {
    if (this.active === null) return null;
    return this.list().find((summary) => summary.subject_id === this.active?.subject_id) ?? null;
  }

  activeSubjectId(): string | null {
    return this.active?.subject_id ?? null;
  }

  current(): ProductWebSubjectRuntimeV0 {
    if (this.active === null) throw new Error("no subject is open");
    return this.active.runtime;
  }

  /** Opens (creating the root if needed) and makes it the ACTIVE subject. */
  async open(subjectId: string): Promise<ProductWebSubjectSummaryV0> {
    const validated = this.validateId(subjectId);
    return this.switchTo(validated, undefined);
  }

  /** Creates a NEW subject from a display name, then opens it. */
  async create(displayName: string): Promise<ProductWebSubjectSummaryV0> {
    const validated = validateDisplayNameV0(displayName, "display_name");
    const subjectId = deriveSubjectIdV0(validated);
    return this.switchTo(subjectId, validated);
  }

  private validateId(subjectId: string): string {
    const trimmed = subjectId.trim();
    if (trimmed.length === 0 || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
      throw new Error("subject_id must be a plain identifier");
    }
    return trimmed;
  }

  private async switchTo(subjectId: string, displayName: string | undefined): Promise<ProductWebSubjectSummaryV0> {
    if (this.active?.subject_id === subjectId) {
      const summary = this.activeSummary();
      if (summary !== null) return summary;
    }
    const dataRoot = this.rootFor(subjectId);
    mkdirSync(dataRoot, { recursive: true });
    const runtime = await this.options.open_runtime({
      subject_id: subjectId,
      data_root: dataRoot,
      ...(displayName === undefined ? {} : { display_name: displayName })
    });
    const previous = this.active;
    this.active = { subject_id: subjectId, data_root: dataRoot, runtime };
    if (previous !== null) await previous.runtime.shutdown().catch(() => undefined);
    const summary = this.activeSummary();
    if (summary === null) throw new Error(`subject ${subjectId} could not be opened`);
    return summary;
  }

  /**
   * Appends the product-visible turn row for the ACTIVE subject (idempotent per
   * turn index). The caller supplies exactly the values the product surfaced for
   * that turn; nothing is inferred.
   */
  recordTurn(subjectId: string, turn: {
    readonly turn_index: number;
    readonly status: "COMPLETE" | "FAILED" | "DEGRADED";
    readonly user_text: string;
    readonly subject_text: string;
    readonly failure_detail: string | null;
    readonly input_mode?: "typed" | "voice" | undefined;
    readonly state_revision_after: number;
    readonly repository_revision_after: string;
  }): void {
    if (this.active === null || this.active.subject_id !== subjectId) return;
    const path = productTurnTranscriptPathV0(this.active.data_root, subjectId);
    appendProductTurnTranscriptV0({
      transcript_path: path,
      now: this.now(),
      row: {
        session_id: `web-${subjectId}`,
        subject_id: subjectId,
        turn_index: turn.turn_index,
        status: turn.status,
        user_text: turn.user_text,
        subject_text: turn.subject_text,
        directive: null,
        current_intent: null,
        delivery_id: null,
        completed_prior_outcome: null,
        observational_experience_ref: null,
        failure: turn.failure_detail,
        input_mode: turn.input_mode ?? "typed",
        repository_revision_before: "",
        repository_revision_after: turn.repository_revision_after,
        state_revision_before: 0,
        state_revision_after: turn.state_revision_after
      }
    });
  }

  transcript(limit?: number): readonly ProductTurnTranscriptRowV0[] {
    if (this.active === null) return [];
    return readProductTurnTranscriptV0({
      transcript_path: productTurnTranscriptPathV0(this.active.data_root, this.active.subject_id),
      ...(limit === undefined ? {} : { limit })
    });
  }

  async close(): Promise<void> {
    const active = this.active;
    this.active = null;
    if (active !== null) await active.runtime.shutdown().catch(() => undefined);
  }
}
