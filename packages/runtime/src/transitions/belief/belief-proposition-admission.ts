/**
 * Belief Proposition Admission V0 — the missing first-formation link.
 *
 * WHY THIS EXISTS (architecture slice, not a research result): before this module the
 * canonical Belief catalog of a normal genesis subject was PERMANENTLY empty. The frozen
 * plasticity producer handles only `EXISTING_PROPOSITION ± 0.05` and explicitly rejects
 * `NEW_PROPOSITION_CANDIDATE` as `INELIGIBLE_SEMANTIC_KIND`, genesis is the frozen empty
 * state, and no production module constructed an INSERT. With zero propositions there was
 * never an EXISTING target, so credence could never move and the cognition consumer always
 * rendered `showing 0 of 0 canonical belief item(s)`. This module opens exactly that door
 * and nothing else.
 *
 * AUTHORITY (frozen; nothing here widens it):
 *   model/provider → semantic proposal only: `NEW_PROPOSITION_CANDIDATE` + `proposed_label`.
 *   HOST → evidence admission, proposition identity, canonical label, initial numeric state.
 * The provider can never supply a `proposition_key`, `initial_credence`, `next_credence`,
 * delta or relation, and this module never reads one.
 *
 * LAWS (V0):
 *   canonical label   = Unicode NFC → trim → collapse internal whitespace → reject empty.
 *                       NO lowercase rewriting, NO negation removal, NO paraphrase, NO word
 *                       reordering, NO synonym merge, NO embedding/LLM dedup.
 *   proposition key   = hashEnvelope(BELIEF_PROPOSITION_KEY_PROJECTION, {canonical_label}) —
 *                       content-addressed, process-independent, replay-stable; never random,
 *                       never time-based, never a counter, never model-supplied.
 *   initial credence  = the Belief domain's frozen stance-zero point (`stance(c) = 2c - 1`
 *                       ⇒ c = 0.5) plus the frozen `BELIEF_PLASTICITY_STEP` for the
 *                       supporting evidence admitted with it ⇒ 0.55. That 0.5 is the
 *                       Belief-domain zero-stance point ONLY — it is NOT a claim that 0.5 is
 *                       neutral in any other domain.
 *   exact duplicate   = same canonical label ⇒ same key ⇒ same identity ⇒ NO second INSERT;
 *                       the event routes to the existing proposition's frozen ±0.05 plasticity.
 *                       For a semantic NEW candidate this route is the host law
 *                       `BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0` (SUPPORTS) — the
 *                       provider supplies NO relation for a NEW candidate and the host never
 *                       invents CONTRADICTS.
 *   near duplicates   = OUT OF SCOPE V0 (`NEAR_DUPLICATE_CANONICALIZATION_V0`); textually
 *                       different labels stay distinct propositions by design.
 *   atomicity         = proposition + 0.55 credence + evidence binding become durable in ONE
 *                       governed INSERT transition; no intermediate state is persisted.
 *   decision          = NONE. No arbitration, tendency or action influence.
 *   cross-domain      = NONE. Affect, Relationship and Personality values are never read.
 */

import type { EpisodeRef } from "@characteros-next/memory";
import {
  deriveBeliefPropositionId,
  fail,
  hashEnvelope,
  validateBeliefPropositionLabel,
  validateIdentifier,
  validateUnitInterval,
  type BeliefStateV0,
  type HashV1,
  type IdentifierV0,
  type ProducerAuthorizationIssuer,
  type StateRevisionV0,
  type SubjectStateAnyVersionV0,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";

import {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  deriveBeliefEvidenceMemberSetFingerprint,
  validateBeliefMutationProposal,
  type BeliefEvidenceBindingV0,
  type BeliefMutationProposalV0
} from "./belief-mutation-proposal.js";
import { BELIEF_PLASTICITY_STEP } from "./belief-plasticity-producer.js";
import { BeliefTransitionExecutor } from "./belief-transition-executor.js";

export const BELIEF_PROPOSITION_ADMISSION_SCHEMA_VERSION =
  "belief-proposition-admission-v0" as const;

/** Frozen identity namespace: the ONE source of proposition-key derivation. */
export const BELIEF_PROPOSITION_KEY_PROJECTION =
  "characteros-next/belief/proposition-key/v1" as const;

/**
 * The Belief domain's frozen stance-zero point. `stance(c) = 2c − 1`, so stance 0 ⇒ c = 0.5.
 * This is a Belief-domain statement only and must never be generalised to other domains.
 */
export const BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE = 0.5 as const;

/** First durable credence: stance-zero point + the frozen supporting-evidence step. */
export const BELIEF_PROPOSITION_FIRST_CREDENCE = 0.55 as const;

/** Documented V0 boundary: textually different labels are never merged. */
export const NEAR_DUPLICATE_CANONICALIZATION_V0 = "OUT_OF_SCOPE_V0" as const;

/**
 * Fingerprint namespace of the host admission OUTPUT (the durable numeric
 * authority for a first formation, symmetric with the frozen plasticity output
 * fingerprint of an update). Deterministic over already-validated host values.
 */
export const BELIEF_PROPOSITION_ADMISSION_OUTPUT_FINGERPRINT_PROJECTION =
  "characteros-next/belief/proposition-admission-output/v1" as const;

export async function deriveBeliefPropositionAdmissionOutputFingerprintV0(input: {
  readonly proposition_key: IdentifierV0;
  readonly canonical_label: string;
  readonly initial_credence: UnitIntervalV0;
  readonly member_refs: readonly EpisodeRef[];
}): Promise<HashV1> {
  return await hashEnvelope(BELIEF_PROPOSITION_ADMISSION_OUTPUT_FINGERPRINT_PROJECTION, {
    schema_version: BELIEF_PROPOSITION_ADMISSION_SCHEMA_VERSION,
    proposition_key: input.proposition_key,
    canonical_label: input.canonical_label,
    initial_credence: input.initial_credence,
    evidence_member_refs: input.member_refs
  });
}

/**
 * HOST ROUTE LAW for a NEW candidate whose canonical identity already exists.
 * A semantic `NEW_PROPOSITION_CANDIDATE` for a label that canonicalizes onto an
 * already-registered proposition means the evidence is formation-bearing for
 * that existing proposition; the host therefore routes it into the ORDINARY
 * frozen plasticity path as `SUPPORTS` (the provider never supplies a relation
 * for a NEW candidate, and the host never invents CONTRADICTS). No second
 * numeric law exists: the step is the frozen `BELIEF_PLASTICITY_STEP`.
 */
export const BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0 = "SUPPORTS" as const;

export type BeliefPropositionAdmissionCodeV0 =
  | "ADMITTED_NEW"
  | "ROUTED_EXISTING"
  | "REJECTED_INVALID_LABEL"
  | "REJECTED_INVALID_EVIDENCE"
  | "REJECTED_INVALID_PROPOSAL";

export interface BeliefPropositionAdmissionDecisionV0 {
  readonly code: BeliefPropositionAdmissionCodeV0;
  readonly detail: string | null;
  /** Derived host-owned identity (null when rejected). */
  readonly proposition_key: IdentifierV0 | null;
  readonly canonical_label: string | null;
  /** Present only for ADMITTED_NEW. */
  readonly initial_credence: UnitIntervalV0 | null;
  /** Present only for ROUTED_EXISTING — the canonical id the event must target. */
  readonly existing_proposition_id: IdentifierV0 | null;
}

function rejectedAdmission(
  code: "REJECTED_INVALID_LABEL" | "REJECTED_INVALID_EVIDENCE" | "REJECTED_INVALID_PROPOSAL",
  detail: string
): BeliefPropositionAdmissionDecisionV0 {
  return {
    code,
    detail,
    proposition_key: null,
    canonical_label: null,
    initial_credence: null,
    existing_proposition_id: null
  };
}

/**
 * CANONICAL LABEL LAW V0 — deterministic textual normalization only.
 * NFC → collapse internal whitespace runs to one space → trim → reject empty.
 * Deliberately does NOT lowercase, reorder, paraphrase, translate, drop negation or merge
 * synonyms, so the same proposed text always yields the same canonical label.
 */
export function deriveCanonicalBeliefPropositionLabelV0(
  proposed: unknown
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly detail: string } {
  if (typeof proposed !== "string") return { ok: false, detail: "proposed_label: expected string" };
  const normalized = proposed.normalize("NFC").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return { ok: false, detail: "proposed_label: empty after normalization" };
  // Reuse the canonical Belief proposition-label law (nonempty, already trimmed, max length).
  const checked = validateBeliefPropositionLabel(normalized, "proposed_label");
  if (!checked.ok) return { ok: false, detail: checked.error.detail };
  return { ok: true, value: checked.value };
}

/**
 * PROPOSITION IDENTITY LAW V0 — content-addressed and host-owned.
 * The key depends ONLY on the canonical label, so it survives process restart and replay.
 * Random, clock-based, counter-based and model-supplied identities are impossible by
 * construction. The canonical `proposition_id` adds subject scope (`deriveBeliefPropositionId`).
 *
 * The input MUST already be canonical: a raw (un-normalized) label would silently
 * create a second identity for the same proposition, so non-canonical input FAILS
 * CLOSED instead.
 */
export async function deriveBeliefPropositionKeyV0(canonicalLabel: string): Promise<IdentifierV0> {
  const canonical = deriveCanonicalBeliefPropositionLabelV0(canonicalLabel);
  if (!canonical.ok || canonical.value !== canonicalLabel) {
    throw new Error(
      "BELIEF_PROPOSITION_KEY_INPUT_NOT_CANONICAL: deriveBeliefPropositionKeyV0 requires the exact canonical label"
    );
  }
  const digest = await hashEnvelope(BELIEF_PROPOSITION_KEY_PROJECTION, {
    canonical_label: canonicalLabel
  });
  const raw = `belief-prop-v0-${digest.replace(/^sha256:/, "")}`;
  const checked = validateIdentifier(raw, "belief.proposition_key");
  if (!checked.ok) {
    throw new Error(`BELIEF_PROPOSITION_KEY_DERIVATION_FAILED: ${checked.error.detail}`);
  }
  return checked.value;
}

/** Evidence admission law: non-empty, unique, raw-ASCII sorted, canonical episode refs. */
export function validateBeliefAdmissionEvidenceRefsV0(
  memberRefs: unknown
): { readonly ok: true; readonly value: readonly EpisodeRef[] } | { readonly ok: false; readonly detail: string } {
  if (!Array.isArray(memberRefs) || memberRefs.length === 0) {
    return { ok: false, detail: "evidence_refs: non-empty array required" };
  }
  let previous: string | undefined;
  const out: EpisodeRef[] = [];
  for (let index = 0; index < memberRefs.length; index += 1) {
    const ref = memberRefs[index];
    if (typeof ref !== "string" || !ref.startsWith("episode:")) {
      return { ok: false, detail: `evidence_refs[${index}]: expected episode ref` };
    }
    if (previous !== undefined && !(ref > previous)) {
      return {
        ok: false,
        detail: `evidence_refs[${index}]: ${ref === previous ? "duplicate" : "not raw-ASCII-sorted"}`
      };
    }
    previous = ref;
    out.push(ref as EpisodeRef);
  }
  return { ok: true, value: out };
}

export interface AdmitBeliefPropositionInputV0 {
  readonly subjectState: SubjectStateAnyVersionV0;
  readonly proposed_label: unknown;
  readonly evidence_member_refs: unknown;
}

/**
 * Pure admission DECISION (no canonical write): resolves a NEW candidate to either
 * ADMITTED_NEW (host-derived key/label/credence) or ROUTED_EXISTING (exact duplicate).
 */
export async function decideBeliefPropositionAdmissionV0(
  input: AdmitBeliefPropositionInputV0
): Promise<BeliefPropositionAdmissionDecisionV0> {
  const label = deriveCanonicalBeliefPropositionLabelV0(input.proposed_label);
  if (!label.ok) return rejectedAdmission("REJECTED_INVALID_LABEL", label.detail);

  const evidence = validateBeliefAdmissionEvidenceRefsV0(input.evidence_member_refs);
  if (!evidence.ok) return rejectedAdmission("REJECTED_INVALID_EVIDENCE", evidence.detail);

  const key = await deriveBeliefPropositionKeyV0(label.value);
  const subjectId = (input.subjectState as { identity: { subject_id: IdentifierV0 } }).identity.subject_id;
  const propositionId = await deriveBeliefPropositionId(subjectId, key);

  // EXACT DUPLICATE LAW: same canonical label ⇒ same key ⇒ same identity ⇒ never a second
  // INSERT. The event returns to the existing proposition's ordinary frozen plasticity.
  const existing = (input.subjectState as { beliefs: BeliefStateV0 }).beliefs.items.find(
    (item) => item.proposition_id === propositionId
  );
  if (existing !== undefined) {
    return {
      code: "ROUTED_EXISTING",
      detail: "exact duplicate canonical label: routed to the existing proposition",
      proposition_key: key,
      canonical_label: label.value,
      initial_credence: null,
      existing_proposition_id: existing.proposition_id
    };
  }

  const credence = validateUnitInterval(BELIEF_PROPOSITION_FIRST_CREDENCE, "initial_credence");
  if (!credence.ok) {
    return rejectedAdmission("REJECTED_INVALID_PROPOSAL", "host initial credence failed validation");
  }
  return {
    code: "ADMITTED_NEW",
    detail: null,
    proposition_key: key,
    canonical_label: label.value,
    initial_credence: credence.value,
    existing_proposition_id: null
  };
}

export interface ExecuteBeliefPropositionAdmissionDepsV0 {
  readonly subjectCore: SubjectCorePort;
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly issuer: ProducerAuthorizationIssuer;
}

/**
 * The ONE lawful INSERT construction for a host-admitted proposition: canonical
 * key + canonical label + host-derived initial credence + the exact admitted
 * evidence set, shaped as the frozen BeliefMutationProposalV0 and revalidated by
 * the frozen proposal validator. Pure: no store, no executor, no commit. The
 * governed workflow checkpoints the returned proposal verbatim so its durable
 * record is byte-identical to what is committed.
 */
export async function buildBeliefPropositionInsertProposalV0(input: {
  readonly subject_id: IdentifierV0;
  readonly snapshot: SubjectStateAnyVersionV0;
  readonly proposition_key: IdentifierV0;
  readonly canonical_label: string;
  readonly initial_credence: UnitIntervalV0;
  readonly evidence_member_refs: readonly EpisodeRef[];
}): Promise<ValidationResult<BeliefMutationProposalV0>> {
  const evidence = validateBeliefAdmissionEvidenceRefsV0(input.evidence_member_refs);
  if (!evidence.ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `evidence: ${evidence.detail}`);
  }
  const memberSetFingerprint = await deriveBeliefEvidenceMemberSetFingerprint(evidence.value);
  const evidence_binding: BeliefEvidenceBindingV0 = {
    member_refs: evidence.value,
    member_set_fingerprint: memberSetFingerprint as HashV1
  };
  const proposal: BeliefMutationProposalV0 = {
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: input.subject_id,
    expected_state_revision: (input.snapshot as { runtime_metadata: { state_revision: StateRevisionV0 } })
      .runtime_metadata.state_revision,
    mutation: {
      kind: "INSERT",
      proposition_key: input.proposition_key,
      proposition_label: input.canonical_label,
      initial_credence: input.initial_credence
    },
    evidence_binding
  };
  return validateBeliefMutationProposal(proposal);
}

export type ExecuteBeliefPropositionAdmissionResultV0 =
  | {
      readonly kind: "ADMITTED_NEW";
      readonly proposition_id: IdentifierV0;
      readonly proposition_key: IdentifierV0;
      readonly canonical_label: string;
      readonly credence: UnitIntervalV0;
      readonly commit_ref: string;
      readonly final_state_revision: StateRevisionV0;
    }
  | {
      readonly kind: "ROUTED_EXISTING";
      readonly proposition_id: IdentifierV0;
      readonly proposition_key: IdentifierV0;
      readonly canonical_label: string;
    }
  | {
      readonly kind: "REJECTED";
      readonly code: string;
      readonly detail: string;
    };

/**
 * The ONE governed formation operation: decide → build the lawful INSERT proposal → commit
 * through the EXISTING BeliefTransitionExecutor. Proposition, 0.55 credence and evidence
 * binding become durable in a SINGLE atomic canonical transition; no intermediate state is
 * persisted and no second Belief writer is introduced. Evidence membership is re-verified by
 * the executor through the sanctioned `validateRefsBelong` boundary.
 */
export async function executeBeliefPropositionAdmissionV0(
  deps: ExecuteBeliefPropositionAdmissionDepsV0,
  ctx: RuntimeContext,
  input: {
    readonly snapshot: SubjectStateAnyVersionV0;
    readonly proposed_label: unknown;
    readonly evidence_member_refs: unknown;
  }
): Promise<ExecuteBeliefPropositionAdmissionResultV0> {
  const decision = await decideBeliefPropositionAdmissionV0({
    subjectState: input.snapshot,
    proposed_label: input.proposed_label,
    evidence_member_refs: input.evidence_member_refs
  });
  if (decision.code === "REJECTED_INVALID_LABEL" || decision.code === "REJECTED_INVALID_EVIDENCE" || decision.code === "REJECTED_INVALID_PROPOSAL") {
    return { kind: "REJECTED", code: decision.code, detail: decision.detail ?? "rejected" };
  }
  if (decision.code === "ROUTED_EXISTING") {
    return {
      kind: "ROUTED_EXISTING",
      proposition_id: decision.existing_proposition_id as IdentifierV0,
      proposition_key: decision.proposition_key as IdentifierV0,
      canonical_label: decision.canonical_label as string
    };
  }

  const memberRefs = input.evidence_member_refs as readonly EpisodeRef[];
  const built = await buildBeliefPropositionInsertProposalV0({
    subject_id: ctx.subject_id,
    snapshot: input.snapshot,
    proposition_key: decision.proposition_key as IdentifierV0,
    canonical_label: decision.canonical_label as string,
    initial_credence: decision.initial_credence as UnitIntervalV0,
    evidence_member_refs: memberRefs
  });
  if (!built.ok) {
    return { kind: "REJECTED", code: "REJECTED_INVALID_PROPOSAL", detail: built.error.detail };
  }
  const checked = built;

  const executor = new BeliefTransitionExecutor({
    subjectCore: deps.subjectCore,
    issuer: deps.issuer,
    memoryRepository: deps.memoryRepository
  });
  const outcome = await executor.execute(ctx, checked.value);
  if (outcome.kind === "NO_OP" || outcome.kind === "ALREADY_COMMITTED") {
    // Idempotent replay of an already-durable formation: the proposition exists, so this is
    // never a second creation. Report it as the existing proposition.
    return {
      kind: "ROUTED_EXISTING",
      proposition_id: await deriveBeliefPropositionId(ctx.subject_id, decision.proposition_key as IdentifierV0),
      proposition_key: decision.proposition_key as IdentifierV0,
      canonical_label: decision.canonical_label as string
    };
  }
  if (outcome.kind !== "COMMITTED") {
    return { kind: "REJECTED", code: outcome.kind, detail: outcome.detail };
  }
  return {
    kind: "ADMITTED_NEW",
    proposition_id: await deriveBeliefPropositionId(ctx.subject_id, decision.proposition_key as IdentifierV0),
    proposition_key: decision.proposition_key as IdentifierV0,
    canonical_label: decision.canonical_label as string,
    credence: decision.initial_credence as UnitIntervalV0,
    commit_ref: outcome.bundle.commit_ref as string,
    final_state_revision: outcome.bundle.next_revision as StateRevisionV0
  };
}

/** Exported for tests/audit: the frozen step this module adds exactly once at formation. */
export const BELIEF_PROPOSITION_ADMISSION_STEP_V0 = BELIEF_PLASTICITY_STEP;
