/**
 * SUBJECT_EXPLICIT_TIME_ADVANCE_PRODUCT_V0 — explicit canonical tick advance.
 *
 * ONE bounded product seam that advances the SAME shared canonical subject by an
 * explicitly requested non-negative number of canonical TICKS, with no human
 * input, no environment interaction and no Observation/Experience/Memory
 * fabrication. It reuses the existing `ExplicitV4SessionAuthorityV0.advanceTime`
 * law (Time transition, affect recovery, regulation `last_update`) and the
 * existing shared canonical subject source (CAS). It never reads a wall clock to
 * decide the tick count: ticks come only from the caller.
 *
 * A canonical tick is an abstract canonical time step — NOT a second, minute or
 * hour. No wall-clock → tick mapping exists or is added here.
 */

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

export type SubjectTimeAdvanceErrorCodeV0 =
  | "SUBJECT_TIME_ADVANCE_INVALID_TICKS"
  | "SUBJECT_TIME_ADVANCE_NO_SUBJECT"
  | "SUBJECT_TIME_ADVANCE_ADAPTER_STATE_UNAVAILABLE"
  | "CROSS_CONTEXT_STALE_WRITE";

export class SubjectTimeAdvanceErrorV0 extends Error {
  constructor(readonly code: SubjectTimeAdvanceErrorCodeV0, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "SubjectTimeAdvanceErrorV0";
  }
}

export interface AdvanceSubjectTimeDepsV0 {
  readonly sharedSourceStore: SharedSubjectSourceStoreV0;
  readonly subject: {
    readonly subject_id: string;
    readonly display_name: string;
    readonly identity_anchors: readonly string[];
  };
  /**
   * Structural-only collaborators for the authoritative restore path (never
   * invoked by a Time advance). Defaults to fail-closed stubs.
   */
  readonly conversationCognitionTransport?: ModelTransportV0;
  readonly languageTransport?: ModelTransportV0;
  readonly factualEventAppraisalProvider?: FactualEventAppraisalProviderV0;
  /** Same optional adaptation providers as the hosts, so durable sub-state round-trips. */
  readonly beliefSemanticProvider?: BeliefSemanticTargetResolutionProviderV0;
  readonly personalityAdaptationFactory?: PersonalityAdaptationFactoryV0;
  readonly relationshipFamiliarityAdmissionProvider?: RelationshipInteractionQualifyingAdmissionProviderV0;
  /** Storage metadata only; NEVER consulted to derive the tick count. */
  readonly clock?: () => string;
}

export interface AdvanceSubjectTimeResultV0 {
  readonly ticks: number;
  readonly no_op: boolean;
  readonly logical_time_before: number;
  readonly logical_time_after: number;
  readonly valence_before: number;
  readonly valence_after: number;
  readonly activation_before: number;
  readonly activation_after: number;
  /** Shared canonical subject revision after this operation. */
  readonly base_revision: number;
  readonly subject_head_commit_ref: string;
}

function failClosed(code: SubjectTimeAdvanceErrorCodeV0, detail: string): never {
  throw new SubjectTimeAdvanceErrorV0(code, detail);
}

/** Existing authority validation law: non-negative safe integer, no coercion. */
export function assertAdvanceTicksV0(ticks: unknown): asserts ticks is number {
  if (typeof ticks !== "number" || !Number.isSafeInteger(ticks) || ticks < 0) {
    failClosed("SUBJECT_TIME_ADVANCE_INVALID_TICKS", `ticks must be a non-negative safe integer, got ${String(ticks)}`);
  }
}

function neverTransport(): ModelTransportV0 {
  return {
    complete: async () => {
      throw new Error("explicit time advance: cognition/language transport must not be invoked");
    }
  } as ModelTransportV0;
}

const neverAppraisal = {
  proposeFactualEventAppraisal: async () => {
    throw new Error("explicit time advance: appraisal provider must not be invoked");
  }
} as unknown as FactualEventAppraisalProviderV0;

/**
 * Advances the shared canonical subject by `ticks`.
 *
 * `expectedBaseRevision` (default: the loaded head) is the CAS base; a stale
 * caller fails closed instead of overwriting newer canonical state.
 */
export async function advanceSubjectTimeV0(
  deps: AdvanceSubjectTimeDepsV0,
  ticks: number,
  options?: { readonly expectedBaseRevision?: number }
): Promise<AdvanceSubjectTimeResultV0> {
  assertAdvanceTicksV0(ticks);
  const loaded = await deps.sharedSourceStore.load();
  if (loaded.kind === "NONE") {
    failClosed("SUBJECT_TIME_ADVANCE_NO_SUBJECT", `no shared canonical subject for ${deps.subject.subject_id}`);
  }
  const document = loaded.document;
  if (document.subject_id !== deps.subject.subject_id) {
    failClosed(
      "SUBJECT_TIME_ADVANCE_NO_SUBJECT",
      `shared source belongs to ${document.subject_id}, not ${deps.subject.subject_id}`
    );
  }
  const identity = document.durable.identity;
  const expectedBaseRevision = options?.expectedBaseRevision ?? document.base_revision;

  // Zero ticks is the existing canonical NO_OP: no commit, no base increment,
  // no persistence write.
  if (ticks === 0) {
    return {
      ticks: 0,
      no_op: true,
      logical_time_before: identity.logical_time,
      logical_time_after: identity.logical_time,
      valence_before: identity.affect.valence,
      valence_after: identity.affect.valence,
      activation_before: identity.affect.activation,
      activation_after: identity.affect.activation,
      base_revision: document.base_revision,
      subject_head_commit_ref: identity.subject_head.commit_ref
    };
  }

  // Fail closed rather than silently dropping durable adaptation sub-state that
  // this restore path cannot reconstruct without its composition factory.
  if (document.durable.personality_adaptation_state != null && deps.personalityAdaptationFactory === undefined) {
    failClosed(
      "SUBJECT_TIME_ADVANCE_ADAPTER_STATE_UNAVAILABLE",
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
    failClosed("SUBJECT_TIME_ADVANCE_NO_SUBJECT", "durable ledger state could not be restored");
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
      conversationCognitionTransport: deps.conversationCognitionTransport ?? neverTransport(),
      languageTransport: deps.languageTransport ?? neverTransport(),
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

  const before = await authority.readSnapshot();
  const advanced = await authority.advanceTime(ticks, `explicit-${ticks}-r${before.runtime_metadata.state_revision}`);
  // Preserve the durable episode-ref ledger this restore path did not change.
  const durable = await authority.captureDurableState(identity.episode_refs);
  const store = await captureSessionStoreImageV0(authority.durableSource());
  const canonical = await persistCanonicalSubjectV0({
    sharedStore: deps.sharedSourceStore,
    subjectId: deps.subject.subject_id,
    durable,
    store,
    expectedBaseRevision,
    updatedAt: (deps.clock ?? (() => new Date().toISOString()))()
  });

  return {
    ticks,
    no_op: false,
    logical_time_before: before.runtime_metadata.logical_time as number,
    logical_time_after: advanced.logical_time_after,
    valence_before: advanced.valence_before,
    valence_after: advanced.valence_after,
    activation_before: before.affect.activation,
    activation_after: advanced.activation_after,
    base_revision: canonical.base_revision,
    subject_head_commit_ref: durable.identity.subject_head.commit_ref
  };
}
