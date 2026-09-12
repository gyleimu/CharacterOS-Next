/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — reusable product runtime facade.
 *
 * ONE composition root that opens and owns ONE persistent subject for ANY local
 * product surface (CLI, local web). It reuses the existing frozen product
 * services only: configuration resolution, provider preflight, the shared
 * provider bundle, the interactive host, life operations, and diagnostics.
 *
 * It adds no canonical semantics, performs no provider call of its own, and
 * never becomes a second configuration authority.
 */

import { accessSync, constants, mkdirSync } from "node:fs";

import type {
  InteractiveSubjectStateViewV0,
  InteractiveSubjectStatusV0,
  LivedMemoryInspectionV0,
  InteractiveTurnOutcomeV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { ProductLifeOperationsV0, type ProductLifeViewV0, type ProductStateViewV0 } from "./product-life-operations.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { SerialTaskQueueV0 } from "./serial-task-queue.js";
import { probeOllamaV0, type OllamaProbeResultV0 } from "./product-providers.js";
import {
  createProductProviderBundleV0,
  type ProductProviderBundleV0
} from "./product-provider-bundle.js";
import {
  PRODUCT_DATA_ROOT_CONTENTS_V0,
  ProductConfigurationErrorV0,
  dataDirectoryFailureGuidanceV0,
  formatConfigurationErrorLinesV0,
  modelMissingGuidanceV0,
  processEnvironmentV0,
  providerUnavailableGuidanceV0,
  redactEndpointV0,
  resolveProductConfigurationV0,
  type ProductConfigSourceV0,
  type ProductConfigurationV0,
  type ProductConfigValueV0,
  type ProductEnvironmentV0
} from "./product-configuration.js";
import {
  buildStructuredObservationRequestV0,
  type ProductObservationFieldsV0
} from "./product-observation.js";
import {
  PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0,
  PRODUCT_DEFAULT_DATA_ROOT_V0
} from "./product-paths.js";
import {
  buildTurnFailureSummaryV0,
  runInstrumentedProductTurnV0,
  type InstrumentedTurnResultV0,
  type TurnFailureSummaryV0
} from "./product-turn-execution.js";
import {
  ProviderDiagnosticsV0,
  type ProductTurnPlanInputV0,
  type ProviderDiagnosticsSnapshotV0,
  type ProviderProgressEventV0
} from "./provider-diagnostics.js";
import type { InteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import type { SharedSubjectSourceStoreV0 } from "./cross-context-canonical.js";
import {
  SubjectConfigurationErrorV0,
  buildSubjectConfigForCreationV0,
  markSubjectDurableStatePresentV0,
  resolvePersistentSubjectV0,
  writeProductSubjectConfigV0,
  type ProductSubjectConfigV0
} from "./subject-configuration.js";

/** Product-only progress fan-out (process-local; nothing is persisted). */
export class ProductEventHubV0 {
  private readonly listeners = new Set<(event: ProviderProgressEventV0) => void>();

  subscribe(listener: (event: ProviderProgressEventV0) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish = (event: ProviderProgressEventV0): void => {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A failing observer (closed socket) must never break a turn.
      }
    }
  };
}

export type ProductRuntimeStartupCodeV0 =
  | "CONFIGURATION_INVALID"
  | "DATA_ROOT_UNUSABLE"
  | "PROVIDER_UNAVAILABLE"
  | "MODEL_UNAVAILABLE"
  | "SUBJECT_RESOLUTION_FAILED"
  | "SUBJECT_OPEN_FAILED";

/** Startup failure carrying the SAME actionable guidance the CLI prints. */
export class ProductRuntimeStartupErrorV0 extends Error {
  constructor(
    readonly code: ProductRuntimeStartupCodeV0,
    readonly guidance: readonly string[],
    detail: string
  ) {
    super(detail);
    this.name = "ProductRuntimeStartupErrorV0";
  }
}

export interface ProductRuntimeIdentityV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors: readonly string[];
  readonly identity_source: ProductConfigSourceV0;
  readonly identity_origin: string;
  readonly durable_state: "NONE" | "PRESENT" | "UNKNOWN";
}

export interface ProductRuntimeProviderV0 {
  readonly ready: boolean;
  readonly model: string;
  readonly endpoint: string;
  readonly timeout_ms: number;
}

/** Minimum initial view for a visual client (composed from existing reads). */
export interface ProductRuntimeBootstrapV0 {
  readonly identity: ProductRuntimeIdentityV0;
  readonly status: "NEW" | "RESTORED";
  readonly created_this_start: boolean;
  readonly provider: ProductRuntimeProviderV0;
  readonly logical_time: number;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly revisions: {
    readonly state_revision: number;
    readonly repository_revision: string;
    readonly shared_revision: number | null;
  };
  readonly state: InteractiveSubjectStateViewV0;
  readonly recent_memory: LivedMemoryInspectionV0;
}

/** Bounded result of one structured external observation (FIRST/REPLAY/CONFLICT). */
export type ProductObservationOutcomeV0 =
  | {
      readonly kind: "FIRST";
      readonly observation_ref: string;
      readonly episode_ref: string;
      readonly base_revision: number;
    }
  | { readonly kind: "REPLAY"; readonly observation_ref: string; readonly base_revision: number }
  | { readonly kind: "CONFLICT"; readonly detail: string }
  | { readonly kind: "INVALID"; readonly detail: string };

export interface ProductEnvironmentOutcomeV0 {
  readonly interaction_index: number;
  readonly status: string;
  readonly episode_ref: string | null;
}

/** Bounded result of a deterministic environment run. */
export interface ProductEnvironmentResultV0 {
  readonly environment_id: string;
  readonly resolution: "NEW_ENVIRONMENT_SUBJECT" | "ENVIRONMENT_SUBJECT_RESTORED";
  readonly requested: number;
  readonly completed: number;
  readonly outcomes: readonly ProductEnvironmentOutcomeV0[];
  readonly repository_revision: string;
  readonly state_revision: number;
}

/** Bounded result of explicit canonical time advancement (ticks, never wall clock). */
export interface ProductCanonicalTimeResultV0 {
  readonly ticks: number;
  readonly no_op: boolean;
  readonly logical_time_before: number;
  readonly logical_time_after: number;
  readonly valence_before: number;
  readonly valence_after: number;
  readonly activation_before: number;
  readonly activation_after: number;
  readonly base_revision: number;
}

export interface ProductConfigValueViewV0 {
  readonly value: string;
  readonly source: ProductConfigSourceV0;
  readonly origin: string;
}

/** READ-ONLY effective configuration (endpoint credentials redacted). */
export interface ProductConfigViewV0 {
  readonly model: ProductConfigValueViewV0;
  readonly endpoint: ProductConfigValueViewV0;
  readonly timeout_ms: ProductConfigValueViewV0;
  readonly context_window_tokens: ProductConfigValueViewV0;
  readonly num_predict: ProductConfigValueViewV0;
  readonly data_root: ProductConfigValueViewV0;
  readonly subject: {
    readonly subject_id: string;
    readonly display_name: string;
    readonly identity_source: ProductConfigSourceV0;
    readonly identity_origin: string;
    readonly durable_state: "NONE" | "PRESENT" | "UNKNOWN";
  };
  readonly data_root_contains: readonly string[];
  readonly read_only: true;
}

export interface ProductRuntimeDepsV0 {
  readonly host: InteractiveSubjectHostV0;
  readonly life: ProductLifeOperationsV0;
  readonly diagnostics: ProviderDiagnosticsV0 | null;
  readonly configuration: ProductConfigurationV0;
  readonly provider: ProductRuntimeProviderV0;
  readonly created: boolean;
  readonly identity: ProductRuntimeIdentityV0;
  readonly debug: boolean;
  readonly hub: ProductEventHubV0;
  readonly queue: SerialTaskQueueV0;
  /** Display-only expected turn plan (same flags as the CLI provider bundle). */
  readonly turnPlan: ProductTurnPlanInputV0;
}

/**
 * ONE persistent subject's product surface. All mutations go through the frozen
 * host/life services; this class owns only serialization and read composition.
 */
export class ProductRuntimeV0 {
  constructor(private readonly deps: ProductRuntimeDepsV0) {}

  subscribe(listener: (event: ProviderProgressEventV0) => void): () => void {
    return this.deps.hub.subscribe(listener);
  }

  identity(): ProductRuntimeIdentityV0 {
    return this.deps.identity;
  }

  provider(): ProductRuntimeProviderV0 {
    return this.deps.provider;
  }

  configuration(): ProductConfigurationV0 {
    return this.deps.configuration;
  }

  /** Read-only canonical state projection (status + state + shared revision). */
  async stateView(): Promise<ProductStateViewV0> {
    return this.deps.life.stateView();
  }

  /** Read-only one-life projection (state + recent lived Memory). */
  async lifeView(): Promise<ProductLifeViewV0> {
    return this.deps.life.lifeView();
  }

  async status(): Promise<InteractiveSubjectStatusV0> {
    return this.deps.host.status();
  }

  async livedMemory(limit?: number): Promise<LivedMemoryInspectionV0> {
    return this.deps.host.livedMemory(limit === undefined ? {} : { limit });
  }

  async bootstrap(): Promise<ProductRuntimeBootstrapV0> {
    const status = await this.deps.host.status();
    const state = await this.deps.host.subjectStateView();
    const recent = await this.deps.host.livedMemory({ limit: 5 });
    return {
      identity: this.deps.identity,
      status: status.origin === "NEW_SUBJECT" ? "NEW" : "RESTORED",
      created_this_start: this.deps.created,
      provider: this.deps.provider,
      logical_time: status.logical_time,
      affect: status.affect,
      revisions: {
        state_revision: status.state_revision,
        repository_revision: status.repository_revision,
        shared_revision: this.deps.host.sharedRevision()
      },
      state,
      recent_memory: recent
    };
  }

  /**
   * ONE serialized human turn. The backend owns the serialization rule: a
   * concurrent submission waits for the previous turn instead of racing it.
   */
  async submitHumanText(text: string): Promise<InstrumentedTurnResultV0> {
    return this.deps.queue.run(() =>
      runInstrumentedProductTurnV0({
        host: this.deps.host,
        diagnostics: this.deps.diagnostics,
        turnPlan: this.deps.turnPlan,
        text
      })
    );
  }

  /**
   * Structured turn result for a visual client: the reply on success, or the
   * SAME truthful failure summary the CLI prints (stage, SAFE/PARTIAL, reason,
   * suggested action) on failure. Never a prompt payload, never a fake reply.
   */
  summarizeTurn(result: InstrumentedTurnResultV0): ProductTurnResultV0 {
    const outcome = result.outcome;
    return {
      status: outcome.status,
      reply_text: outcome.status === "COMPLETE" ? outcome.subject_text : null,
      turn_index: outcome.turn_index,
      subject_id: outcome.subject_id,
      completed_prior_outcome: outcome.completed_prior_outcome,
      language_call_required: outcome.language_call_required,
      elapsed_ms: result.elapsed_ms,
      repository_revision_after: outcome.repository_revision_after,
      state_revision_after: outcome.state_revision_after,
      failure_detail: outcome.failure,
      failure:
        outcome.status === "FAILED"
          ? buildTurnFailureSummaryV0({
              outcome,
              diagnostics: this.deps.diagnostics,
              pending_lifecycle_work: this.deps.host.pendingLifecycleWork()
            })
          : null
    };
  }

  /**
   * ONE structured external observation through the FROZEN ingress (no truth
   * upgrade, no wall-clock mapping, FIRST/REPLAY/CONFLICT preserved). Invalid
   * product input is reported, never coerced; ingress authority errors throw.
   */
  async submitExternalObservation(fields: ProductObservationFieldsV0): Promise<ProductObservationOutcomeV0> {
    const built = buildStructuredObservationRequestV0(fields);
    if (!built.ok) return { kind: "INVALID", detail: built.detail };
    const outcome = await this.deps.life.observe(built.request);
    if (outcome.kind === "FIRST") {
      return {
        kind: "FIRST",
        observation_ref: outcome.observation_ref,
        episode_ref: outcome.episode_ref,
        base_revision: outcome.base_revision
      };
    }
    if (outcome.kind === "REPLAY") {
      return { kind: "REPLAY", observation_ref: outcome.observation_ref, base_revision: outcome.base_revision };
    }
    return { kind: "CONFLICT", detail: outcome.detail };
  }

  /** Deterministic environment interaction against the SAME canonical subject. */
  async runEnvironmentInteraction(count: number): Promise<ProductEnvironmentResultV0> {
    const run = await this.deps.life.environment(count);
    return {
      environment_id: run.environment_id,
      resolution: run.resolution,
      requested: count,
      completed: run.outcomes.filter((outcome) => outcome.status === "COMPLETE").length,
      outcomes: run.outcomes.map((outcome) => ({
        interaction_index: outcome.interaction_index,
        status: outcome.status,
        episode_ref: outcome.episode_ref
      })),
      repository_revision: run.status.repository_revision,
      state_revision: run.status.state_revision
    };
  }

  /** Explicit canonical TICKS only (0 is a lawful NO_OP); no wall-clock mapping. */
  async advanceCanonicalTime(ticks: number): Promise<ProductCanonicalTimeResultV0> {
    const result = await this.deps.life.time(ticks);
    return {
      ticks: result.ticks,
      no_op: result.no_op,
      logical_time_before: result.logical_time_before,
      logical_time_after: result.logical_time_after,
      valence_before: result.valence_before,
      valence_after: result.valence_after,
      activation_before: result.activation_before,
      activation_after: result.activation_after,
      base_revision: result.base_revision
    };
  }

  /** READ-ONLY effective configuration; endpoint credentials are redacted. */
  configView(): ProductConfigViewV0 {
    const value = <T>(entry: ProductConfigValueV0<T>, render: (input: T) => string): ProductConfigValueViewV0 => ({
      value: render(entry.value),
      source: entry.source,
      origin: entry.origin
    });
    const configuration = this.deps.configuration;
    return {
      model: value(configuration.model, (input) => input),
      endpoint: value(configuration.endpoint, (input) => redactEndpointV0(input)),
      timeout_ms: value(configuration.timeout_ms, (input) => String(input)),
      context_window_tokens: value(configuration.context_window_tokens, (input) => String(input)),
      num_predict: value(configuration.num_predict, (input) => String(input)),
      data_root: value(configuration.data_root, (input) => input),
      subject: {
        subject_id: this.deps.identity.subject_id,
        display_name: this.deps.identity.display_name,
        identity_source: this.deps.identity.identity_source,
        identity_origin: this.deps.identity.identity_origin,
        durable_state: this.deps.identity.durable_state
      },
      data_root_contains: PRODUCT_DATA_ROOT_CONTENTS_V0,
      read_only: true
    };
  }

  /** Structured bounded provider diagnostics (no prompts, no Memory content). */
  diagnosticsView(): ProviderDiagnosticsSnapshotV0 | null {
    return this.deps.diagnostics?.snapshot() ?? null;
  }

  isQuiescent(): boolean {
    return this.deps.host.isQuiescent();
  }

  /** Waits for in-flight turns; the host already persisted each completed turn. */
  async shutdown(): Promise<void> {
    await this.deps.queue.drain();
  }
}

// --- factory ------------------------------------------------------------------

export interface CreateProductRuntimeOptionsV0 {
  readonly environment?: ProductEnvironmentV0;
  /** Explicit data root; defaults to the shared product default (CLI-compatible). */
  readonly data_root?: string;
  /** Deterministic subject identity for tests/automation (display name only). */
  readonly subject?: { readonly display_name: string };
  readonly debug?: boolean;
  /** Terminal/diagnostic line sink; defaults to a no-op. */
  readonly write?: (line: string) => void;
  /** Extra structured progress sink (the hub is always available via subscribe). */
  readonly observer?: (event: ProviderProgressEventV0) => void;
  /** Test seam: a prebuilt provider bundle (no real transports). */
  readonly provider_bundle?: ProductProviderBundleV0;
  /** Test seam: metadata preflight override (never a generation call). */
  readonly probe?: (endpoint: string, model: string) => Promise<OllamaProbeResultV0>;
  readonly persistence?: {
    readonly snapshotStore?: InteractiveSnapshotStoreV0;
    readonly sharedSourceStore?: SharedSubjectSourceStoreV0;
  };
  readonly session_label?: string;
  readonly clock?: () => string;
  readonly now?: () => number;
}

function startupError(
  code: ProductRuntimeStartupCodeV0,
  guidance: readonly string[],
  detail: string
): ProductRuntimeStartupErrorV0 {
  return new ProductRuntimeStartupErrorV0(code, guidance, detail);
}

/**
 * Opens/creates the ONE persistent subject for a local product process.
 * Fails closed with actionable guidance — never a fake READY product.
 */
export async function createProductRuntimeV0(
  options: CreateProductRuntimeOptionsV0 = {}
): Promise<ProductRuntimeV0> {
  const environment = options.environment ?? processEnvironmentV0();

  let configuration: ProductConfigurationV0;
  try {
    configuration = resolveProductConfigurationV0({
      environment,
      default_data_root: options.data_root ?? PRODUCT_DEFAULT_DATA_ROOT_V0,
      default_data_root_origin: PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0
    });
  } catch (error) {
    if (error instanceof ProductConfigurationErrorV0) {
      throw startupError("CONFIGURATION_INVALID", formatConfigurationErrorLinesV0(error), error.message);
    }
    throw error;
  }
  const dataRoot = configuration.data_root.value;
  try {
    mkdirSync(dataRoot, { recursive: true });
    accessSync(dataRoot, constants.W_OK);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw startupError("DATA_ROOT_UNUSABLE", dataDirectoryFailureGuidanceV0(dataRoot, detail), detail);
  }

  const hub = new ProductEventHubV0();
  const debug = options.debug ?? configuration.debug.value;
  const bundle =
    options.provider_bundle ??
    createProductProviderBundleV0({
      configuration,
      write: options.write ?? (() => undefined),
      observer: (event) => {
        hub.publish(event);
        options.observer?.(event);
      },
      debug,
      ...(options.now === undefined ? {} : { now: options.now })
    });
  // Metadata-only preflight (never a generation call); fail closed, like the CLI.
  const probe = await (options.probe ?? probeOllamaV0)(configuration.endpoint.value, configuration.model.value);
  if (!probe.reachable) {
    throw startupError(
      "PROVIDER_UNAVAILABLE",
      providerUnavailableGuidanceV0(configuration.endpoint.value, probe.failure ?? "unknown"),
      probe.failure ?? "provider unreachable"
    );
  }
  if (probe.failure !== null) {
    throw startupError(
      "MODEL_UNAVAILABLE",
      modelMissingGuidanceV0(configuration.model.value, configuration.endpoint.value, probe.failure),
      probe.failure
    );
  }

  const overrideSubjectId = environment.get("CHARACTEROS_SUBJECT_ID");
  const overrideDisplayName = environment.get("CHARACTEROS_DISPLAY_NAME");
  let durableConfig: ProductSubjectConfigV0;
  let created: boolean;
  let identitySource: ProductConfigSourceV0;
  let identityOrigin: string;
  try {
    const resolution = await resolvePersistentSubjectV0({
      dataRoot,
      ...(overrideSubjectId === undefined ? {} : { overrideSubjectId }),
      ...(overrideDisplayName === undefined ? {} : { overrideDisplayName })
    });
    if (resolution.kind === "CREATE_REQUIRED") {
      const displayName =
        options.subject?.display_name ?? resolution.preset?.display_name ?? overrideDisplayName ?? "Mira";
      durableConfig = buildSubjectConfigForCreationV0(displayName);
      writeProductSubjectConfigV0(dataRoot, durableConfig);
      created = true;
      identitySource = resolution.preset === null ? "DERIVED" : "ENVIRONMENT";
      identityOrigin = resolution.preset === null ? "derived from display name" : "CHARACTEROS_SUBJECT_ID";
    } else {
      durableConfig = resolution.config;
      if (resolution.kind === "RECOVER_AND_RESTORE") writeProductSubjectConfigV0(dataRoot, durableConfig);
      created = false;
      identitySource = "PERSISTED_PRODUCT_CONFIG";
      identityOrigin =
        resolution.kind === "RECOVER_AND_RESTORE"
          ? "recovered from durable snapshot identity"
          : "subject-config.json";
    }
  } catch (error) {
    if (error instanceof SubjectConfigurationErrorV0) {
      throw startupError("SUBJECT_RESOLUTION_FAILED", [], error.message);
    }
    throw error;
  }

  const sharedStore =
    options.persistence?.sharedSourceStore ?? new FileSharedSubjectSourceStoreV0(dataRoot, durableConfig.subject_id);
  const onSnapshotPersisted = async (): Promise<void> => {
    if (durableConfig.durable_state === "NONE") {
      durableConfig = markSubjectDurableStatePresentV0(dataRoot, durableConfig);
    }
  };
  const clock = options.clock ?? ((): string => new Date().toISOString());
  let host: InteractiveSubjectHostV0;
  try {
    host = await InteractiveSubjectHostV0.open(
      {
        subject_id: durableConfig.subject_id,
        display_name: durableConfig.display_name,
        identity_anchors: durableConfig.identity_anchors,
        session_id: `${options.session_label ?? "product-web"}-${durableConfig.subject_id}-${process.pid}`,
        storage_root: dataRoot
      },
      {
        conversationCognitionTransport: bundle.transports.cognition,
        languageTransport: bundle.transports.language,
        appraisalProvider: bundle.appraisalProvider,
        ...(bundle.beliefSemanticProvider === null
          ? {}
          : { beliefSemanticProvider: bundle.beliefSemanticProvider }),
        ...(bundle.relationshipFamiliarityAdmissionProvider === null
          ? {}
          : { relationshipFamiliarityAdmissionProvider: bundle.relationshipFamiliarityAdmissionProvider }),
        sharedSourceStore: sharedStore,
        provider_identity: {
          model: configuration.model.value,
          num_predict: configuration.num_predict.value,
          context_window_tokens: configuration.context_window_tokens.value,
          last_trace: bundle.transports.lastCognitionTrace
        },
        onSnapshotPersisted,
        ...(options.persistence?.snapshotStore === undefined
          ? {}
          : { snapshotStore: options.persistence.snapshotStore }),
        clock
      }
    );
    if (host.resolution() === "SUBJECT_RESTORED" && durableConfig.durable_state === "NONE") {
      durableConfig = markSubjectDurableStatePresentV0(dataRoot, durableConfig);
    }
  } catch (error) {
    throw startupError(
      "SUBJECT_OPEN_FAILED",
      [],
      error instanceof Error ? error.message : String(error)
    );
  }

  const life = new ProductLifeOperationsV0(
    {
      storage_root: dataRoot,
      subject: {
        subject_id: durableConfig.subject_id,
        display_name: durableConfig.display_name,
        identity_anchors: [...durableConfig.identity_anchors]
      },
      interaction_interval_ticks: configuration.interval_ticks.value
    },
    {
      host,
      sharedSourceStore: sharedStore,
      conversationCognitionTransport: bundle.transports.cognition,
      languageTransport: bundle.transports.language,
      factualEventAppraisalProvider: bundle.appraisalProvider,
      ...(bundle.beliefSemanticProvider === null
        ? {}
        : { beliefSemanticProvider: bundle.beliefSemanticProvider }),
      ...(bundle.relationshipFamiliarityAdmissionProvider === null
        ? {}
        : { relationshipFamiliarityAdmissionProvider: bundle.relationshipFamiliarityAdmissionProvider }),
      provider_identity: {
        model: configuration.model.value,
        num_predict: configuration.num_predict.value,
        context_window_tokens: configuration.context_window_tokens.value,
        last_trace: bundle.transports.lastCognitionTrace
      },
      clock
    }
  );

  return new ProductRuntimeV0({
    host,
    life,
    diagnostics: bundle.diagnostics,
    configuration,
    provider: {
      ready: true,
      model: configuration.model.value,
      endpoint: configuration.endpoint.value,
      timeout_ms: configuration.timeout_ms.value
    },
    created,
    identity: {
      subject_id: durableConfig.subject_id,
      display_name: durableConfig.display_name,
      identity_anchors: [...durableConfig.identity_anchors],
      identity_source: identitySource,
      identity_origin: identityOrigin,
      durable_state: durableConfig.durable_state
    },
    debug,
    hub,
    queue: new SerialTaskQueueV0(),
    turnPlan: bundle.turnPlan
  });
}

/** The structured turn result returned to a visual client (never a prompt payload). */
export interface ProductTurnResultV0 {
  readonly status: "COMPLETE" | "FAILED";
  readonly reply_text: string | null;
  readonly turn_index: number;
  readonly subject_id: string;
  readonly completed_prior_outcome: InteractiveTurnOutcomeV0["completed_prior_outcome"];
  readonly language_call_required: boolean;
  readonly elapsed_ms: number | null;
  readonly repository_revision_after: string;
  readonly state_revision_after: number;
  readonly failure_detail: string | null;
  readonly failure: TurnFailureSummaryV0 | null;
}
