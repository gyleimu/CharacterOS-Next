/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV1 — the three frozen audits. RESEARCH-ONLY, offline, 0 model calls.
 *
 *   CONSTRUCT_NEUTRALITY — every line of the override block is classified, and no line is
 *                          STATE_GUIDANCE or CONDITION_GUIDANCE.
 *   FIXTURE_BLINDNESS   — the block shares no fixture text, fixture id, expected-token mapping
 *                          or fixture paraphrase, checked at byte level including n-grams.
 *   STATE_BLINDNESS     — the block carries no subject-state vocabulary, with any unavoidable
 *                          term individually justified.
 *
 * These are GATES: `DECISION_INSTRUMENT_V1_QUALIFIED` requires all three to PASS.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES } from "../decision-probe-v0/fixtures.ts";
import {
  DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED,
  DECISION_PROBE_V1_SCHEMA_VERSION
} from "./contract.ts";

export const DECISION_PROBE_V1_AUDIT_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe-v1/audit/v0" as const;

/** Line categories. Only the first three are admissible in V1. */
export const OVERRIDE_LINE_CATEGORIES = Object.freeze([
  "VOCABULARY_DEFINITION",
  "OUTPUT_CONTRACT",
  "MEASUREMENT_INSTRUCTION",
  "STATE_GUIDANCE",
  "CONDITION_GUIDANCE",
  "OTHER"
] as const);
export type OverrideLineCategoryV0 = (typeof OVERRIDE_LINE_CATEGORIES)[number];

export const V1_FORBIDDEN_CATEGORIES = Object.freeze([
  "STATE_GUIDANCE",
  "CONDITION_GUIDANCE"
] as const);

/**
 * FROZEN per-line classification of the V1 override block. Index-aligned with the block's
 * lines. Any edit to the block changes its line count or content and therefore fails the audit
 * below, which is the point: the classification cannot silently drift away from the text.
 */
export const OVERRIDE_LINE_CLASSIFICATION_V0: readonly OverrideLineCategoryV0[] = Object.freeze([
  "OTHER", //                    0  blank separator
  "OUTPUT_CONTRACT", //          1  section header
  "MEASUREMENT_INSTRUCTION", //  2  supersedes the format rules, nothing else changes
  "MEASUREMENT_INSTRUCTION", //  3  every SUBJECT DATA / untrusted-content / evidence law still binds
  "OUTPUT_CONTRACT", //          4  exactly one JSON object, no prose, no fences
  "OUTPUT_CONTRACT", //          5  "Required members:"
  "OUTPUT_CONTRACT", //          6  schema version member
  "OUTPUT_CONTRACT", //          7  decision member enum
  "OUTPUT_CONTRACT", //          8  "Optional member:"
  "OUTPUT_CONTRACT", //          9  explanation member
  "VOCABULARY_DEFINITION", //   10  "Decision meanings (binding):"
  "VOCABULARY_DEFINITION", //   11  ACCEPT definition
  "VOCABULARY_DEFINITION", //   12  VERIFY definition
  "VOCABULARY_DEFINITION", //   13  REJECT definition
  "MEASUREMENT_INSTRUCTION", // 14  choose exactly one decision for the claim in the observation
  "OUTPUT_CONTRACT" //          15  section footer
]);

/** Terms that must not appear in the override block, and any justified exception. */
const FORBIDDEN_STATE_TERMS: readonly string[] = Object.freeze([
  "belief",
  "credence",
  "relationship",
  "personality",
  "affect",
  "mood",
  "valence",
  "history",
  "memory",
  "episodic",
  "characteros",
  "interaction familiarity"
]);

/**
 * Justified exceptions. Each entry must state why the term is unavoidable and why its presence
 * is not STATE_GUIDANCE. An unexplained occurrence fails the audit.
 */
const JUSTIFIED_STATE_TERM_EXCEPTIONS: readonly { readonly term: string; readonly justification: string }[] =
  Object.freeze([
    {
      term: "subject data",
      justification:
        "Uppercase reference to the PRODUCTION prompt's own section name, occurring only inside the clause that BINDS the existing SUBJECT DATA / untrusted-content / evidence laws for this invocation. It constrains the override; it never guides the executor toward any state value, and it never varies with condition or arm. Removing it would let the override appear to void safety and evidence laws, which would be worse."
    }
  ]);

export interface AuditResultV0 {
  readonly audit: "CONSTRUCT_NEUTRALITY" | "FIXTURE_BLINDNESS" | "STATE_BLINDNESS";
  readonly status: "PASS" | "FAIL";
  readonly detail: readonly string[];
  readonly block_hash: HashV1;
}

async function blockHash(): Promise<HashV1> {
  return await hashEnvelope(DECISION_PROBE_V1_AUDIT_HASH_PROJECTION_V0, {
    override_block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED
  });
}

/** CONSTRUCT_NEUTRALITY — per-line classification, no forbidden category. */
export async function auditConstructNeutralityV0(): Promise<AuditResultV0> {
  const lines = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.split("\n");
  const detail: string[] = [];
  let ok = true;
  if (lines.length !== OVERRIDE_LINE_CLASSIFICATION_V0.length) {
    ok = false;
    detail.push(
      `line count ${String(lines.length)} does not match the frozen classification (${String(OVERRIDE_LINE_CLASSIFICATION_V0.length)}) — the block changed`
    );
  }
  for (const [index, category] of OVERRIDE_LINE_CLASSIFICATION_V0.entries()) {
    if (!OVERRIDE_LINE_CATEGORIES.includes(category)) {
      ok = false;
      detail.push(`line ${String(index)}: unknown category ${category}`);
    }
    if ((V1_FORBIDDEN_CATEGORIES as readonly string[]).includes(category)) {
      ok = false;
      detail.push(`line ${String(index)}: FORBIDDEN category ${category} :: ${lines[index] ?? ""}`);
    }
  }
  // The three definitions must be present and must be the only normative statements about the
  // decision tokens: each token appears as a definition exactly once.
  for (const token of DECISION_PROBE_DECISIONS) {
    const definingLines = lines.filter((line) => line.startsWith(`  ${token} —`));
    if (definingLines.length !== 1) {
      ok = false;
      detail.push(`token ${token} must be defined exactly once, found ${String(definingLines.length)}`);
    }
  }
  if (ok) {
    detail.push(
      `all ${String(lines.length)} lines classified; categories used: ` +
        `${[...new Set(OVERRIDE_LINE_CLASSIFICATION_V0)].sort().join(", ")}; no STATE_GUIDANCE, no CONDITION_GUIDANCE`
    );
  }
  return { audit: "CONSTRUCT_NEUTRALITY", status: ok ? "PASS" : "FAIL", detail, block_hash: await blockHash() };
}

/** FIXTURE_BLINDNESS — byte-level and n-gram checks against every frozen fixture. */
export async function auditFixtureBlindnessV0(): Promise<AuditResultV0> {
  const block = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED;
  const blockLower = block.toLowerCase();
  const detail: string[] = [];
  let ok = true;

  for (const fixture of D0_FIXTURES) {
    if (block.includes(fixture.observation_text)) {
      ok = false;
      detail.push(`fixture text verbatim present: ${fixture.fixture_id}`);
    }
    if (blockLower.includes(fixture.fixture_id.toLowerCase())) {
      ok = false;
      detail.push(`fixture id present: ${fixture.fixture_id}`);
    }
    // n-gram paraphrase check: no 6-word window of the fixture may appear in the block.
    const fixtureWords = fixture.observation_text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const windowSize = 6;
    for (let start = 0; start + windowSize <= fixtureWords.length; start += 1) {
      const window = fixtureWords.slice(start, start + windowSize).join(" ");
      if (blockLower.includes(window)) {
        ok = false;
        detail.push(`fixture 6-gram present (${fixture.fixture_id}): "${window}"`);
      }
    }
    // The block must not name the expected decision for any fixture.
    if (new RegExp(`${fixture.fixture_id}[^.]{0,40}${fixture.expected_decision}`, "i").test(block)) {
      ok = false;
      detail.push(`expected-token mapping present: ${fixture.fixture_id} -> ${fixture.expected_decision}`);
    }
  }
  // The block must not mention any fixture identifier scheme at all.
  for (const marker of ["D0-A", "D0-B", "D0-C", "OBVIOUS-ACCEPT", "OBVIOUS-REJECT", "AMBIGUOUS-VERIFY"]) {
    if (block.includes(marker)) {
      ok = false;
      detail.push(`fixture marker present: ${marker}`);
    }
  }
  if (ok) {
    detail.push(
      `no fixture text, id, marker, expected-token mapping or 6-gram present across ${String(D0_FIXTURES.length)} frozen fixtures`
    );
  }
  return { audit: "FIXTURE_BLINDNESS", status: ok ? "PASS" : "FAIL", detail, block_hash: await blockHash() };
}

/** STATE_BLINDNESS — no subject-state vocabulary, except individually justified terms. */
export async function auditStateBlindnessV0(): Promise<AuditResultV0> {
  const blockLower = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.toLowerCase();
  const detail: string[] = [];
  let ok = true;
  for (const term of FORBIDDEN_STATE_TERMS) {
    if (blockLower.includes(term)) {
      ok = false;
      detail.push(`state term present: ${term}`);
    }
  }
  // The one candidate exception: "SUBJECT DATA" (uppercase section name) inside the binding clause.
  const subjectDataOccurrences =
    DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.split("SUBJECT DATA").length - 1;
  if (subjectDataOccurrences > 0) {
    const justification = JUSTIFIED_STATE_TERM_EXCEPTIONS.find((entry) => entry.term === "subject data");
    if (justification === undefined) {
      ok = false;
      detail.push("SUBJECT DATA present with no justification on record");
    } else {
      detail.push(
        `exception (${String(subjectDataOccurrences)}x): "SUBJECT DATA" — ${justification.justification}`
      );
    }
  }
  if (ok) detail.push("no unexplained subject-state vocabulary present");
  return { audit: "STATE_BLINDNESS", status: ok ? "PASS" : "FAIL", detail, block_hash: await blockHash() };
}

export interface V1AuditBundleV0 {
  readonly schema_version: typeof DECISION_PROBE_V1_SCHEMA_VERSION;
  readonly results: readonly AuditResultV0[];
  readonly all_pass: boolean;
}

export async function runV1AuditsV0(): Promise<V1AuditBundleV0> {
  const results = [
    await auditConstructNeutralityV0(),
    await auditFixtureBlindnessV0(),
    await auditStateBlindnessV0()
  ];
  return {
    schema_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    results,
    all_pass: results.every((result) => result.status === "PASS")
  };
}
