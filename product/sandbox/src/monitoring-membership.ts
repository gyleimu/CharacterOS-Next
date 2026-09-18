/**
 * LONG-RUN MONITORING MEMBERSHIP — LR-002 / LR-003 CORRECTION.
 *
 * Adjudicated root cause: the long-run checkpoint compared a belief transition's
 * evidence refs against the product's BOUNDED 100-entry read-model window instead of
 * the durable-membership authority. Once the subject passed 100 episodes the oldest —
 * perfectly lawful — episode fell out of that window and the checker raised a false
 * `CORE_INTEGRITY / BLOCKER`.
 *
 * This module is the correction, and it is deliberately thin: it asks the EXISTING
 * production authority (`validateRefsBelong` on the bound repository revision, injected
 * here as `belongs`) for every verdict. It adds no visibility law of its own, consults
 * no bounded read model, and invents no fallback: without the production predicate it
 * refuses to run rather than guess.
 *
 * Semantics:
 * - every committed transition's evidence refs must belong at the HEAD revision
 *   (a truly dangling ref is still a BLOCKER), and
 * - they must also belong at the revision where monitoring FIRST OBSERVED the
 *   transition (historical lawfulness — head visibility is never substituted for it).
 */

export interface BeliefEvidenceTransitionV0 {
  readonly workflow_id: string;
  readonly evidence_episode_refs: readonly string[];
}

export interface BeliefEvidenceMembershipInputV0 {
  readonly transitions: readonly BeliefEvidenceTransitionV0[];
  readonly head_repository_revision: string;
  /** workflow_id → the repository revision at which monitoring first saw the transition. */
  readonly transition_revisions: ReadonlyMap<string, string>;
  /** The production membership predicate; every verdict comes from here. */
  readonly belongs: (revision: string, refs: readonly string[]) => Promise<boolean>;
}

export interface MembershipFindingV0 {
  readonly workflow_id: string;
  readonly revision: string;
  readonly check: "HEAD_REVISION" | "TRANSITION_REVISION";
  readonly refs: readonly string[];
  readonly belongs: boolean;
}

export interface MembershipVerdictV0 {
  readonly verdict: "PASS" | "BLOCKER";
  readonly findings: readonly MembershipFindingV0[];
  readonly checked_transitions: number;
  readonly checked_refs: number;
  readonly blocker_reason: string | null;
}

export async function evaluateBeliefEvidenceMembershipV0(
  input: BeliefEvidenceMembershipInputV0
): Promise<MembershipVerdictV0> {
  if (typeof input.belongs !== "function") {
    // No fallback, no heuristic, no window: monitoring must ask the production authority.
    throw new Error(
      "membership check requires the production validateRefsBelong predicate; no fallback visibility exists"
    );
  }
  const findings: MembershipFindingV0[] = [];
  let checkedRefs = 0;
  for (const transition of input.transitions) {
    const refs = [...transition.evidence_episode_refs];
    if (refs.length === 0) continue;
    checkedRefs += refs.length;
    const headBelongs = await input.belongs(input.head_repository_revision, refs);
    findings.push({
      workflow_id: transition.workflow_id,
      revision: input.head_repository_revision,
      check: "HEAD_REVISION",
      refs,
      belongs: headBelongs
    });
    const transitionRevision = input.transition_revisions.get(transition.workflow_id);
    if (transitionRevision !== undefined && transitionRevision !== input.head_repository_revision) {
      const thenBelongs = await input.belongs(transitionRevision, refs);
      findings.push({
        workflow_id: transition.workflow_id,
        revision: transitionRevision,
        check: "TRANSITION_REVISION",
        refs,
        belongs: thenBelongs
      });
    }
  }
  const failed = findings.filter((finding) => !finding.belongs);
  return {
    verdict: failed.length === 0 ? "PASS" : "BLOCKER",
    findings,
    checked_transitions: input.transitions.filter((transition) => transition.evidence_episode_refs.length > 0).length,
    checked_refs: checkedRefs,
    blocker_reason:
      failed.length === 0
        ? null
        : failed
            .map(
              (finding) =>
                `${finding.workflow_id}: refs outside durable memory at ${finding.check} ${finding.revision} (${finding.refs.join(", ")})`
            )
            .join(" | ")
  };
}
