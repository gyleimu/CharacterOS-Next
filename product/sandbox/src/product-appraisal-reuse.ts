/**
 * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — turn-local exact-request reuse.
 *
 * Within ONE human turn the frozen runtime lawfully performs TWO semantic
 * Appraisal invocations over DIFFERENT event identities whose model-facing
 * requests can be byte-identical (the current-primary event and the prior-reply
 * event share the same observable scene and task). This port lets the SECOND
 * invocation reuse the FIRST's already-validated narrow model candidate instead
 * of paying a duplicate local inference.
 *
 * What is reused: ONLY the seven model-generated candidate fields, and only
 * after the strict product parser accepted them. Never a proposal, trusted ref,
 * context hash, evidence list, transition identity, receipt, capability or
 * canonical record — the product adapter always rebuilds every authority field
 * from event B's own trusted context.
 *
 * Scope: same process, same subject, same human turn, same effective
 * provider/model configuration, same complete model-facing request identity.
 * The scope is opened/closed by the product turn lifecycle, so nothing survives
 * turn end, turn failure, runtime failure or process restart, and nothing is
 * ever persisted or shared across subjects.
 *
 * Validated by APPRAISAL_EXACT_INPUT_REUSE_SHADOW_VALIDATION_V1 (20/20 combined
 * V0+V1 pairs: exact request identity, exact candidate equality, equivalent
 * authority/canonical/Affect/downstream cognition, all firewalls FAIL CLOSED).
 */

import { createHash } from "node:crypto";

/** The narrow, model-generated appraisal candidate (the ONLY reusable unit). */
export interface ReusableAppraisalCandidateV0 {
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly attribution: string;
  readonly controllability: number;
  readonly uncertainty: number;
  readonly intensity: number;
  readonly assessment_confidence: number;
}

export interface AppraisalReuseScopeV0 {
  readonly subject_id: string;
  readonly turn_index: number;
  readonly provider_fingerprint: string;
}

export interface AppraisalReuseCountersV0 {
  /** Provider-level semantic Appraisal invocations observed (never reduced). */
  readonly semantic_invocations: number;
  /** Real model inferences issued for Appraisal. */
  readonly real_inferences: number;
  /** Second invocations that reused an identical-request candidate. */
  readonly reuse_hits: number;
  /** Invocations with an active candidate but a DIFFERENT complete request. */
  readonly reuse_misses: number;
  /** Invocations where no turn scope was open (no reuse possible). */
  readonly reuse_unavailable: number;
  /** Candidates offered to the port (strict-parser valid, from real inference). */
  readonly candidates_stored: number;
}

/** Deterministic canonical form: object keys sorted, array order preserved. */
export function normalizedAppraisalValueV0(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(normalizedAppraisalValueV0).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${normalizedAppraisalValueV0((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

/** Complete model-facing request identity for the appraisal call. */
export function appraisalRequestIdentityV0(
  messages: readonly { readonly role: string; readonly content: string }[]
): string {
  return normalizedAppraisalValueV0({
    domain: "characteros-next/product/appraisal-exact-input-reuse/v0/request",
    messages: messages.map((message) => ({ role: message.role, content: message.content }))
  });
}

export function appraisalRequestFingerprintV0(identity: string): string {
  return `sha256:${createHash("sha256").update(identity, "utf8").digest("hex")}`;
}

/**
 * Effective provider/model configuration identity. The transport supplies model,
 * thinking mode, streaming and generation options from its own fixed config, so
 * this fingerprint plus the request messages is the complete inference identity.
 */
export function appraisalProviderFingerprintV0(input: {
  readonly endpoint: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly num_predict: number;
  readonly context_window_tokens: number;
  readonly system_prompt: string;
}): string {
  return appraisalRequestFingerprintV0(
    normalizedAppraisalValueV0({
      domain: "characteros-next/product/appraisal-exact-input-reuse/v0/provider",
      ...input
    })
  );
}

interface ReuseEntryV0 {
  readonly identity: string;
  readonly fingerprint: string;
  readonly candidate: ReusableAppraisalCandidateV0;
}

/**
 * Process-local, turn-scoped reuse port. Constructed once per product provider
 * bundle (which is per subject and per process), so cross-subject and restart
 * reuse are structurally impossible.
 */
export class AppraisalInferenceReuseV0 {
  private scope: AppraisalReuseScopeV0 | null = null;
  private entry: ReuseEntryV0 | null = null;
  private semanticInvocations = 0;
  private realInferences = 0;
  private reuseHits = 0;
  private reuseMisses = 0;
  private reuseUnavailable = 0;
  private candidatesStored = 0;

  constructor(
    /** Product rollout flag; false keeps the original independent-inference path. */
    readonly enabled: boolean,
    /** This bundle's effective provider/model identity. */
    private readonly providerFingerprint: string,
    /** Optional observability hook invoked on each reuse hit. */
    private readonly onReuseHit?: () => void
  ) {}

  /** Opens the turn scope and drops any previous turn's entry. */
  beginTurn(scope: { readonly subject_id: string; readonly turn_index: number }): void {
    this.entry = null;
    this.scope = {
      subject_id: scope.subject_id,
      turn_index: scope.turn_index,
      provider_fingerprint: this.providerFingerprint
    };
  }

  /** Closes the scope on turn completion, failure, runtime failure or shutdown. */
  endTurn(): void {
    this.scope = null;
    this.entry = null;
  }

  noteSemanticInvocation(): void {
    this.semanticInvocations += 1;
  }

  /**
   * Consults reuse BEFORE any inference. Returns a detached copy of the cached
   * candidate only for an exact complete-request identity match inside the
   * current, matching scope; otherwise null (normal independent inference).
   */
  take(identity: string): ReusableAppraisalCandidateV0 | null {
    if (!this.enabled) return null;
    if (this.scope === null || this.scope.provider_fingerprint !== this.providerFingerprint) {
      this.reuseUnavailable += 1;
      return null;
    }
    const entry = this.entry;
    // No candidate yet in this turn: this invocation is the producer, not a
    // missed opportunity.
    if (entry === null) return null;
    if (entry.identity === identity) {
      this.reuseHits += 1;
      this.onReuseHit?.();
      return { ...entry.candidate };
    }
    this.reuseMisses += 1;
    return null;
  }

  /**
   * Offers a candidate AFTER a real inference whose response passed the strict
   * product parser. Candidates are only ever stored while a turn scope is open,
   * so a failed/malformed first appraisal (which aborts its turn) can never
   * leave reusable state behind.
   */
  offer(identity: string, candidate: ReusableAppraisalCandidateV0): void {
    // Real-inference accounting is independent of the rollout switch (P7): with
    // reuse OFF every semantic invocation is also a real inference.
    this.realInferences += 1;
    if (!this.enabled) return;
    if (this.scope === null || this.scope.provider_fingerprint !== this.providerFingerprint) return;
    this.entry = { identity, fingerprint: appraisalRequestFingerprintV0(identity), candidate: { ...candidate } };
    this.candidatesStored += 1;
  }

  /** Real inference accounting that produced no reusable candidate. */
  noteInferenceWithoutCandidate(): void {
    this.realInferences += 1;
  }

  activeScope(): AppraisalReuseScopeV0 | null {
    return this.scope;
  }

  counters(): AppraisalReuseCountersV0 {
    return {
      semantic_invocations: this.semanticInvocations,
      real_inferences: this.realInferences,
      reuse_hits: this.reuseHits,
      reuse_misses: this.reuseMisses,
      reuse_unavailable: this.reuseUnavailable,
      candidates_stored: this.candidatesStored
    };
  }
}
