/**
 * RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0 — deterministic candidate
 * construction (the NON-model half of the authority).
 *
 * AUTHORITY LAW: EVIDENCE SELECTION ≠ FACT GENERATION.
 *
 * This module only TURNS already-retrieved, already-authorized factual evidence
 * into a closed, numbered, verbatim candidate list. It selects nothing, ranks
 * nothing and scores nothing — no relevance judgement lives here, because the
 * selection decision is the closed-set selector's (the model's) job and the
 * legality decision remains the frozen `authorizeFactualClaimV1`'s job.
 *
 * CANDIDATE SOURCE LAW (§5): candidates come ONLY from the evidence the caller
 * already holds — the cognition projection's resolved factual memory evidence
 * bundle, whose entries are themselves derived from the canonical working refs
 * and the already-validated retrieval selections. This module performs NO
 * independent repository scan, NO retrieval call, NO vector search, NO candidate
 * expansion. A candidate that is not in that bundle cannot be produced here, so
 * cross-subject and invisible/future evidence are structurally impossible.
 *
 * CANDIDATE TEXT LAW (§6): every candidate's text is an exact verbatim
 * substring of its entry's already-authorized recorded text, obtained by pure
 * punctuation-boundary sentence splitting — the SAME split the existing
 * generation-affordance projection uses. No summary, no paraphrase, no
 * rewriting, no model involvement.
 *
 * RECORDED-QUESTION LAW (§7/§15): a span ending in '?' is a recorded question.
 * It is EXCLUDED from selectable candidates entirely (not merely labelled), so a
 * prior failed recall question can never be selected as its own answer.
 *
 * NAMESPACE LAW (deviation from the slice's illustrative `F1/F2/...` naming, with
 * reason): the frozen contract already owns `F<k>` — `buildSourceHandleMapV0` maps
 * `F<k>` to the k-th sorted lawful factual source REF. A selector handle must
 * identify one CANDIDATE SPAN, and many candidates can share one ref, so reusing
 * `F` would make one symbol mean two different things in one turn. Selector
 * candidates therefore use their own explicit namespace `S1..Sn`, and each
 * candidate also carries the frozen `factual_handle` of its ref, which is what
 * the constructed V8 proposal cites. `C<k>` is likewise unusable (it is the
 * frozen context-handle namespace).
 */

import type { FactualMemoryEvidenceBundleV0 } from "@characteros-next/runtime";
import { factualAssessmentSourceRefs } from "@characteros-next/runtime";

/** One selectable candidate: deterministic, verbatim, source-bound. */
export interface RecallCandidateV0 {
  /** The selector handle this candidate is presented under ("S1".."Sn"). */
  readonly handle: string;
  /** The entry's episode ref (provenance; never model-generated). */
  readonly source_ref: string;
  /**
   * The frozen factual handle of `source_ref` (`F<k>`), i.e. the handle the V8
   * proposal must cite. Computed by the same law as `buildSourceHandleMapV0`.
   */
  readonly factual_handle: string;
  /** Which recorded role the span came from (labelling/diagnostics only). */
  readonly role: string;
  /** The exact span text. Always a verbatim substring of the entry's text. */
  readonly text: string;
}

export interface RecallCandidateSetV0 {
  readonly candidates: readonly RecallCandidateV0[];
  /** The complete lawful selector output set: every `S<n>` handle, plus ABSTAIN. */
  readonly admissible: readonly string[];
}

/** Deterministic sentence split: punctuation-boundary only, no semantic filtering. */
export function splitRecordedSentencesV0(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** A span ending in '?' is a recorded question — never an answer candidate. */
export function isRecordedQuestionV0(span: string): boolean {
  return span.endsWith("?");
}

/**
 * Structural view of the cognition projection this authority reads. Only the
 * already-resolved factual evidence bundle and the projection's own ref fields
 * are consulted; nothing else of the projection is interpreted.
 */
export interface RecallProjectionViewV0 {
  readonly factual_memory_evidence?: FactualMemoryEvidenceBundleV0 | undefined;
  readonly memory_working_refs?: readonly string[] | undefined;
  readonly recent_retrieval_refs?: readonly string[] | undefined;
  readonly context?: {
    readonly current_observation_ref?: string | null | undefined;
    readonly scene?: string | undefined;
    readonly task?: string | null | undefined;
  } | undefined;
}

interface CandidateEntryViewV0 {
  readonly episode_ref: string;
  readonly kind: string;
  readonly delivered_behavior_text: string;
  readonly exact_outcome_text: string;
  readonly scene: string;
}

function entriesOf(bundle: FactualMemoryEvidenceBundleV0 | undefined): readonly CandidateEntryViewV0[] {
  if (bundle === undefined) return [];
  return bundle.entries.map((entry) =>
    entry.kind === "BEHAVIOR_OUTCOME"
      ? {
          episode_ref: entry.episode_ref,
          kind: entry.kind,
          delivered_behavior_text: entry.delivered_behavior_text,
          exact_outcome_text: entry.exact_outcome_text,
          scene: ""
        }
      : {
          episode_ref: entry.episode_ref,
          kind: entry.kind,
          delivered_behavior_text: "",
          exact_outcome_text: "",
          scene: entry.scene
        }
  );
}

/**
 * Builds the closed candidate set from the projection's ALREADY-RESOLVED factual
 * memory evidence. Factual handles follow the frozen handle-map law (lawful
 * factual source refs, sorted, `F<index>`), so a handle names the same ref here
 * and in the cognition contract.
 *
 * Deterministic: same projection ⇒ same candidates in the same order.
 */
export function buildRecallCandidateSetV0(
  projection: RecallProjectionViewV0
): RecallCandidateSetV0 {
  const factualRefs = [...new Set<string>(factualAssessmentSourceRefs(projection as never) as readonly string[])].sort();
  const handleOf = new Map<string, string>();
  factualRefs.forEach((ref, index) => handleOf.set(ref, `F${index + 1}`));

  const bundle = projection.factual_memory_evidence;
  const candidates: RecallCandidateV0[] = [];
  for (const entry of entriesOf(bundle)) {
    const factualHandle = handleOf.get(entry.episode_ref);
    if (factualHandle === undefined) continue;
    const roleTexts: readonly (readonly [string, string])[] =
      entry.kind === "BEHAVIOR_OUTCOME"
        ? [
            ["subject's delivered behavior", entry.delivered_behavior_text],
            ["recorded outcome reply", entry.exact_outcome_text]
          ]
        : [["recorded scene", entry.scene]];
    for (const [role, text] of roleTexts) {
      for (const span of splitRecordedSentencesV0(text)) {
        if (isRecordedQuestionV0(span)) continue;
        candidates.push({
          handle: `S${candidates.length + 1}`,
          source_ref: entry.episode_ref,
          factual_handle: factualHandle,
          role,
          text: span
        });
      }
    }
  }
  return {
    candidates: Object.freeze(candidates.map((candidate) => Object.freeze(candidate))),
    admissible: Object.freeze([
      ...candidates.map((candidate) => candidate.handle),
      "ABSTAIN"
    ])
  };
}
