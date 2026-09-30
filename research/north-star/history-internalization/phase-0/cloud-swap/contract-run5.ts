/**
 * RUN-5 FROZEN CONTRACT — the SOURCE_QUOTE compliance condition.
 *
 * WHAT RUN-5 CHANGES, IN FULL: exactly ONE thing — the declared citation-discipline augmentation is
 * applied to the cognition family's request (`run5-augmentation.ts`), plus the fresh identities below.
 *
 * WHAT IT DELIBERATELY DOES NOT CHANGE: the trajectories, valence table, target proposition, baseline
 * credence, predicted directions, scorer, primary predicate, **and the invalid policy**. In particular
 * there is NO retry and NO engineering-failure tolerance: a single failed scientific turn still makes the
 * run INCONCLUSIVE, exactly as in run-1/run-3/run-4. That is deliberate — it keeps the design's integrity
 * and means run-5 needs no scientific-protocol decision.
 *
 * WHY ONE CHANGE AND NOT TWO: with the raw-response recorder now in place, every outcome of run-5 is
 * informative. A clean run measures the hypothesis. A failure WITH the payload preserved diagnoses the
 * mechanism (paraphrase vs multi-source citation). A failure that looks the same would establish that
 * stating this rule harder does not buy compliance, which escalates the question to the contract's
 * semantics — a change this file may not make.
 */

import type { Phase0SubjectIdsV0 } from "../harness.ts";
import { RUN5_SOURCE_QUOTE_AUGMENTATION_V0 } from "./run5-augmentation.ts";

export const P0_RUN5_CONDITION = "SWAPPED_EXECUTOR_CLOUD_WITH_SOURCE_QUOTE_AUGMENTATION" as const;

/**
 * Fresh identities. Same §4 law as every prior condition: the two ARM ids are opaque, equal-length,
 * non-semantic, share one stem, and differ only in a 4-digit suffix carrying no order meaning; the
 * qualification subject uses a different stem.
 */
export const P0_RUN5_SUBJECT_IDS: Phase0SubjectIdsV0 = Object.freeze({
  qualification: "subject-r5u9-3952",
  armA: "subject-r5b3-4187",
  armB: "subject-r5b3-7260",
  sessionQualification: "session-qualification-r5-0001",
  sessionA: "session-r5b3-4187-0001",
  sessionB: "session-r5b3-7260-0001"
});

/** Run-5's own identity, which run-6 (if any) must forbid. */
export const P0_RUN5_OWN_IDS: readonly string[] = Object.freeze([
  P0_RUN5_SUBJECT_IDS.qualification,
  P0_RUN5_SUBJECT_IDS.armA,
  P0_RUN5_SUBJECT_IDS.armB
]);

/**
 * Everything consumed by an EARLIER condition and therefore forbidden in run-5's bytes: run-1's frozen
 * identities, run-2's and run-3's re-identified subjects, REV1's six single-turn qualification subjects,
 * and run-4's three. Completeness is DERIVED from the evidence by the suite, not trusted from this list.
 */
export const P0_RUN5_FORBIDDEN_INHERITED_IDS: readonly string[] = Object.freeze([
  "subject-k7q2-4103",
  "subject-k7q2-8267",
  "subject-q0v8-3319",
  "subject-r2-k7q2-4103",
  "subject-r2-k7q2-8267",
  "subject-r2-q0v8-3319",
  "subject-r3-2wq9-6631",
  "subject-r3-7p4n-2185",
  "subject-r3-7p4n-9047",
  "subject-qcf-5213",
  "subject-qcf-7748",
  "subject-qcf-2091",
  "subject-qcf-8836",
  "subject-qcf-1457",
  "subject-qcf-6304",
  "subject-r4q7-6128",
  "subject-r4h6-2903",
  "subject-r4h6-7514"
]);

export const P0_RUN5_CHANGED_CONDITIONS: Readonly<Record<string, string>> = Object.freeze({
  executor: "SWAPPED_EXECUTOR_CLOUD (deepseek-flash) — inherited from run-4 unchanged",
  subject_identity: "fresh identities for this condition (see P0_RUN5_SUBJECT_IDS)",
  cognition_request_text:
    "the citation-discipline augmentation is appended to the cognition request's system message; production prompt text, validator and product bytes are UNTOUCHED",
  model_visible_bytes:
    "differ from run-1/run-3/run-4 by the augmentation — hence run-5 is not comparable to them (a cost run-5 already carried through the executor change)"
});

export const P0_RUN5_UNCHANGED_CONDITIONS: Readonly<Record<string, string>> = Object.freeze({
  trajectories_valence_table_target_proposition_baseline_credence_predicted_directions:
    "reused by reference from ../contract.ts",
  scorer_and_primary_predicate: "reused by reference (scorePhase0V0)",
  invalid_policy:
    "UNCHANGED — any non-COMPLETE scientific turn makes the run INCONCLUSIVE; no retry, no substitution, no extension, no engineering-failure tolerance",
  evidence_hierarchy_ceiling: "unchanged (L1 -> L2 at most)",
  family_budgets_and_timeouts: "unchanged (./cloud-bundle.ts)",
  production_and_packages: "UNMODIFIED"
});

export const P0_RUN5_STOP_RULES: readonly string[] = Object.freeze([
  "the in-run qualification turn is a pre-flight gate; a failure stops the round before any scientific turn",
  "any scientific turn that does not reach COMPLETE makes the run INCONCLUSIVE — NO RETRY",
  "the schedule runs exactly once, in the frozen order",
  "pre-state and post-state are frozen with scored:false and hashed BEFORE the scorer runs",
  "the augmentation is applied to cognition ONLY and must never appear in a language or appraisal request",
  "if the augmentation cannot be applied to a request (no system message), the turn FAILS CLOSED rather than proceeding unaugmented"
]);

export const P0_RUN5_FORBIDDEN_CLAIMS: readonly string[] = Object.freeze([
  "history internalization works",
  "the subject has been shaped by its life",
  "persistent belief influences cognition",
  "persistent belief influences decision or behaviour",
  "the CharacterOS north star is established",
  "personality or affect channels contribute",
  "run-5 is comparable to run-1, run-3 or run-4",
  "the augmentation fixed the SOURCE_QUOTE failure (that is what run-5 measures, not what it assumes)",
  "the D1 null is overturned or re-opened"
]);

export const P0_RUN5_AUGMENTATION = RUN5_SOURCE_QUOTE_AUGMENTATION_V0;
