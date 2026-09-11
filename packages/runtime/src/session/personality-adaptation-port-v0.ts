/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — dependency-inversion port.
 *
 * The concrete lived-evidence → Personality plasticity orchestration lives in
 * `@characteros-next/personality`, which already depends on this runtime (for
 * the frozen proposal/executor contracts). To avoid a package cycle, the session
 * runtime does NOT import that package: it accepts an opaque port via a factory
 * supplied by the composition layer (product host).
 *
 * The port owns no canonical authority of its own; it receives the session's
 * subject-scoped authorities (same subject core, same memory repository, same
 * producer issuer) and may only sequence the frozen personality chain.
 */

import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";

import type { SubjectCorePort } from "../ports/subject-core-port.js";

export interface PersonalityAdaptationAuthoritiesV0 {
  /** Subject-scoped canonical core: reads the SAME subject as the repository. */
  readonly subjectCore: SubjectCorePort;
  /** Subject-scoped memory repository (membership verdicts + canonical payloads). */
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  /** Canonical episode payload reader (fail-closed when a ref is unreadable). */
  readonly readEpisodePayload: (ref: string) => Promise<unknown>;
}

export interface PersonalityAdaptationPortV0 {
  /** Offer already-committed canonical episodes; never mutates on failure. */
  runForEpisodeRefs(input: {
    readonly subject_id: string;
    readonly episode_refs: readonly string[];
  }): Promise<unknown>;
  /** Serialize the durable idempotency ledger with the session. */
  exportState(): unknown;
  restoreState(state: unknown): Promise<
    { readonly ok: true } | { readonly ok: false; readonly detail: string }
  >;
}

/** Composition-layer factory: builds the concrete port from session authorities. */
export type PersonalityAdaptationFactoryV0 = (
  authorities: PersonalityAdaptationAuthoritiesV0
) => PersonalityAdaptationPortV0;
