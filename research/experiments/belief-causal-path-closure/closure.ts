/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * BELIEF CAUSAL PATH — EVIDENCE CLOSURE V1. 0 MODEL CALLS. NO NEW EXPERIMENT.
 *
 *   node research/experiments/belief-causal-path-closure/closure.ts <outdir>
 *
 * Recomputes every authoritative hash from the artifact BYTES (never from a hand-written constant),
 * compares each against the value the producing round recorded, and stops on any mismatch. If everything
 * reproduces it emits the closure artifacts that become required inputs for any future D4 or
 * belief-architecture change.
 *
 * It adds no scientific claim. Every statement below is a re-expression of a frozen result, and each one
 * names the evidence CLASS it belongs to, because the most damaging failure this map exists to prevent is
 * reading an executor capability diagnostic as CharacterOS causal evidence.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

const D1 = "research/experiments/belief-state-sensitivity-d1/evidence/run-001";
const D2 = "research/experiments/belief-causal-path-d2/evidence/run-001";
const D3 = "research/experiments/belief-semantic-binding-d3/evidence/run-001";
const REQUEST_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const D1_PROJECTION = "characteros-next/research/d1-belief-state-sensitivity/v1" as const;
const D2_PROJECTION = "characteros-next/research/d2-belief-causal-path/v1" as const;
const D3_PROJECTION = "characteros-next/research/d3-belief-semantic-binding/v1" as const;

const problems: string[] = [];

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** Recomputes a file's content hash under its own projection and checks it against the recorded value. */
async function verify(
  label: string,
  path: string,
  projection: string,
  recorded: string
): Promise<{ label: string; path: string; recorded: string; recomputed: string; matches: boolean }> {
  const content = await readFile(path, "utf8");
  const recomputed = String(await hashEnvelope(projection, { name: path.split("/").pop() as string, content }));
  const matches = recomputed === recorded;
  if (!matches) problems.push(`${label}: recorded ${recorded} != recomputed ${recomputed}`);
  return { label, path, recorded, recomputed, matches };
}

async function sha256OfSource(path: string): Promise<string> {
  return String(await hashEnvelope(D3_PROJECTION, { source: await readFile(path, "utf8") }));
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node closure.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ============================== 1/10. RECOMPUTE EVERY IDENTITY ================================
  const d1Verdict = await readJson<Record<string, never>>(`${D1}/core-treatment/core-scientific-verdict.json`);
  const d1Manifest = await readJson<Record<string, string | number>>(`${D1}/core-treatment/CORE_TREATMENT_MANIFEST.json`);
  const d1HashDoc = await readJson<{ CORE_TREATMENT_DATASET_SHA256: string }>(`${D1}/core-treatment/core-treatment-dataset-hash.json`);
  const d1Blocks = await readJson<Record<string, { HIGH: number; LOW: number }>>(`${D1}/core-treatment/block-counts.json`);

  const a0DatasetHash = await readJson<{ A0_STATE_EXPERIMENT_DATASET_SHA256: string }>(`${D2}/a0-state-experiment/a0-state-dataset-hash.json`);
  const a0Dataset = await readJson<{ trials: { arm: string; parsed_stance_token: string | null }[] }>(`${D2}/a0-state-experiment/a0-state-dataset.json`);
  const a0PilotHash = await readJson<{ schedule_hash: string }>(`${D2}/a0-neutral-pilot/schedule-hash.json`);
  const a0Manifest = await readJson<Record<string, string>>(`${D2}/a0-characteros-request-freeze/A0_CHARACTEROS_REQUEST_SET_MANIFEST.json`);

  const a1DatasetHash = await readJson<{ A1_STATE_EXPERIMENT_DATASET_SHA256: string }>(`${D2}/a1-state-experiment/a1-state-dataset-hash.json`);
  const a1Dataset = await readJson<{ trials: { arm: string; parsed_stance_token: string | null }[] }>(`${D2}/a1-state-experiment/a1-state-dataset.json`);
  const a1PilotHash = await readJson<{ schedule_hash: string }>(`${D2}/a1-neutral-pilot/schedule-hash.json`);
  const a1Manifest = await readJson<Record<string, string>>(`${D2}/a1-characteros-request-freeze/A1_CHARACTEROS_REQUEST_SET_MANIFEST.json`);

  const d3QualHash = await readJson<{ D3_B_QUALIFICATION_DATASET_SHA256: string }>(`${D3}/d3-b-instrument-qualification/qualification-dataset-hash.json`);
  const d3NoiseHash = await readJson<{ D3_B_NOISE_DATASET_SHA256: string }>(`${D3}/d3-b-noise-stability/noise-dataset-hash.json`);
  const d3TargetHash = await readJson<{ D3_B_TARGET_DATASET_SHA256: string }>(`${D3}/d3-b-target/target-dataset-hash.json`);
  const d3TargetDataset = await readJson<{ trials: { parsed_relation: string | null }[] }>(`${D3}/d3-b-target/target-dataset.json`);
  const d3TargetScheduleHash = await readJson<{ schedule_hash: string; target_request_hash: string }>(`${D3}/rev5/d3-b-target-schedule-hash.json`);
  const d3Rev5Manifest = await readJson<{ manifest_hash: string }>(`${D3}/rev5/contract-rev5-manifest.json`);

  const ledger: { label: string; path: string; recorded: string; recomputed: string; matches: boolean }[] = [];
  /**
   * D1 uses a DIFFERENT freeze convention from D2/D3: it hashes `{ dataset }` (the sorted records array)
   * rather than `{ name, content }` over the file text. Recomputing it the wrong way produces a FALSE
   * integrity failure — and the wrong response would have been to "fix" the recorded value. Each line is
   * recomputed with its own producer convention instead. See the protocol-lessons artifact.
   */
  const d1DatasetDoc = await readJson<{ dataset: unknown }>(`${D1}/core-treatment/core-treatment-dataset.json`);
  const d1Recomputed = String(await hashEnvelope(D1_PROJECTION, { dataset: d1DatasetDoc.dataset }));
  const d1Matches = d1Recomputed === d1HashDoc.CORE_TREATMENT_DATASET_SHA256;
  if (!d1Matches) problems.push(`D1 core-treatment dataset: recorded ${d1HashDoc.CORE_TREATMENT_DATASET_SHA256} != recomputed ${d1Recomputed}`);
  ledger.push({
    label: "D1 core-treatment dataset (D1 convention: hashEnvelope(projection, { dataset }))",
    path: `${D1}/core-treatment/core-treatment-dataset.json`,
    recorded: d1HashDoc.CORE_TREATMENT_DATASET_SHA256,
    recomputed: d1Recomputed,
    matches: d1Matches
  });
  ledger.push(await verify("D2-A0 state dataset", `${D2}/a0-state-experiment/a0-state-dataset.json`, D2_PROJECTION, a0DatasetHash.A0_STATE_EXPERIMENT_DATASET_SHA256));
  ledger.push(await verify("D2-A1 state dataset", `${D2}/a1-state-experiment/a1-state-dataset.json`, D2_PROJECTION, a1DatasetHash.A1_STATE_EXPERIMENT_DATASET_SHA256));
  ledger.push(await verify("D3-B qualification dataset", `${D3}/d3-b-instrument-qualification/qualification-dataset.json`, D3_PROJECTION, d3QualHash.D3_B_QUALIFICATION_DATASET_SHA256));
  ledger.push(await verify("D3-B noise dataset", `${D3}/d3-b-noise-stability/noise-dataset.json`, D3_PROJECTION, d3NoiseHash.D3_B_NOISE_DATASET_SHA256));
  ledger.push(await verify("D3-B target dataset", `${D3}/d3-b-target/target-dataset.json`, D3_PROJECTION, d3TargetHash.D3_B_TARGET_DATASET_SHA256));
  ledger.push(await verify("D2-A0 schedule", `${D2}/a0-neutral-pilot/A0_STATE_EXPERIMENT_SCHEDULE.json`, D2_PROJECTION, a0PilotHash.schedule_hash));
  ledger.push(await verify("D2-A1 schedule", `${D2}/a1-neutral-pilot/A1_STATE_EXPERIMENT_SCHEDULE.json`, D2_PROJECTION, a1PilotHash.schedule_hash));
  ledger.push(await verify("D3-B target schedule", `${D3}/rev5/D3_B_TARGET_SCHEDULE.json`, D3_PROJECTION, d3TargetScheduleHash.schedule_hash));

  // request-set identities, recomputed from the request bytes
  const requestChecks: { label: string; record: { recorded: string; recomputed: string; matches: boolean } }[] = [];
  const verifyRequest = async (label: string, path: string, recorded: string) => {
    const doc = await readJson<{ request: unknown }>(path);
    const recomputed = String(await hashEnvelope(REQUEST_PROJECTION, doc.request as never));
    if (recomputed !== recorded) problems.push(`${label}: recorded ${recorded} != recomputed ${recomputed}`);
    requestChecks.push({ label, record: { recorded, recomputed, matches: recomputed === recorded } });
  };
  await verifyRequest("D2-A0 HIGH request", `${D2}/a0-characteros-request-freeze/final-high.json`, a0Manifest["high_request_hash"] as string);
  await verifyRequest("D2-A0 LOW request", `${D2}/a0-characteros-request-freeze/final-low.json`, a0Manifest["low_request_hash"] as string);
  await verifyRequest("D2-A0 NEUTRAL request", `${D2}/a0-characteros-request-freeze/final-neutral.json`, a0Manifest["neutral_request_hash"] as string);
  await verifyRequest("D2-A1 HIGH request", `${D2}/a1-characteros-request-freeze/final-high.json`, a1Manifest["high_final_request_hash"] as string);
  await verifyRequest("D2-A1 LOW request", `${D2}/a1-characteros-request-freeze/final-low.json`, a1Manifest["low_final_request_hash"] as string);
  await verifyRequest("D2-A1 NEUTRAL request", `${D2}/a1-characteros-request-freeze/final-neutral.json`, a1Manifest["neutral_final_request_hash"] as string);
  await verifyRequest("D3-B target request", `${D3}/d3-b-target/target-request.json`, d3TargetScheduleHash.target_request_hash);

  // current frozen implementation sources
  const sourceHashes: Record<string, string> = {};
  for (const path of [
    "research/experiments/belief-causal-path-d2/transformer-a0.ts",
    "research/experiments/belief-causal-path-d2/transformer-a1.ts",
    "research/experiments/belief-semantic-binding-d3/transformer-d3b.ts",
    "research/experiments/belief-semantic-binding-d3/scorers-d3b.ts",
    "research/experiments/belief-semantic-binding-d3/qualification-base.ts",
    "research/experiments/belief-causal-path-d2/contract-rev1-1c-a1-prerequisites.ts",
    "research/experiments/belief-causal-path-d2/contract-rev1-1d-a1-neutral-and-context.ts",
    "research/experiments/belief-causal-path-d2/contract-rev1-1e-a1-state-scoring.ts",
    "research/experiments/belief-semantic-binding-d3/contract.ts",
    "research/experiments/belief-semantic-binding-d3/contract-rev2-d3b-only.ts",
    "research/experiments/belief-semantic-binding-d3/contract-rev3-noise-identity.ts",
    "research/experiments/belief-semantic-binding-d3/contract-rev4-noise-stability-gate.ts",
    "research/experiments/belief-semantic-binding-d3/contract-rev5-target-state-blind.ts"
  ]) {
    sourceHashes[path] = await sha256OfSource(path);
  }

  if (problems.length > 0) {
    await write("EVIDENCE_INTEGRITY_FAILURE.json", { problems, model_calls: 0, verdict: "BELIEF_CAUSAL_PATH_EVIDENCE_INTEGRITY_FAILURE" });
    throw new Error(`BELIEF_CAUSAL_PATH_EVIDENCE_INTEGRITY_FAILURE: ${problems.join(" ; ")}`);
  }

  // ============================== observed counts ==============================================
  const countBy = (trials: { arm: string; [k: string]: unknown }[], arm: string, key: "parsed_stance_token") => {
    const out: Record<string, number> = {};
    for (const t of trials.filter((x) => x.arm === arm)) {
      const token = String(t[key]);
      out[token] = (out[token] ?? 0) + 1;
    }
    return out;
  };
  const a0High = countBy(a0Dataset.trials as never, "HIGH", "parsed_stance_token");
  const a0Low = countBy(a0Dataset.trials as never, "LOW", "parsed_stance_token");
  const a1High = countBy(a1Dataset.trials as never, "HIGH", "parsed_stance_token");
  const a1Low = countBy(a1Dataset.trials as never, "LOW", "parsed_stance_token");
  const d3TargetCounts: Record<string, number> = {};
  for (const t of d3TargetDataset.trials) {
    const key = t.parsed_relation ?? "INVALID";
    d3TargetCounts[key] = (d3TargetCounts[key] ?? 0) + 1;
  }

  const CLASSES = Object.freeze([
    "CHARACTEROS_STRUCTURAL",
    "CHARACTEROS_PROJECTION",
    "CHARACTEROS_STATE_READOUT",
    "EXECUTOR_STATE_BLIND_CAPABILITY",
    "CHARACTEROS_CAUSAL_ENDPOINT",
    "VALID_NULL",
    "INCONCLUSIVE"
  ]);

  // ============================== 2/3. THE LINK MAP ============================================
  const linkMap = {
    version: "belief-causal-path-evidence-map-v1",
    evidence_classes: CLASSES,
    links: [
      {
        link: "LINK_1_CANONICAL_BELIEF_STATE",
        status: "ESTABLISHED",
        evidence: "D1 offline state construction and isolation",
        evidence_class: "CHARACTEROS_STRUCTURAL",
        detail: "a lawful counterfactual credence 0.80 / 0.20 materialises through production genesis authoring and is the only canonical state difference",
        historical_verdicts: []
      },
      {
        link: "LINK_2_PRODUCTION_PROJECTION",
        status: "ESTABLISHED",
        evidence: "D1 production projection and normalised isolation",
        evidence_class: "CHARACTEROS_PROJECTION",
        detail: "the production V2 projection carries the belief line; request isolation is byte-exact after the two frozen normalisations",
        historical_verdicts: []
      },
      {
        link: "LINK_3A_3B1_CANONICAL_PROPOSITION_STANCE_BINDING",
        status: "ESTABLISHED",
        evidence: "D2-A0",
        evidence_class: "CHARACTEROS_STATE_READOUT",
        observed: { HIGH_0_80: a0High, LOW_0_20: a0Low },
        canonical_claim: "CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED",
        historical_verdict_name: "CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE",
        historical_name_caveat: "historical verdict name understates actual instrument scope",
        instrument_actually_measured: "canonical credence -> stance on the canonical proposition"
      },
      {
        link: "LINK_3B2_CANONICAL_PARAPHRASE_RELATION_RECOGNITION",
        status: "ESTABLISHED",
        evidence: "D3-B target",
        evidence_class: "EXECUTOR_STATE_BLIND_CAPABILITY",
        observed: { trials: 6, counts: d3TargetCounts },
        canonical_claim: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
        explicitly_not: "CharacterOS causal evidence",
        scope: "a state-blind executor capability diagnostic: no subject state, no credence, no arm"
      },
      {
        link: "LINK_3B3_CROSS_WORDING_STANCE_TRANSFER",
        status: "NOT_ESTABLISHED",
        evidence: "D2-A1 valid null",
        evidence_class: "VALID_NULL",
        observed: { HIGH_0_80: a1High, LOW_0_20: a1Low },
        frozen_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
        causal_map_wording: "CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED_ON_PREREGISTERED_PARAPHRASE",
        scope: [
          "the preregistered CAUTION proposition",
          "the preregistered paraphrase",
          "the frozen production context",
          "the frozen executor"
        ],
        forbidden_widening: "global semantic failure"
      },
      {
        link: "LINK_4_EPISTEMIC_APPRAISAL",
        status: "NOT_TESTED",
        authorised: false,
        reason: "D2's sequential preregistration required an A1 positive; A1 was a valid null, and a D3-B positive does not substitute for it",
        evidence_class: null
      },
      {
        link: "LINK_5_STRUCTURED_DECISION",
        status: "SENSITIVITY_NOT_ESTABLISHED",
        evidence: "D1 valid null",
        evidence_class: "VALID_NULL",
        precise_wording:
          "sensitivity of the structured decision to the manipulated canonical belief state was not established under the frozen D1 design — NOT the bare statement that link 5 is false",
        observed: {
          P1_FULL: (d1Verdict as Record<string, { verdict: string }>)["primary_P1_FULL"].verdict,
          P2_FULL: (d1Verdict as Record<string, { verdict: string }>)["near_transfer_P2_FULL"].verdict,
          P1_FRAME_MINIMAL: (d1Verdict as unknown as Record<string, Record<string, string>>)["frame"]?.["minimal"],
          STATE_REVERSAL: (d1Verdict as Record<string, { verdict: string }>)["reconstruction_replication"].verdict,
          P3_NEGATIVE_CONTROL: (d1Verdict as Record<string, { verdict: string }>)["specificity_P3"].verdict
        },
        noise_ceiling: (d1Verdict as Record<string, number>)["noise_ceiling"],
        delta_min: (d1Verdict as Record<string, number>)["delta_min"]
      }
    ],
    d1_blocks: d1Blocks,
    d1_verdict: (d1Verdict as Record<string, string>)["collection"],
    d1_frozen_verdict: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED"
  };

  // ============================== 4. REGISTRY ==================================================
  const registry = {
    version: "belief-causal-path-claim-registry-v1",
    rows: [
      { experiment: "D1 core treatment", planned_calls: 60, actual_calls: 60, pilot_calls: 6, invalid_count: 0, integrity: "HOLDS", scorer: "D1 frozen categorical scorer", positive_predicate: "delta_verify or delta_accept exceeding the frozen noise ceiling", actual_verdict: "CONTRAST_NO_MOVEMENT in all five blocks", class: "VALID_NULL" },
      { experiment: "D1 restart contrast", planned_calls: 0, actual_calls: 0, invalid_count: 0, integrity: "HOLDS", scorer: "n/a", positive_predicate: "n/a", actual_verdict: "RESTART_CONTRAST_LOCKED", class: "VALID_NULL" },
      { experiment: "D2-A0 qualification", planned_calls: 9, actual_calls: 9, invalid_count: 0, integrity: "HOLDS", scorer: "frozen qualification rule", positive_predicate: "each fixture modal equals its pre-registered token", actual_verdict: "D2_A0_INSTRUMENT_QUALIFIED", class: "QUALIFIED" },
      { experiment: "D2-A0 neutral pilot", planned_calls: 6, actual_calls: 6, invalid_count: 0, integrity: "HOLDS", scorer: "frozen noise mapping", positive_predicate: "n/a (self-noise)", actual_verdict: "r_confirm_A0 = 6", class: "CALIBRATION" },
      { experiment: "D2-A0 state experiment", planned_calls: 12, actual_calls: 12, invalid_count: 0, integrity: "HOLDS", scorer: "frozen directional criterion", positive_predicate: "HIGH modal in endorsing set AND LOW modal in doubting set AND they differ", actual_verdict: "STRUCTURAL_DIRECTION_LEGIBLE", class: "POSITIVE" },
      { experiment: "D2-A1 qualification", planned_calls: 9, actual_calls: 9, invalid_count: 0, integrity: "HOLDS", scorer: "frozen qualification rule", positive_predicate: "each fixture modal equals its pre-registered token", actual_verdict: "D2_A1_INSTRUMENT_QUALIFIED", class: "QUALIFIED" },
      { experiment: "D2-A1 neutral pilot", planned_calls: 6, actual_calls: 6, invalid_count: 0, integrity: "HOLDS", scorer: "frozen noise mapping", positive_predicate: "n/a (self-noise)", actual_verdict: "r_confirm_A1 = 6", class: "CALIBRATION" },
      { experiment: "D2-A1 state experiment", planned_calls: 12, actual_calls: 12, invalid_count: 0, integrity: "HOLDS", scorer: "classifyA1StateExperimentV0 (frozen)", positive_predicate: "HIGH unique modal SUPPORTS AND LOW unique modal OPPOSES AND they differ", actual_verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED (as the frozen A1 null)", class: "VALID_NULL" },
      { experiment: "D3-B qualification", planned_calls: 9, actual_calls: 9, invalid_count: 0, integrity: "HOLDS", scorer: "scoreD3BQualificationV0 (frozen)", positive_predicate: "each fixture modal equals its pre-registered relation", actual_verdict: "D3_B_INSTRUMENT_QUALIFIED", class: "QUALIFIED" },
      { experiment: "D3-B noise stability gate", planned_calls: 6, actual_calls: 6, invalid_count: 0, integrity: "HOLDS", scorer: "classifyD3BNoiseStabilityV0 (frozen)", positive_predicate: "all six legal and mutually agreeing", actual_verdict: "D3_B_NOISE_STABILITY_GATE_PASS", class: "STABILITY_PASS" },
      { experiment: "D3-B target", planned_calls: 6, actual_calls: 6, invalid_count: 0, integrity: "HOLDS", scorer: "scoreD3BTargetV0 (frozen)", positive_predicate: "every one of six trials SEMANTICALLY_ALIGNED (unanimity)", actual_verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED", class: "POSITIVE" }
    ],
    null_is_not_inconclusive: true,
    note: "an invalid or integrity-inconclusive run would be recorded as INCONCLUSIVE and never as a null; no such run exists in this ledger"
  };

  // ============================== 5. COMBINED STATEMENT ========================================
  const combined = {
    version: "belief-causal-path-combined-statement-v1",
    statement: "SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED",
    mechanical_expansion: [
      "canonical credence can be read as a stance toward the canonical proposition (D2-A0)",
      "the executor can directly recognize the canonical proposition and the frozen paraphrase as semantically aligned (D3-B, state-blind)",
      "the frozen CharacterOS A1 experiment did not establish transfer of that stance to the paraphrased expression (D2-A1 valid null)"
    ],
    is_the_maximum_observational_claim: true
  };

  // ============================== 6. HYPOTHESIS REGISTRY =======================================
  const hypotheses = {
    version: "belief-causal-path-hypothesis-registry-v1",
    entries: [
      {
        id: "CROSS_WORDING_STANCE_BINDING_OR_COMPOSITION_PROBLEM",
        status: "HYPOTHESIS",
        supporting_pattern: ["3B1 positive", "3B2 positive", "3B3 null"],
        forbidden_status_words: ["proven", "established", "observed mechanism failure"],
        allowed_wording: ["consistent with", "suggests investigating", "candidate architectural explanation"]
      }
    ]
  };

  // ============================== 7. NON-CLAIMS ================================================
  const nonClaims = {
    version: "belief-causal-path-nonclaims-v1",
    entries: [
      { claim: "the belief module is globally ineffective", status: "NOT CLAIMED" },
      { claim: "semantic understanding is globally absent", status: "NOT CLAIMED" },
      { claim: "the executor cannot understand paraphrases", status: "CONTRADICTED_BY_D3_B_TARGET" },
      { claim: "the canonical credence is unreadable", status: "CONTRADICTED_BY_D2_A0" },
      { claim: "the belief is cognitively inert", status: "NOT_ESTABLISHED" },
      { claim: "the appraisal link failed", status: "NOT_TESTED" },
      { claim: "an integration mechanism failed", status: "NOT_OBSERVED" },
      { claim: "D1 is overturned", status: "FALSE" },
      { claim: "D2-B is reopened", status: "FALSE" }
    ],
    note: "'cognitively inert' would require A0 positive + A1 positive + B null; D2 never reached an A1 positive, so the term remains unearned"
  };

  // ============================== 8. HISTORICAL NAMING AUDIT ===================================
  const namingAudit = {
    version: "belief-causal-path-historical-naming-audit-v1",
    rows: [
      {
        historical_verdict: "CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE",
        producing_stage: "D2-A0",
        instrument_actually_measured: "the subject's stance on the proposition shown in the belief line, i.e. canonical credence -> stance on the canonical proposition",
        why_the_name_understates: "the name says 'structurally legible', which reads as raw numeric visibility; D2-A0's anchors define its buckets as the proposition being settled in the subject's favour or against it, and its frozen criterion is exactly that directional stance criterion",
        canonical_evidence_map_interpretation: "CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED",
        historical_artifact_renamed: false
      },
      {
        historical_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
        producing_stage: "D2-A1",
        instrument_actually_measured: "whether the canonical stance transfers to a preregistered paraphrase's direction",
        why_the_name_is_imprecise: "'semantic uptake' is broad; the measured claim is narrower and bounded by one preregistered paraphrase",
        canonical_evidence_map_interpretation: "CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED_ON_PREREGISTERED_PARAPHRASE",
        historical_artifact_renamed: false
      },
      {
        historical_verdict: "D3_B_INSTRUMENT_QUALIFIED",
        producing_stage: "D3-B qualification",
        instrument_actually_measured: "whether the relation instrument realises its own three-token vocabulary on synthetic fixtures",
        why_the_name_is_fine: "it says 'instrument', which is exactly what was qualified",
        canonical_evidence_map_interpretation: "instrument evidence only; not CharacterOS causal evidence",
        historical_artifact_renamed: false
      },
      {
        historical_verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
        producing_stage: "D3-B target",
        instrument_actually_measured: "a state-blind relation judgement between two literal statements",
        why_the_name_needs_a_class: "the name is accurate but silent about its evidence class, which is where misreading happens",
        canonical_evidence_map_interpretation: "EXECUTOR_STATE_BLIND_CAPABILITY — explicitly NOT CharacterOS causal evidence",
        historical_artifact_renamed: false
      }
    ],
    law: "no historical artifact is renamed; the map carries the corrected reading alongside the historical name"
  };

  // ============================== 9. PROTOCOL LESSONS ==========================================
  const lessons = {
    version: "belief-causal-path-protocol-lessons-v1",
    scope: "governance lessons only; these are not scientific evidence and they changed no outcome, because every affected run was stopped before the affected calls were made",
    lessons: [
      { id: "self_comparison_check", pattern: "a check compared a value to itself and could never fail", where_found: "D3-B target schedule audit (schema compared to itself)", resolution: "replaced with a real comparison against the frozen schema" },
      { id: "constant_comparison_cannot_fail", pattern: "a literal-typed comparison the compiler proves cannot fail", where_found: "D3 REV4 gate audit and D3-B target runner", resolution: "values widened to string/number so the assertion stays falsifiable, plus a new check that the two constants differ" },
      { id: "wrong_expected_property", pattern: "an audit encoded the defective state as a PASS", where_found: "the target request kept the subject block and the audit recorded target_subject_data_untouched: true", resolution: "REV5: violation recorded, corrected request frozen, invalid artifact retained uncalled" },
      { id: "forbidden_subject_state_in_request", pattern: "a state-blind instrument's request carried CharacterOS subject state", where_found: "D3-B target request", resolution: "REV5 rebuilt on the state-blind base" },
      { id: "pilot_identical_to_target", pattern: "a noise pilot used the treatment request", where_found: "D3-B noise design", resolution: "REV3: non-target frozen request, reused never re-rendered" },
      { id: "sample_size_logic_incompatible_with_scorer", pattern: "an r-extension mapping paired with a unanimity scorer", where_found: "D3-B noise rule", resolution: "REV4: stability gate; the extension branch retired prospectively" },
      { id: "verdict_name_narrower_than_instrument", pattern: "a verdict name understates what the instrument measured", where_found: "D2-A0", resolution: "recorded in the naming audit; no rename" },
      { id: "missing_invalid_policy", pattern: "no rule for how an invalid trial enters the denominator", where_found: "D2 A1 pilot; D2-A1 state experiment", resolution: "REV1.1c, REV1.1d and REV1.1e froze them before the affected calls" },
      { id: "undefined_modal_count", pattern: "a mapping keyed by a count whose definition the rule never supplied", where_found: "D2_NOISE_RULE; D3-B rev1", resolution: "REV1.1d and D3 REV2 defined the counted quantity and the tie verdict" },
      { id: "schedule_tamper_test_that_did_not_tamper", pattern: "a check substituted a value equal to the frozen one, so genuine forgery would pass", where_found: "D3 REV1.1e-era schedule check", resolution: "the check now flips the arm to its opposite" },
      { id: "task_specificity_not_respected", pattern: "a lexical law scoped to the whole request, including inherited production text, making an instrument unimplementable", where_found: "D3-B / A1 transformer conformance", resolution: "law scoped to the stage's own artifact, plus a no-introduction delta for what it inherits" },
      {
        id: "false_integrity_failure_from_a_wrong_hash_convention",
        pattern:
          "recomputing a frozen hash with a different payload convention than the producer used produces a FALSE integrity failure",
        where_found:
          "this closure round: D1 hashes { dataset } while D2/D3 hash { name, content }, so hashing D1 the D2 way reported a mismatch",
        resolution:
          "each line is recomputed with its own producer convention; the failure report was withdrawn and the near-miss recorded here",
        the_wrong_fix_to_avoid:
          "adjusting the recorded value, or the artifact, to match a recomputation that used the wrong convention"
      },
      { id: "stage_specificity_of_audit_checks", pattern: "an audit check satisfied by another stage's artifact, clearing a stage that had nothing", where_found: "D1.1a A1 prerequisite audit", resolution: "checks made stage-specific by id and by meaning-map shape" }
    ],
    retrospective_effect: "NONE — every affected run was invalidated or corrected BEFORE the affected calls were made; no scientific output was altered"
  };

  // ============================== 11. CALL LEDGER ==============================================
  const callLedger = {
    version: "belief-causal-path-call-ledger-v1",
    by_line: {
      D1: { total: d1Manifest["model_calls_total"], core_treatment: d1Manifest["model_calls_this_round"], pilot_and_design: 6 },
      D2: { total: 54, qualification: 18, noise_calibration: 12, scientific_target: 24 },
      D3: { total: 21, qualification: 9, noise_calibration: 6, scientific_target: 6 }
    },
    grand_total: Number(d1Manifest["model_calls_total"]) + 54 + 21,
    accounting_rule:
      "these categories are NOT interchangeable: qualification calls test an instrument on state-blind fixtures, calibration calls measure self-noise, and only scientific-target calls produce evidence about the frozen causal links",
    forbidden_reading: "summing all calls as though each were an independent scientific observation"
  };

  // ============================== WRITE ========================================================
  const hashLedger = {
    version: "belief-causal-path-hash-ledger-v1",
    recomputed_from: "artifact bytes",
    all_match: problems.length === 0,
    datasets_and_schedules: ledger,
    request_sets: requestChecks,
    implementation_sources: sourceHashes,
    revision_contracts: { d3_revision_5_manifest: d3Rev5Manifest.manifest_hash }
  };

  await write("BELIEF_CAUSAL_PATH_EVIDENCE_MAP_V1.json", linkMap);
  await write("BELIEF_CAUSAL_PATH_CLAIM_REGISTRY_V1.json", registry);
  await write("BELIEF_CAUSAL_PATH_NONCLAIMS_V1.json", nonClaims);
  await write("BELIEF_CAUSAL_PATH_PROTOCOL_LESSONS_V1.json", lessons);
  await write("BELIEF_CAUSAL_PATH_HASH_LEDGER_V1.json", hashLedger);
  await write("BELIEF_CAUSAL_PATH_COMBINED_STATEMENT_V1.json", combined);
  await write("BELIEF_CAUSAL_PATH_HYPOTHESIS_REGISTRY_V1.json", hypotheses);
  await write("BELIEF_CAUSAL_PATH_HISTORICAL_NAMING_AUDIT_V1.json", namingAudit);
  await write("BELIEF_CAUSAL_PATH_CALL_LEDGER_V1.json", callLedger);
  await write("CLOSURE_VERDICT.json", {
    verdicts: [
      "BELIEF_CAUSAL_PATH_D1_D2_D3_EVIDENCE_FROZEN",
      "LINK_3B_LOCALIZATION_COMPLETE",
      "LINK_4_REMAINS_LOCKED",
      "NO_NEW_SCIENTIFIC_CLAIM_ADDED"
    ],
    model_calls_this_round: 0,
    evidence_integrity: "ALL_RECOMPUTED_HASHES_MATCH",
    datasets_and_schedules_verified: ledger.length,
    request_identities_verified: requestChecks.length,
    implementation_sources_hashed: Object.keys(sourceHashes).length,
    combined_statement: combined.statement,
    link_4_authorised: false,
    d2_b_reopened: false,
    new_experiment_designed: false
  });

  process.stdout.write(
    `BELIEF_CAUSAL_PATH_D1_D2_D3_EVIDENCE_FROZEN | LINK_3B_LOCALIZATION_COMPLETE | LINK_4_REMAINS_LOCKED | NO_NEW_SCIENTIFIC_CLAIM_ADDED\n` +
      `hashes: ${String(ledger.length)} datasets/schedules + ${String(requestChecks.length)} request sets + ${String(Object.keys(sourceHashes).length)} sources — all match: ${String(problems.length === 0)}\n` +
      `combined: ${combined.statement}\ncalls this round: 0 | grand total across D1/D2/D3: ${String(callLedger.grand_total)}\n`
  );
}

await main();
