/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C0a REVISION 3 — THE NOISE GATE'S EXECUTABLE IDENTITY. FROZEN. ZERO MODEL CALLS.
 *
 * WHY THIS FILE EXISTS, AND WHAT IT DOES *NOT* DO
 *   A mechanical extraction of the frozen noise decision from revisions 0 and 1 found that all SEVEN
 *   scientific decisions were already frozen:
 *
 *     1. the construct                    — "a determinism precondition on a NON-TARGET request"
 *     2. the request selection rule       — the named fixture D4C0A-QF-A-SUPPORT-TRANSFER, by frozen
 *                                           manifest order, never the treatment request
 *     3. the planned call count           — 6 byte-identical calls
 *     4. the invalid rule                 — D4C0A_INCONCLUSIVE_BY_STABILITY_GATE_INVALID_OUTPUTS
 *     5. the pass rule                    — all six legal AND the unique modal token's count is 6
 *     6. the stop rule                    — D4C0A_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE
 *     7. the reachable r values           — [6], with no sample-size branch
 *
 *   Two things were NOT frozen, and they are the whole content of this revision:
 *     (a) the executable CLASSIFIER NAME — a name is an engineering fact, and the round's brief
 *         authorises freezing it at zero calls without touching the scientific rule;
 *     (b) a TARGET-AUTHORISATION rule — `target_authorised` appears nowhere in the frozen text.
 *
 *   On (b), the honest classification: authorisation is PROCEDURAL, not scientific. The frozen purpose
 *   already calls the gate "a precondition", and the frozen reachable outcomes are exactly PASS and
 *   STOP; a precondition that is not met cannot leave the next stage available. So this file records
 *   that derivation rather than inventing a rule — and it is written here, visibly, so a reader who
 *   thinks authorisation deserved its own frozen decision can disagree with the call.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { D4C0A_NOISE_GATE, D4C0A_QUALIFICATION_FIXTURES, D4_HASH_PROJECTION_V0 } from "./contract.ts";
import {
  D4C0A_REV1_NOISE_DIVISION_OF_LABOUR,
  D4_REVISION_0_MANIFEST_HASH
} from "./contract-rev1-directional-majority.ts";

export const D4_VERSION_REV3 = "belief-cross-expression-composition-d4-rev3" as const;

export const D4_REVISION_2_MANIFEST_HASH =
  "sha256:a1818bc23b5adab1ce4c83c0c00c60afb0d595660570bb832c2326c5313c2a1d" as const;

// =============================================================================================
// 1. THE FROZEN-DECISION AUDIT
// =============================================================================================

export const D4C0A_NOISE_FROZEN_DECISION_AUDIT = Object.freeze({
  scientific_decisions_extracted: [
    { id: "construct", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.purpose", value: D4C0A_NOISE_GATE.purpose },
    { id: "request_selection_rule", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.non_target_request_source", value: D4C0A_NOISE_GATE.non_target_request_source },
    { id: "planned_calls", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.planned_calls", value: D4C0A_NOISE_GATE.planned_calls },
    { id: "invalid_rule", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.invalid_verdict", value: D4C0A_NOISE_GATE.invalid_verdict },
    { id: "pass_rule", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.pass_condition", value: D4C0A_NOISE_GATE.pass_condition },
    { id: "stop_rule", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.self_noise_verdict", value: D4C0A_NOISE_GATE.self_noise_verdict },
    { id: "reachable_r_values", frozen: true, source: "contract.ts :: D4C0A_NOISE_GATE.reachable_r_values", value: D4C0A_NOISE_GATE.reachable_r_values }
  ],
  scientific_decisions_not_frozen: [],
  not_frozen_but_executable_identity: {
    classifier_name: { frozen: false, why_it_is_not_scientific: "a function name is an engineering fact; the rule it implements was already frozen" },
    target_authorisation_rule: {
      frozen: false,
      classification: "PROCEDURAL, not scientific",
      derivation:
        "the frozen purpose calls the gate a precondition on a non-target request, and the frozen reachable outcomes are exactly PASS and STOP; a precondition that is not met cannot leave the next stage available",
      recorded_so_a_reader_can_disagree: true
    }
  },
  model_calls_before_amendment: 0,
  noise_outputs_seen_before_amendment: false,
  target_outputs_seen_before_amendment: false,
  scientific_rule_unchanged: true
});

// =============================================================================================
// 2. THE FROZEN EXECUTABLE IDENTITY
// =============================================================================================

export const D4C0A_NOISE_CLASSIFIER = Object.freeze({
  name: "classifyD4C0ANoiseStabilityV0",
  may_read: [
    "the frozen planned noise records",
    "the frozen token vocabulary",
    "the frozen invalid policy",
    "the frozen collection-integrity requirements",
    "the selected frozen noise request hash"
  ],
  may_not_read: [
    "qualification correctness",
    "target outputs",
    "a target arm",
    "latency",
    "provider metadata",
    "a timestamp",
    "a human label"
  ],
  correctness_is_not_stability: true,
  why:
    "the gate asks whether the six calls agree with EACH OTHER; it must NOT additionally require the modal token to equal the fixture's expected token, because that would fuse instrument correctness (qualification's job) with instrument stability (this gate's job) into one construct"
});

export const D4C0A_NOISE_TARGET_AUTHORISATION = Object.freeze({
  rule: "the target may proceed only on D4C0A_STABILITY_GATE_PASS; every other reachable outcome sets target_authorised = false",
  pass_authorises_the_target: true,
  self_noise_inconclusive_authorises_the_target: false,
  invalid_inconclusive_authorises_the_target: false,
  integrity_failure_authorises_the_target: false,
  r_after_the_gate: 6,
  r_changed_by_the_gate: false,
  classification: "PROCEDURAL",
  derived_from: "the frozen purpose ('a precondition') and the frozen reachable outcomes ('PASS', 'STOP')",
  new_scientific_rule_introduced: false
});

/** Where the noise request comes from: the frozen selection rule, resolved. */
export const D4C0A_NOISE_SELECTION_RESOLUTION = Object.freeze({
  rule: D4C0A_NOISE_GATE.non_target_request_source,
  resolved_fixture_index: 0,
  resolved_fixture_id: D4C0A_QUALIFICATION_FIXTURES[0]?.fixture_id,
  selection_is_a_pure_function_of_the_frozen_manifest: true,
  read_qualification_correctness: false,
  read_which_fixture_performed_best: false,
  must_not_be_a_treatment_request: true,
  must_not_be_the_canonical_pair: true
});

export const D4C0A_NOISE_EVIDENCE_CLASS = Object.freeze({
  noise_evidence_class: "INSTRUMENT_STABILITY",
  measures: "identical-request measurement-path self-consistency",
  does_not_measure: [
    "SUPPORT -> SUPPORTS_B composition",
    "OPPOSE -> OPPOSES_B composition",
    "treatment sensitivity",
    "target correctness",
    "CharacterOS anything",
    "semantic relation recognition"
  ]
});

// =============================================================================================
// 3. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4Rev3ManifestV0 {
  readonly version: typeof D4_VERSION_REV3;
  readonly frozen_decision_audit: typeof D4C0A_NOISE_FROZEN_DECISION_AUDIT;
  readonly classifier: typeof D4C0A_NOISE_CLASSIFIER;
  readonly target_authorisation: typeof D4C0A_NOISE_TARGET_AUTHORISATION;
  readonly selection_resolution: typeof D4C0A_NOISE_SELECTION_RESOLUTION;
  readonly evidence_class: typeof D4C0A_NOISE_EVIDENCE_CLASS;
  readonly supersedes_scope: readonly string[];
  readonly revision_2_manifest_hash_preserved: string;
  readonly revision_0_manifest_hash_preserved: string;
  readonly scientific_rule_unchanged: true;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4Rev3ManifestV0(): Promise<D4Rev3ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  check(D4C0A_NOISE_FROZEN_DECISION_AUDIT.scientific_decisions_extracted.length === 7, "the audit does not cover seven scientific decisions");
  check(D4C0A_NOISE_FROZEN_DECISION_AUDIT.scientific_decisions_extracted.every((d) => d.frozen), "a scientific decision is not frozen");
  check(D4C0A_NOISE_FROZEN_DECISION_AUDIT.scientific_decisions_not_frozen.length === 0, "a scientific decision is reported as missing");
  check(D4C0A_NOISE_FROZEN_DECISION_AUDIT.model_calls_before_amendment === 0, "calls were spent before the amendment");
  check(D4C0A_NOISE_CLASSIFIER.name === "classifyD4C0ANoiseStabilityV0", "the classifier name changed");
  check(D4C0A_NOISE_CLASSIFIER.correctness_is_not_stability, "the classifier is allowed to require correctness");
  check(D4C0A_NOISE_TARGET_AUTHORISATION.r_after_the_gate === 6 && !D4C0A_NOISE_TARGET_AUTHORISATION.r_changed_by_the_gate, "the gate changed r");
  check(!D4C0A_NOISE_TARGET_AUTHORISATION.new_scientific_rule_introduced, "a new scientific rule is claimed");
  check(D4C0A_NOISE_SELECTION_RESOLUTION.resolved_fixture_id === "D4C0A-QF-A-SUPPORT-TRANSFER", "the selected fixture changed");
  check(!D4C0A_NOISE_SELECTION_RESOLUTION.read_qualification_correctness, "the selection read correctness");
  check(D4C0A_NOISE_GATE.reachable_r_values.length === 1 && D4C0A_NOISE_GATE.reachable_r_values[0] === 6, "the frozen reachable r changed");
  check(D4C0A_NOISE_GATE.sample_size_branches.length === 0, "the frozen gate gained a sample-size branch");
  check(D4C0A_NOISE_GATE.the_gate_is_on_agreement_not_correctness, "the frozen agreement-not-correctness law changed");
  check(D4C0A_REV1_NOISE_DIVISION_OF_LABOUR.may_not_change_r_dynamically, "the frozen no-dynamic-r law changed");
  if (problems.length > 0) throw new Error(`D4_C0A_REV3_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    scientific_decisions_frozen: 7,
    scientific_decisions_missing: 0,
    classifier_name: D4C0A_NOISE_CLASSIFIER.name,
    target_authorisation_is_procedural: true,
    selection_resolved_to: D4C0A_NOISE_SELECTION_RESOLUTION.resolved_fixture_id,
    reachable_r_values: [6],
    evidence_class: D4C0A_NOISE_EVIDENCE_CLASS.noise_evidence_class,
    scientific_rule_changed: false,
    verification_cost: 0
  };

  const body = {
    version: D4_VERSION_REV3,
    frozen_decision_audit: D4C0A_NOISE_FROZEN_DECISION_AUDIT,
    classifier: D4C0A_NOISE_CLASSIFIER,
    target_authorisation: D4C0A_NOISE_TARGET_AUTHORISATION,
    selection_resolution: D4C0A_NOISE_SELECTION_RESOLUTION,
    evidence_class: D4C0A_NOISE_EVIDENCE_CLASS,
    supersedes_scope: [
      "the noise classifier's executable name — previously unfrozen",
      "the target-authorisation rule — previously unfrozen and procedural, now recorded explicitly"
    ] as const,
    revision_2_manifest_hash_preserved: D4_REVISION_2_MANIFEST_HASH,
    revision_0_manifest_hash_preserved: D4_REVISION_0_MANIFEST_HASH,
    scientific_rule_unchanged: true as const,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body) });
}
