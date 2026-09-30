/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C1 REVISION 1.1 — THE RECORD-FORM STABILITY CLASSIFIER'S EXECUTABLE NAME. FROZEN. ZERO CALLS.
 *
 * The scientific rule for the record-form stability gate was frozen in revision 1. Only its executable
 * NAME was not, and this file freezes that name alone, before the first stability output exists. No
 * scientific rule is introduced or changed here.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { D4_HASH_PROJECTION_V0 } from "../belief-cross-expression-d4/contract.ts";
import { D4_C1_STABILITY_CORRECTNESS_SEPARATION, D4_C1_STABILITY_FIXTURE } from "./contract-rev1-temporal-and-reference.ts";

export const D4_C1_VERSION_REV1_1 = "belief-representation-comparator-d4-c1-rev1.1" as const;

export const D4_C1_REVISION_1_MANIFEST_HASH =
  "sha256:265368c5a94f7b763728d76cba401c9b0ce6c2b05e2973a2b822e7695f947ae8" as const;

export const D4_C1_STABILITY_CLASSIFIER_NAME = "classifyC1RecordStabilityV0" as const;

export const D4_C1_STABILITY_CLASSIFIER_FREEZE = Object.freeze({
  name: D4_C1_STABILITY_CLASSIFIER_NAME,
  frozen_at_model_calls: 0,
  stability_outputs_seen_before_the_freeze: false,
  target_outputs_seen_before_the_freeze: false,
  is_an_engineering_name_only: true,
  scientific_rule_changed: false,
  scientific_rule_source: "contract-rev1-temporal-and-reference.ts :: the frozen record-form stability fixture and the frozen correctness/stability separation",
  the_rule_it_implements: {
    pass_condition: "all six trials legal and mutually agreeing on one token",
    correctness_required: false,
    correctness_separation_source: D4_C1_STABILITY_CORRECTNESS_SEPARATION.pass_condition,
    fixture_source: D4_C1_STABILITY_FIXTURE.kind,
    reachable_outcomes: ["PASS", "STOP"],
    may_set_the_target_sample_size: false,
    may_modify_the_target_schedule: false
  }
});

export interface D4C1Rev11ManifestV0 {
  readonly version: typeof D4_C1_VERSION_REV1_1;
  readonly classifier: typeof D4_C1_STABILITY_CLASSIFIER_FREEZE;
  readonly supersedes_scope: readonly string[];
  readonly revision_1_manifest_hash_preserved: string;
  readonly scientific_content_changed: false;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4C1Rev11ManifestV0(): Promise<D4C1Rev11ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  check(D4_C1_STABILITY_CLASSIFIER_FREEZE.name === "classifyC1RecordStabilityV0", "the classifier name changed");
  check(D4_C1_STABILITY_CLASSIFIER_FREEZE.frozen_at_model_calls === 0, "calls were spent before the name was frozen");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.stability_outputs_seen_before_the_freeze, "stability outputs existed before the freeze");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.target_outputs_seen_before_the_freeze, "target outputs existed before the freeze");
  check(D4_C1_STABILITY_CLASSIFIER_FREEZE.is_an_engineering_name_only, "the freeze claims more than a name");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.scientific_rule_changed, "the freeze claims a scientific change");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.the_rule_it_implements.correctness_required, "the rule requires correctness");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.the_rule_it_implements.may_set_the_target_sample_size, "the rule may set the sample size");
  check(!D4_C1_STABILITY_CLASSIFIER_FREEZE.the_rule_it_implements.may_modify_the_target_schedule, "the rule may modify the target schedule");
  if (problems.length > 0) throw new Error(`D4_C1_REV1_1_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    classifier_name: D4_C1_STABILITY_CLASSIFIER_NAME,
    frozen_at_model_calls: 0,
    scientific_rule_changed: false,
    reachable_outcomes: ["PASS", "STOP"],
    verification_cost: 0
  };

  const body = {
    version: D4_C1_VERSION_REV1_1,
    classifier: D4_C1_STABILITY_CLASSIFIER_FREEZE,
    supersedes_scope: ["the record-form stability classifier's executable name — previously unfrozen"] as const,
    revision_1_manifest_hash_preserved: D4_C1_REVISION_1_MANIFEST_HASH,
    scientific_content_changed: false as const,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body) });
}
