/**
 * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — FactualMemoryEvidenceResolverV0.
 *
 * Resolves AUTHORITATIVE factual memory evidence for the cognition context,
 * running BEFORE cognition provider invocation. Inputs are refs only, and ONLY
 * from lawful sources: the canonical `memory_state.working_refs` and/or the
 * current invocation's already-validated retrieval selections (the cognition
 * executor supplies them; product/test callers never supply
 * `experience_refs` directly).
 *
 * Closed factual evidence union — FACT, NEVER INTERPRETATION:
 *   - BEHAVIOR_OUTCOME: a fully verified feedback Experience (episode →
 *     experience → event → delivery → behavior artifact, every hash/ref/linkage
 *     re-verified through the ONE ExperienceReaderV0). Carries the exact reply
 *     text and the exact delivered behavior text — never approval, rejection,
 *     sentiment, reward, trust or success/failure semantics.
 *   - EPISODE_SCENE: an ordinary (non-Experience) episode's factual scene copy.
 *
 * FAIL-CLOSED LAW (§10): for an episode that claims Experience linkage, ANY
 * validation failure (hash mismatch, broken linkage, delivery mismatch) throws —
 * the provider is never invoked. Only refs that cannot be resolved as bound
 * episodes at all (legacy/unbound refs still carried by older paths) are SKIPPED,
 * preserving exact V0 behavior for existing callers (§15). A malformed
 * Experience episode NEVER falls back to scene-only evidence.
 */

import type { CanonicalRefV0, HashV1, LogicalTimeV0 } from "@characteros-next/subject-core";
import { isRecord, refKind, validateRefArray } from "@characteros-next/subject-core";
import type { EpisodeContentReaderV0, InMemoryMemoryRepository } from "@characteros-next/memory";
import type { RepositoryRevisionIdV0 } from "@characteros-next/subject-core";
import type { ExperienceReaderV0 } from "../conversation/experience-reader.js";

export const FACTUAL_MEMORY_EVIDENCE_SCHEMA_VERSION = "factual-memory-evidence-v0" as const;

/** Fully verified feedback-Experience factual evidence (facts only). */
export interface FactualBehaviorOutcomeEvidenceV0 {
  readonly kind: "BEHAVIOR_OUTCOME";
  readonly episode_ref: CanonicalRefV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly episode_payload_hash: HashV1;
  readonly experience_ref: CanonicalRefV0;
  readonly experience_payload_hash: HashV1;
  readonly event_ref: CanonicalRefV0;
  readonly event_payload_hash: HashV1;
  readonly actor_ref: CanonicalRefV0;
  /** Exact delivered behavior text (artifact-verified). */
  readonly delivered_behavior_text: string;
  /** Exact historical reply text — factual, never classified. */
  readonly exact_outcome_text: string;
  readonly delivered_logical_time: LogicalTimeV0;
  readonly outcome_logical_time: LogicalTimeV0;
}

/** Ordinary non-Experience episode factual evidence (scene copy). */
export interface FactualEpisodeSceneEvidenceV0 {
  readonly kind: "EPISODE_SCENE";
  readonly episode_ref: CanonicalRefV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly episode_payload_hash: HashV1;
  readonly scene: string;
}

export type FactualMemoryEvidenceEntryV0 =
  | FactualBehaviorOutcomeEvidenceV0
  | FactualEpisodeSceneEvidenceV0;

export interface FactualMemoryEvidenceBundleV0 {
  readonly schema_version: typeof FACTUAL_MEMORY_EVIDENCE_SCHEMA_VERSION;
  readonly repository_revision: RepositoryRevisionIdV0;
  /** Entries sorted by episode_ref (deterministic). */
  readonly entries: readonly FactualMemoryEvidenceEntryV0[];
}

/** Refs-only resolution request (the caller never supplies evidence content). */
export interface FactualMemoryEvidenceRequestV0 {
  readonly repository_revision: RepositoryRevisionIdV0;
  /** Episode refs from canonical working refs and/or validated retrieval selections. */
  readonly episode_refs: readonly CanonicalRefV0[];
}

/** Narrow read surface the resolver depends on (the ONE Experience reader). */
export interface FactualMemoryEvidenceDepsV0 {
  readonly reader: ExperienceReaderV0;
  /** Optional ordinary-episode scene reader (existing episode content reader). */
  readonly episodeContentReader: EpisodeContentReaderV0 | null;
  /**
   * Optional concrete repository probe (§31 wrong-revision law): when wired, a
   * ref unbound in the queried revision but bound in ANOTHER revision of the
   * same store is a stale-revision claim and FAILS CLOSED before any provider
   * invocation. A ref bound NOWHERE (legacy fixture ref) is skipped, preserving
   * exact V0 behavior for existing callers (§15/§32).
   */
  readonly store?: InMemoryMemoryRepository | null;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/** Experience-reader failures that mean "corrupt/malformed" — fail closed. */
const FAIL_CLOSED_CODES: ReadonlySet<string> = new Set([
  "PAYLOAD_HASH_MISMATCH",
  "PAYLOAD_SCHEMA_INVALID",
  "EXPERIENCE_LINKAGE_INVALID",
  "EVENT_LINKAGE_INVALID",
  "DELIVERY_LINKAGE_INVALID"
]);

/**
 * Deterministic resolver. One bound episode ⇒ at most one evidence entry;
 * entries sorted by episode_ref; the bundle is deep-frozen. Throws on any
 * fail-closed condition — the caller (cognition executor) must NOT invoke the
 * provider afterwards.
 */
export class FactualMemoryEvidenceResolverV0 {
  constructor(private readonly deps: FactualMemoryEvidenceDepsV0) {
    if (deps.reader === undefined || deps.reader === null) {
      throw new Error("factual memory evidence resolver: experience reader required");
    }
  }

  async resolve(input: unknown): Promise<FactualMemoryEvidenceBundleV0> {
    if (!isRecord(input)) {
      throw new Error("factual memory evidence resolver: request expected object");
    }
    if (typeof input["repository_revision"] !== "string" || input["repository_revision"].length === 0) {
      throw new Error("factual memory evidence resolver: repository_revision required");
    }
    const refsCheck = validateRefArray(input["episode_refs"], "resolver.episode_refs", {
      kinds: ["episode"],
      sorted: true
    });
    if (!refsCheck.ok) {
      throw new Error(`factual memory evidence resolver: ${refsCheck.error.detail}`);
    }
    const repositoryRevision = input["repository_revision"] as RepositoryRevisionIdV0;
    const episodeRefs = input["episode_refs"] as readonly CanonicalRefV0[];

    const entries: FactualMemoryEvidenceEntryV0[] = [];
    for (const episodeRef of episodeRefs) {
      const read = await this.deps.reader.read({ repository_revision: repositoryRevision, episode_ref: episodeRef });
      if (read.ok) {
        const behavior = read.behavior as { readonly text: string };
        entries.push({
          kind: "BEHAVIOR_OUTCOME",
          episode_ref: episodeRef,
          repository_revision: repositoryRevision,
          episode_payload_hash: read.hashes.episode,
          experience_ref: read.experience.experience_ref,
          experience_payload_hash: read.hashes.experience,
          event_ref: read.event.event_ref,
          event_payload_hash: read.hashes.event,
          actor_ref: read.event.actor_ref,
          delivered_behavior_text: behavior.text,
          exact_outcome_text: read.event.text,
          delivered_logical_time: read.experience.delivered_logical_time,
          outcome_logical_time: read.experience.outcome_logical_time
        });
        continue;
      }
      if (read.code === "NOT_EXPERIENCE_EPISODE") {
        // Ordinary episode: preserve the existing factual scene evidence path.
        if (this.deps.episodeContentReader === null) {
          throw new Error("factual memory evidence resolver: episode content reader not wired for ordinary episode");
        }
        const scene = await this.deps.episodeContentReader.read({
          repository_revision: repositoryRevision,
          refs: [episodeRef]
        });
        if (!scene.ok) {
          throw new Error(
            `factual memory evidence resolver: ordinary episode ${episodeRef} failed scene read (${scene.code}: ${scene.detail})`
          );
        }
        const sceneContent = scene.contents[0];
        if (sceneContent === undefined) {
          throw new Error(`factual memory evidence resolver: ordinary episode ${episodeRef} produced no content`);
        }
        entries.push({
          kind: "EPISODE_SCENE",
          episode_ref: episodeRef,
          repository_revision: repositoryRevision,
          episode_payload_hash: sceneContent.payload_hash as never,
          scene: sceneContent.scene
        });
        continue;
      }
      if (FAIL_CLOSED_CODES.has(read.code)) {
        // A search hit never establishes truth: a malformed Experience episode
        // fails closed — the provider is never invoked (§10/§30).
        throw new Error(`factual memory evidence resolver: episode ${episodeRef} failed closed (${read.code}: ${read.detail})`);
      }
      // §31 wrong-revision law: an unbound ref that IS bound in another revision
      // of the same store is a stale-revision claim — fail closed before any
      // provider invocation. A ref bound NOWHERE (legacy fixture ref) is skipped
      // — exact V0 compatibility for pre-existing callers (§15/§32).
      if (this.deps.store !== undefined && this.deps.store !== null) {
        const boundElsewhere = await this.isBoundInAnyRevision(this.deps.store, episodeRef);
        if (boundElsewhere) {
          throw new Error(
            `factual memory evidence resolver: episode ${episodeRef} is not bound to revision ${repositoryRevision} (stale-revision claim; fail closed)`
          );
        }
      }
    }

    entries.sort((a, b) => (a.episode_ref < b.episode_ref ? -1 : a.episode_ref > b.episode_ref ? 1 : 0));
    const bundle: FactualMemoryEvidenceBundleV0 = {
      schema_version: FACTUAL_MEMORY_EVIDENCE_SCHEMA_VERSION,
      repository_revision: repositoryRevision,
      entries
    };
    deepFreeze(bundle);
    return bundle;
  }

  /** True when the ref is bound by SOME manifest in the store (§31 probe). */
  private async isBoundInAnyRevision(
    store: InMemoryMemoryRepository,
    ref: CanonicalRefV0
  ): Promise<boolean> {
    for (const revision of store.revisionIds()) {
      const manifest = await store.readManifest(revision);
      if (manifest === null) continue;
      if (manifest.record_hashes.some((entry) => entry.ref === ref)) return true;
    }
    return false;
  }
}

/** Runtime type guard for the closed evidence union (renderer/paths). */
export function isFactualBehaviorOutcomeEvidenceV0(
  entry: FactualMemoryEvidenceEntryV0
): entry is FactualBehaviorOutcomeEvidenceV0 {
  return entry.kind === "BEHAVIOR_OUTCOME";
}

/** Ref kind guard helper reused by the executor evidence path. */
export function isEpisodeRefV0(ref: CanonicalRefV0): boolean {
  return refKind(ref) === "episode";
}
