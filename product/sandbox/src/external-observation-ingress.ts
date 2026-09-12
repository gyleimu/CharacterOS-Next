/**
 * EXTERNAL_STRUCTURED_OBSERVATION_PRODUCT_INGRESS_V0 — the product semantic
 * boundary between outside-world modality interpretation and subject lived
 * experience.
 *
 * An external adapter reports ONE bounded structured semantic observation:
 * a stable source identity, a stable external event identity, the observed
 * entities, and bounded scene/task semantics. CharacterOS commits exactly one
 * generic canonical Observation (no human-utterance pretence, no
 * SubjectEnvironmentV0 wrapper) and turns it into lived experience through the
 * EXISTING observation-sourced Learning path.
 *
 * Identity and idempotency are derived from authoritative canonical committed
 * history — never a parallel ledger:
 *   FIRST     no committed external observation for (source_ref, event_ref)
 *   REPLAY    same pair, SAME normalized semantic payload ⇒ +0 everything
 *   CONFLICT  same pair, DIFFERENT payload ⇒ fail closed
 *
 * Attribution is "source S reported event X" — never objective truth.
 * No wall-clock → tick mapping; no blob storage; no belief/truth upgrade.
 */

import { createHash } from "node:crypto";
import {
  ExplicitV4SessionAuthorityV0,
  InMemoryConversationDeliveryLedger,
  InMemoryConversationIngressLedger,
  captureSessionStoreImageV0,
  createInteractiveSubjectSeedV0,
  rebuildSessionStoreSourceV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type FactualEventAppraisalProviderV0,
  type ModelTransportV0,
  type PersonalityAdaptationFactoryV0,
  type RelationshipInteractionQualifyingAdmissionProviderV0
} from "@characteros-next/runtime";
import {
  persistCanonicalSubjectV0,
  type SharedSubjectSourceStoreV0
} from "./cross-context-canonical.js";

export const EXTERNAL_OBSERVATION_ID_PROJECTION =
  "characteros-next/product/external-observation-id/v0" as const;
export const EXTERNAL_OBSERVATION_FINGERPRINT_PROJECTION =
  "characteros-next/product/external-observation-fingerprint/v0" as const;

export interface ExternalStructuredObservationRequestV0 {
  /** Reporting source identity, kind `source` (who/what reported). */
  readonly source_ref: string;
  /** Stable external event identity, kind `event` (survives retries). */
  readonly event_ref: string;
  /** Observed entities, kinds `entity`/`subject` (who/what it concerns). */
  readonly entity_refs: readonly string[];
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs?: readonly string[];
  readonly environment_refs?: readonly string[];
  readonly declared_salience?: number;
}

export type ExternalObservationIngressOutcomeV0 =
  | {
      readonly kind: "FIRST";
      readonly observation_ref: string;
      readonly observation_transition_id: string;
      readonly episode_ref: string;
      readonly base_revision: number;
    }
  | { readonly kind: "REPLAY"; readonly observation_ref: string; readonly base_revision: number }
  | { readonly kind: "CONFLICT"; readonly detail: string };

export type ExternalObservationIngressErrorCodeV0 =
  | "EXTERNAL_OBSERVATION_INVALID_REQUEST"
  | "EXTERNAL_OBSERVATION_NO_SUBJECT"
  | "EXTERNAL_OBSERVATION_ADAPTER_STATE_UNAVAILABLE";

export class ExternalObservationIngressErrorV0 extends Error {
  constructor(readonly code: ExternalObservationIngressErrorCodeV0, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ExternalObservationIngressErrorV0";
  }
}

export interface ExternalObservationIngressDepsV0 {
  readonly sharedSourceStore: SharedSubjectSourceStoreV0;
  readonly subject: {
    readonly subject_id: string;
    readonly display_name: string;
    readonly identity_anchors: readonly string[];
  };
  /** Structural-only restore collaborators (never invoked for an observation). */
  readonly conversationCognitionTransport?: ModelTransportV0;
  readonly languageTransport?: ModelTransportV0;
  readonly factualEventAppraisalProvider?: FactualEventAppraisalProviderV0;
  /** Existing adaptation providers, offered the completed episode (Level 9). */
  readonly beliefSemanticProvider?: BeliefSemanticTargetResolutionProviderV0;
  readonly personalityAdaptationFactory?: PersonalityAdaptationFactoryV0;
  readonly relationshipFamiliarityAdmissionProvider?: RelationshipInteractionQualifyingAdmissionProviderV0;
  readonly clock?: () => string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

async function hashProjection(projection: string, body: unknown): Promise<string> {
  const digest = createHash("sha256").update(`${projection}\n${stableStringify(body)}`, "utf8").digest("hex");
  return `sha256:${digest}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function failClosed(code: ExternalObservationIngressErrorCodeV0, detail: string): never {
  throw new ExternalObservationIngressErrorV0(code, detail);
}

/** Deterministic canonical observation ref for the (subject, source, event) identity. */
export async function deriveExternalObservationRefV0(input: {
  readonly subject_id: string;
  readonly source_ref: string;
  readonly event_ref: string;
}): Promise<string> {
  const hash = await hashProjection(EXTERNAL_OBSERVATION_ID_PROJECTION, input);
  return `observation:${hash.replace("sha256:", "")}`;
}

interface NormalizedPayloadV0 {
  readonly source_ref: string;
  readonly event_ref: string;
  readonly entity_refs: readonly string[];
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs: readonly string[];
  readonly environment_refs: readonly string[];
}

function normalize(request: ExternalStructuredObservationRequestV0, entityRefs: readonly string[]): NormalizedPayloadV0 {
  return {
    source_ref: request.source_ref,
    event_ref: request.event_ref,
    entity_refs: [...entityRefs].sort(),
    scene: request.scene,
    task: request.task,
    focus_refs: [...(request.focus_refs ?? [])].sort(),
    environment_refs: [...(request.environment_refs ?? [])].sort()
  };
}

async function payloadFingerprint(payload: NormalizedPayloadV0): Promise<string> {
  return hashProjection(EXTERNAL_OBSERVATION_FINGERPRINT_PROJECTION, payload);
}

function assertRequest(request: ExternalStructuredObservationRequestV0): string[] {
  if (
    typeof request?.source_ref !== "string" ||
    !request.source_ref.startsWith("source:") ||
    request.source_ref.length <= "source:".length
  ) {
    failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", "source_ref must be a non-empty source:<id> ref");
  }
  if (
    typeof request?.event_ref !== "string" ||
    !request.event_ref.startsWith("event:") ||
    request.event_ref.length <= "event:".length
  ) {
    failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", "event_ref must be a non-empty event:<id> ref");
  }
  if (!Array.isArray(request.entity_refs)) {
    failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", "entity_refs must be an array");
  }
  for (const ref of request.entity_refs) {
    if (typeof ref !== "string" || !(ref.startsWith("entity:") || ref.startsWith("subject:"))) {
      failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", `entity_refs entry must be entity:/subject:, got ${String(ref)}`);
    }
  }
  if (typeof request?.scene !== "string" || request.scene.length === 0) {
    failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", "scene must be a non-empty string");
  }
  if (request.task !== null && typeof request.task !== "string") {
    failClosed("EXTERNAL_OBSERVATION_INVALID_REQUEST", "task must be a string or null");
  }
  return [...request.entity_refs].sort();
}

interface CommittedBundleView {
  readonly canonical_proposal?: {
    readonly transition_type?: string;
    readonly cause_refs?: readonly string[];
    readonly external_refs?: readonly string[];
  };
  readonly next_snapshot?: {
    readonly context: {
      readonly scene: string;
      readonly task: string | null;
      readonly focus_refs: readonly string[];
      readonly environment_refs: readonly string[];
      readonly active_entity_refs: readonly string[];
    };
  };
}

/**
 * Authoritative canonical-history dedup: finds the committed external
 * Observation for (source_ref, event_ref) and recomputes its payload
 * fingerprint. No parallel ledger.
 */
async function findPriorExternalObservation(
  bundles: readonly unknown[],
  request: ExternalStructuredObservationRequestV0
): Promise<string | null> {
  for (const candidate of bundles) {
    const bundle = candidate as CommittedBundleView;
    const proposal = bundle.canonical_proposal;
    if (proposal?.transition_type !== "Observation") continue;
    const cause = proposal.cause_refs ?? [];
    const external = proposal.external_refs ?? [];
    // Source lives in the cause lineage; the external event identity is carried
    // as external provenance (never an admitted conversation event cause ref).
    if (!cause.includes(request.source_ref) || !external.includes(request.event_ref)) continue;
    const context = bundle.next_snapshot?.context;
    if (context === undefined) continue;
    return payloadFingerprint({
      source_ref: request.source_ref,
      event_ref: request.event_ref,
      entity_refs: [...context.active_entity_refs].sort(),
      scene: context.scene,
      task: context.task,
      focus_refs: [...context.focus_refs].sort(),
      environment_refs: [...context.environment_refs].sort()
    });
  }
  return null;
}

const neverTransport = {
  complete: async () => {
    throw new Error("external observation ingress: cognition/language transport must not be invoked");
  }
} as unknown as ModelTransportV0;

const neverAppraisal = {
  proposeFactualEventAppraisal: async () => {
    throw new Error("external observation ingress: appraisal provider must not be invoked");
  }
} as unknown as FactualEventAppraisalProviderV0;

/**
 * Reports ONE structured external observation to the shared canonical subject.
 * `FIRST` commits Observation → Experience/Memory → existing adaptation runners
 * and persists through the shared source CAS; `REPLAY`/`CONFLICT` never mutate
 * canonical state.
 */
export async function submitExternalObservationV0(
  deps: ExternalObservationIngressDepsV0,
  request: ExternalStructuredObservationRequestV0,
  options?: { readonly expectedBaseRevision?: number }
): Promise<ExternalObservationIngressOutcomeV0> {
  const entityRefs = assertRequest(request);
  const observationRef = await deriveExternalObservationRefV0({
    subject_id: deps.subject.subject_id,
    source_ref: request.source_ref,
    event_ref: request.event_ref
  });
  const fingerprint = await payloadFingerprint(normalize(request, entityRefs));

  const resolvePrior = async (): Promise<ExternalObservationIngressOutcomeV0 | null> => {
    const loaded = await deps.sharedSourceStore.load();
    if (loaded.kind === "NONE") {
      failClosed("EXTERNAL_OBSERVATION_NO_SUBJECT", `no shared canonical subject for ${deps.subject.subject_id}`);
    }
    if (loaded.document.subject_id !== deps.subject.subject_id) {
      failClosed("EXTERNAL_OBSERVATION_NO_SUBJECT", "shared source belongs to a different subject");
    }
    const source = await rebuildSessionStoreSourceV0(loaded.document.store);
    const priorFingerprint = await findPriorExternalObservation(source.bundles, request);
    if (priorFingerprint === null) return null;
    if (priorFingerprint === fingerprint) {
      return { kind: "REPLAY", observation_ref: observationRef, base_revision: loaded.document.base_revision };
    }
    return {
      kind: "CONFLICT",
      detail: `${request.source_ref} ${request.event_ref} already exists with a different semantic payload`
    };
  };

  const alreadySeen = await resolvePrior();
  if (alreadySeen !== null) return alreadySeen;

  // FIRST — authoritative restore of the shared subject, then commit.
  const loaded = await deps.sharedSourceStore.load();
  if (loaded.kind !== "DOCUMENT") failClosed("EXTERNAL_OBSERVATION_NO_SUBJECT", "shared subject missing");
  const document = loaded.document;
  if (document.durable.personality_adaptation_state != null && deps.personalityAdaptationFactory === undefined) {
    failClosed(
      "EXTERNAL_OBSERVATION_ADAPTER_STATE_UNAVAILABLE",
      "durable personality-adaptation state exists but no personalityAdaptationFactory was supplied"
    );
  }
  const deliveryLedger = new InMemoryConversationDeliveryLedger();
  const ingressLedger = new InMemoryConversationIngressLedger();
  const deliveryRestore = await (
    deliveryLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }
  ).restoreState(document.durable.delivery_ledger_state);
  const ingressRestore = await (
    ingressLedger as unknown as { restoreState(state: unknown): Promise<{ ok: boolean }> }
  ).restoreState(document.durable.ingress_ledger_state);
  if (!deliveryRestore.ok || !ingressRestore.ok) {
    failClosed("EXTERNAL_OBSERVATION_NO_SUBJECT", "durable ledger state could not be restored");
  }
  const source = await rebuildSessionStoreSourceV0(document.store);
  const { authority } = await ExplicitV4SessionAuthorityV0.restoreFromDurableState(
    {
      subject: {
        subject_id: deps.subject.subject_id,
        display_name: deps.subject.display_name,
        identity_anchors: [...deps.subject.identity_anchors]
      },
      v3_source: createInteractiveSubjectSeedV0(
        deps.subject.subject_id,
        deps.subject.display_name,
        [...deps.subject.identity_anchors]
      ),
      conversationCognitionTransport: deps.conversationCognitionTransport ?? neverTransport,
      languageTransport: deps.languageTransport ?? neverTransport,
      factualEventAppraisalProvider: deps.factualEventAppraisalProvider ?? neverAppraisal,
      deliveryLedger,
      ingressLedger,
      ...(deps.beliefSemanticProvider === undefined ? {} : { beliefSemanticProvider: deps.beliefSemanticProvider }),
      ...(deps.personalityAdaptationFactory === undefined
        ? {}
        : { personalityAdaptationFactory: deps.personalityAdaptationFactory }),
      ...(deps.relationshipFamiliarityAdmissionProvider === undefined
        ? {}
        : { relationshipFamiliarityAdmissionProvider: deps.relationshipFamiliarityAdmissionProvider }),
      ...(deps.clock === undefined ? {} : { clock: deps.clock })
    } as never,
    document.durable,
    source as never
  );

  const committed = await authority.commitExternalObservation({
    observation_id: observationRef,
    source_refs: [request.source_ref],
    external_refs: [request.event_ref],
    entity_refs: entityRefs,
    scene: request.scene,
    task: request.task,
    focus_refs: [...(request.focus_refs ?? [])].sort(),
    environment_refs: [...(request.environment_refs ?? [])].sort(),
    declaredSalience: request.declared_salience ?? 0.5
  });

  // Level 9 — offer the COMPLETED observation-sourced episode to the SAME
  // existing lived-evidence runners (never the raw observation). Each domain
  // decides COMMIT/NO_OP/ABSTAIN/DISABLED.
  await authority.runLivedEvidenceBeliefAdaptation([committed.episode_ref]);
  await authority.runLivedEvidencePersonalityAdaptation([committed.episode_ref]);
  await authority.runLivedEvidenceRelationshipFamiliarity([committed.episode_ref]);

  const durable = await authority.captureDurableState([
    ...document.durable.identity.episode_refs,
    committed.episode_ref
  ]);
  const store = await captureSessionStoreImageV0(authority.durableSource());
  try {
    const canonical = await persistCanonicalSubjectV0({
      sharedStore: deps.sharedSourceStore,
      subjectId: deps.subject.subject_id,
      durable,
      store,
      expectedBaseRevision: options?.expectedBaseRevision ?? document.base_revision,
      updatedAt: (deps.clock ?? (() => new Date().toISOString()))()
    });
    return {
      kind: "FIRST",
      observation_ref: observationRef,
      observation_transition_id: committed.observation_transition_id,
      episode_ref: committed.episode_ref,
      base_revision: canonical.base_revision
    };
  } catch (error) {
    // A concurrent writer advanced the shared subject first: the local commit is
    // discarded and the authoritative head is re-read (no second experience).
    const resolved = await resolvePrior();
    if (resolved !== null) return resolved;
    throw error;
  }
}

export { sha256Hex };
