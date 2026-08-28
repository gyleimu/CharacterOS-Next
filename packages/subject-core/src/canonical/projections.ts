/**
 * P2.1.3 — canonical hash projections (pure, asynchronous).
 * Source: docs/implementation/p2-1-contract-freeze.md §8.3 (StateHash), §8.4
 * (SnapshotHash), §8.6 (ProposalFingerprint), §9 (golden vectors).
 *
 * - StateHash covers exactly the 12 non-trace top-level values; the entire
 *   `trace_window` is excluded to avoid self-reference.
 * - SnapshotHash binds StateHash + subject + revision + trace cursor position.
 * - The full-persistence checksum covers the complete snapshot including trace_window.
 * - ProposalFingerprint covers the canonical semantic proposal WITHOUT transition_id.
 */

import type {
  HashV1,
  StateRevisionV0
} from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { TraceCursorV1 } from "../types/trace.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { canonicalJsonString } from "./json.js";
import { deriveRef, hashEnvelope, sha256HashV1 } from "./hash.js";

const STATE_PROJECTION = "characteros-next/subject-state/state-hash/v1";
const SNAPSHOT_PROJECTION = "characteros-next/subject-state/snapshot-hash/v1";
const FULL_PERSISTENCE_PROJECTION = "characteros-next/subject-state/full-persistence/v1";
const PROPOSAL_FINGERPRINT_PROJECTION = "characteros-next/transition/proposal-fingerprint/v1";
const PROPOSAL_REF_PROJECTION = "characteros-next/transition/proposal-ref/v1";

/** §8.3 — the exact twelve top-level values included in StateHash (trace_window OUT). */
function stateProjectionValue(snapshot: SubjectStateV0): Record<string, unknown> {
  return {
    schema_version: snapshot.schema_version,
    identity: snapshot.identity,
    traits_seed: snapshot.traits_seed,
    personality: snapshot.personality,
    memory_state: snapshot.memory_state,
    beliefs: snapshot.beliefs,
    relationships: snapshot.relationships,
    mood: snapshot.mood,
    affect: snapshot.affect,
    regulation: snapshot.regulation,
    context: snapshot.context,
    mechanism_config: snapshot.mechanism_config,
    runtime_metadata: snapshot.runtime_metadata
  };
}

/** Exact JCS text of the StateHash envelope (evidence/diagnostics parity with §9 vectors). */
export function canonicalStateHashInput(snapshot: SubjectStateV0): string {
  return canonicalJsonString({ projection: STATE_PROJECTION, value: stateProjectionValue(snapshot) });
}

/** §8.3 StateHash of a complete canonical snapshot. */
export function stateHash(snapshot: SubjectStateV0): Promise<HashV1> {
  return hashEnvelope(STATE_PROJECTION, stateProjectionValue(snapshot));
}

export interface SnapshotHashInput {
  readonly state_hash: HashV1;
  readonly subject_id: string;
  readonly state_revision: StateRevisionV0 | number;
  readonly trace_cursor: TraceCursorV1;
  readonly last_trace_ref: CanonicalRefV0 | null;
}

function snapshotValue(input: SnapshotHashInput): Record<string, unknown> {
  return {
    last_trace_ref: input.last_trace_ref,
    state_hash: input.state_hash,
    state_revision: input.state_revision,
    subject_id: input.subject_id,
    trace_cursor: input.trace_cursor
  };
}

/** Exact JCS text of the SnapshotHash envelope (evidence/diagnostics parity with §9 vectors). */
export function canonicalSnapshotHashInput(input: SnapshotHashInput): string {
  return canonicalJsonString({ projection: SNAPSHOT_PROJECTION, ...snapshotValue(input) });
}

/** §8.4 SnapshotHash — flat closed envelope; `projection` sits beside the fields (§9.2). */
export function snapshotHash(input: SnapshotHashInput): Promise<HashV1> {
  return sha256HashV1(canonicalSnapshotHashInput(input));
}

/** Full-persistence integrity checksum over the complete snapshot (incl. trace_window). */
export function fullSnapshotChecksum(snapshot: SubjectStateV0): Promise<HashV1> {
  return hashEnvelope(FULL_PERSISTENCE_PROJECTION, snapshot);
}

/** §8.6 ProposalFingerprint — canonical semantic proposal without transition_id. */
export function proposalFingerprint(proposal: CanonicalTransitionProposalV1): Promise<HashV1> {
  const value = {
    schema_version: proposal.schema_version,
    subject_id: proposal.subject_id,
    transition_type: proposal.transition_type,
    expected_state_revision: proposal.expected_state_revision,
    time_input: proposal.time_input,
    cause_refs: proposal.cause_refs,
    domain_deltas: proposal.domain_deltas,
    external_refs: proposal.external_refs
  };
  return hashEnvelope(PROPOSAL_FINGERPRINT_PROJECTION, value);
}

/**
 * §8.6 ProposalRef — derived separately from the COMPLETE admitted proposal INCLUDING
 * transition_id; intentionally a different projection from the fingerprint.
 */
export function proposalRef(proposal: CanonicalTransitionProposalV1): Promise<CanonicalRefV0> {
  return deriveRef("proposal", PROPOSAL_REF_PROJECTION, proposal) as Promise<CanonicalRefV0>;
}
