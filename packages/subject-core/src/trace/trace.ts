/**
 * P2.1.3 — TraceEntry construction and trace_window projection (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §10.1–§10.3.
 *
 * One successful canonical commit produces exactly one immutable multi-domain
 * TraceEntryV1 whose `trace_id` is deterministic SHA-256/JCS over the body without the
 * id. DomainMutationSummaries are created one-per-delta in `(domain,producer)` order;
 `layers` is the unique raw-ASCII-sorted set of each delta's canonical layer names and
 * `field_changes` lists that delta's SET operations sorted by path. The window keeps
 * the newest min(revision, 64) entries; eviction position follows §10.3 invariant 5.
 */

import type { HashV1 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { RequirementId } from "../types/enums.js";
import type { TraceLayerName } from "../types/trace.js";
import type {
  DomainMutationSummaryV1,
  TraceEntryV1,
  TraceWindowV1
} from "../types/trace.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { deriveRef } from "../canonical/hash.js";

const TRACE_ID_PROJECTION = "characteros-next/trace/entry-id/v1";

/** §10.2 exact lexicographically sorted constant rule_ids for every V0 committed entry. */
export const TRACE_RULE_IDS: readonly RequirementId[] = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

const TRACE_WINDOW_CAPACITY = 64;

function layerForPath(path: string): TraceLayerName | undefined {
  if (path === "/mood") return "mood";
  if (path === "/affect") return "affect";
  if (path === "/regulation") return "regulation";
  if (path === "/context") return "context";
  if (path === "/personality") return "personality";
  if (path.startsWith("/memory_state/")) return "memory_state";
  return undefined;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function summarizeDomainMutations(
  proposal: CanonicalTransitionProposalV1
): DomainMutationSummaryV1[] {
  const deltas = [...proposal.domain_deltas].sort(
    (a, b) => compareStrings(a.domain, b.domain) || compareStrings(a.producer, b.producer)
  );
  return deltas.map((delta) => {
    const layers = [
      ...new Set(
        delta.operations
          .map((operation) => layerForPath(operation.path))
          .filter((layer): layer is TraceLayerName => layer !== undefined)
      )
    ].sort(compareStrings);
    const fieldChanges = [...delta.operations]
      .sort((a, b) => compareStrings(a.path, b.path))
      .map((operation) => ({ path: operation.path, operation: "SET" as const }));
    return {
      producer: delta.producer,
      domain: delta.domain,
      layers,
      field_changes: fieldChanges
    };
  });
}

export interface TraceEntryInput {
  readonly proposal: CanonicalTransitionProposalV1;
  /** §8.6 proposal ref of the complete admitted proposal (incl. transition_id). */
  readonly proposal_ref: CanonicalRefV0;
  readonly revision_before: number;
  readonly revision_after: number;
  readonly logical_time: number;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly memory_revision_before: string;
  readonly memory_revision_after: string;
}

/** Builds one deterministic committed TraceEntryV1 (§10.2). */
export async function buildTraceEntry(input: TraceEntryInput): Promise<TraceEntryV1> {
  const p = input.proposal;
  const body = {
    trace_schema_version: "trace-v1" as const,
    transition_id: p.transition_id,
    transition_type: p.transition_type,
    subject_id: p.subject_id,
    history_sequence: input.revision_after,
    subject_revision_before: input.revision_before,
    subject_revision_after: input.revision_after,
    logical_time: input.logical_time,
    rule_ids: TRACE_RULE_IDS,
    cause_refs: p.cause_refs,
    proposal_ref: input.proposal_ref,
    domain_mutations: summarizeDomainMutations(p),
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    memory_revision_before: input.memory_revision_before,
    memory_revision_after: input.memory_revision_after,
    outcome: "COMMITTED" as const
  };
  const traceId = (await deriveRef("trace", TRACE_ID_PROJECTION, body)) as CanonicalRefV0;
  return {
    ...body,
    trace_id: traceId
  } as unknown as TraceEntryV1;
}

/**
 * §10.3 — appends the new entry and projects the bounded window: newest
 * min(newRevision, 64) entries; offload position = newRevision - capacity with the
 * last evicted entry's ref once eviction begins.
 */
export function nextTraceWindow(
  current: TraceWindowV1,
  entry: TraceEntryV1,
  newRevision: number
): TraceWindowV1 {
  const combined = [...current.entries, entry];
  let kept = combined;
  const offloadedSequence = Math.max(0, newRevision - TRACE_WINDOW_CAPACITY);
  let offloadedRef: CanonicalRefV0 | null = null;
  if (combined.length > TRACE_WINDOW_CAPACITY) {
    const overflow = combined.length - TRACE_WINDOW_CAPACITY;
    const evicted = combined.slice(0, overflow);
    kept = combined.slice(overflow);
    offloadedRef = evicted[evicted.length - 1]?.trace_id ?? null;
  }
  // Boundary cast: cursor scalars are the same integers under V0 sequence branding.
  return {
    trace_window_schema_version: "trace-window-v1",
    capacity: TRACE_WINDOW_CAPACITY,
    cursor: {
      last_history_sequence: newRevision,
      offloaded_through_sequence: offloadedSequence,
      offloaded_through_trace_ref: offloadedRef
    },
    entries: kept
  } as unknown as TraceWindowV1;
}

/** Last committed trace ref of a window, or null for S0 (§8.4). */
export function lastTraceRef(window: TraceWindowV1): CanonicalRefV0 | null {
  const last = window.entries[window.entries.length - 1];
  return last !== undefined ? last.trace_id : null;
}
