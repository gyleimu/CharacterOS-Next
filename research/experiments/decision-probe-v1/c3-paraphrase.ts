/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV1 — V1-C3 DEFINITION_PARAPHRASE_CONTROL: the frozen paraphrase manifest.
 *
 * PREREGISTRATION RULE (from the V1 protocol):
 *   the paraphrase bytes are written, hashed, frozen and audited BEFORE any C3 model call.
 *   If that cannot be shown, the C3 result is `V1_C3_NOT_PREREGISTERED` and C3 does not run.
 *   The paraphrase is NEVER adjusted after seeing any result.
 *
 * PURPOSE
 *   D0-C (ambiguous → VERIFY) could be construct application or shallow lexical matching on
 *   the word "check" (the fixture says a check is available and cheap; the frozen VERIFY
 *   definition says the claim should be checked). This control re-runs the SAME three frozen
 *   fixtures with paraphrased construct definitions that keep the constructs and remove the
 *   lexical overlap. If D0-C still yields VERIFY, the lexical-overlap explanation is disfavoured.
 *
 * WHAT IS ALLOWED TO CHANGE
 *   EXACTLY the three definition lines. Nothing else in the override block may differ, and the
 *   audit below proves it line-by-line.
 *
 * WHAT MUST NOT CHANGE
 *   the decision tokens, the schema, the fixtures, the expected decisions, the measurement
 *   instruction, the output contract, the thresholds, `r`, the executor or any generation
 *   setting.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES } from "../decision-probe-v0/fixtures.ts";
import { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED } from "./contract.ts";

export const V1_C3_MANIFEST_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0" as const;

/** Frozen paraphrase definitions. Symmetric in form, length and explicitness with the original. */
export const C3_PARAPHRASE_DEFINITIONS_V1 = Object.freeze({
  ACCEPT: "the material in hand is enough, so the claim can be relied on immediately",
  VERIFY: "the claim should be confirmed against a separate party before being relied on",
  REJECT: "the claim should be set aside and not relied on"
});

/** Content words that must NOT appear in the paraphrase, because the fixtures use them. */
export const C3_FORBIDDEN_OVERLAP_TERMS = Object.freeze([
  "check",
  "checked",
  "checking",
  "verify",
  "verification",
  "independent",
  "source",
  "act",
  "acted",
  "acting"
]);

/** Per-token construct skeleton. Both the original and the paraphrase must satisfy it. */
const CONSTRUCT_SKELETON: Readonly<Record<string, { readonly dispositions: readonly string[]; readonly conditions: readonly string[] }>> =
  Object.freeze({
    ACCEPT: {
      dispositions: ["acted on", "relied on", "proceed", "go ahead"],
      conditions: ["sufficient", "enough", "settles", "suffices"]
    },
    VERIFY: {
      dispositions: ["checked", "confirmed", "corroborated", "probed"],
      conditions: ["before", "first", "prior"]
    },
    REJECT: {
      dispositions: ["not be accepted", "set aside", "declined", "not relied on"],
      conditions: ["not", "no"]
    }
  });

function definitionLinesOf(block: string): readonly { readonly token: string; readonly line: string }[] {
  const lines = block.split("\n");
  return DECISION_PROBE_DECISIONS.map((token) => {
    const line = lines.find((candidate) => candidate.startsWith(`  ${token} —`));
    if (line === undefined) throw new Error(`C3: definition line for ${token} not found`);
    return { token, line };
  });
}

function definitionTextOf(line: string): string {
  return line.split("— ")[1] ?? "";
}

/** The C3 override block: the V1 block with EXACTLY the three definition lines replaced. */
export function buildC3OverrideBlockV1(): string {
  let block = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED;
  const originals = definitionLinesOf(DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED);
  for (const token of DECISION_PROBE_DECISIONS) {
    const entry = originals.find((candidate) => candidate.token === token);
    if (entry === undefined) throw new Error(`C3: definition line for ${token} not found`);
    const replacement = `  ${token} — ${C3_PARAPHRASE_DEFINITIONS_V1[token as keyof typeof C3_PARAPHRASE_DEFINITIONS_V1]}`;
    block = block.replace(entry.line, replacement);
  }
  return block;
}

/** The frozen C3 block, computed once so every C3 call uses identical bytes. */
export const C3_OVERRIDE_BLOCK = buildC3OverrideBlockV1();

export interface C3AuditV0 {
  readonly audit: string;
  readonly status: "PASS" | "FAIL";
  readonly detail: readonly string[];
}

/** 1. Only the three definition lines changed; everything else is byte-identical. */
export function auditC3ConstructionV0(): C3AuditV0 {
  const base = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.split("\n");
  const c3 = C3_OVERRIDE_BLOCK.split("\n");
  const detail: string[] = [];
  let ok = true;
  if (base.length !== c3.length) {
    ok = false;
    detail.push(`line count changed: ${String(base.length)} -> ${String(c3.length)}`);
  }
  const changed: number[] = [];
  for (let index = 0; index < Math.min(base.length, c3.length); index += 1) {
    if (base[index] !== c3[index]) changed.push(index);
  }
  if (changed.length !== 3) {
    ok = false;
    detail.push(`expected exactly 3 changed lines, found ${String(changed.length)}`);
  }
  for (const index of changed) {
    const isDefinition = DECISION_PROBE_DECISIONS.some((token) => (base[index] ?? "").startsWith(`  ${token} —`));
    if (!isDefinition) {
      ok = false;
      detail.push(`changed line ${String(index)} is not a definition line: ${base[index] ?? ""}`);
    }
  }
  if (ok) detail.push(`exactly lines [${changed.join(", ")}] changed — the three definition lines, nothing else`);
  return { audit: "C3_CONSTRUCTION", status: ok ? "PASS" : "FAIL", detail };
}

/** 2. Lexical separation: no forbidden term, and no shared 6-gram with any frozen fixture. */
export function auditC3LexicalSeparationV0(): C3AuditV0 {
  const detail: string[] = [];
  let ok = true;
  const text = Object.values(C3_PARAPHRASE_DEFINITIONS_V1).join(" ").toLowerCase();
  for (const term of C3_FORBIDDEN_OVERLAP_TERMS) {
    if (new RegExp(`\\b${term}\\b`).test(text)) {
      ok = false;
      detail.push(`forbidden overlap term present: ${term}`);
    }
  }
  for (const fixture of D0_FIXTURES) {
    const words = fixture.observation_text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    for (let start = 0; start + 6 <= words.length; start += 1) {
      const window = words.slice(start, start + 6).join(" ");
      if (text.includes(window)) {
        ok = false;
        detail.push(`shared 6-gram with ${fixture.fixture_id}: "${window}"`);
      }
    }
  }
  if (ok) {
    detail.push(
      `no forbidden term (${C3_FORBIDDEN_OVERLAP_TERMS.join(", ")}); no shared 6-gram across ${String(D0_FIXTURES.length)} fixtures`
    );
  }
  return { audit: "C3_LEXICAL_SEPARATION", status: ok ? "PASS" : "FAIL", detail };
}

/** 3. Symmetry: comparable grammar, information content and length across the three definitions. */
export function auditC3SymmetryV0(): C3AuditV0 {
  const detail: string[] = [];
  let ok = true;
  const counts = DECISION_PROBE_DECISIONS.map((token) => {
    const text = C3_PARAPHRASE_DEFINITIONS_V1[token as keyof typeof C3_PARAPHRASE_DEFINITIONS_V1];
    return { token, words: text.trim().split(/\s+/).length, chars: text.length, endsWithPeriod: text.endsWith(".") };
  });
  const spread = Math.max(...counts.map((c) => c.words)) - Math.min(...counts.map((c) => c.words));
  const frozenSpread = 6;
  if (spread > frozenSpread) {
    ok = false;
    detail.push(`word-count spread ${String(spread)} exceeds the frozen bound ${String(frozenSpread)}`);
  }
  for (const entry of counts) {
    if (entry.endsWithPeriod) {
      ok = false;
      detail.push(`${entry.token} gained terminal punctuation the original style does not use`);
    }
  }
  detail.push(
    `word counts ${counts.map((c) => `${c.token}=${String(c.words)}`).join(" ")} (spread ${String(spread)}); ` +
      `chars ${counts.map((c) => `${c.token}=${String(c.chars)}`).join(" ")}; all three are single unpunctuated clauses`
  );
  return { audit: "C3_SYMMETRY", status: ok ? "PASS" : "FAIL", detail };
}

/** 4. Structural equivalence: both wordings satisfy the same frozen construct skeleton. */
export function auditC3StructuralEquivalenceV0(): C3AuditV0 {
  const detail: string[] = [];
  let ok = true;
  const originals = definitionLinesOf(DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED);
  for (const token of DECISION_PROBE_DECISIONS) {
    const skeleton = CONSTRUCT_SKELETON[token];
    if (skeleton === undefined) {
      ok = false;
      detail.push(`${token}: no skeleton on record`);
      continue;
    }
    const originalEntry = originals.find((entry) => entry.token === token);
    if (originalEntry === undefined) {
      ok = false;
      detail.push(`${token}: original definition line not found`);
      continue;
    }
    const original = definitionTextOf(originalEntry.line).toLowerCase();
    const paraphrase = C3_PARAPHRASE_DEFINITIONS_V1[token as keyof typeof C3_PARAPHRASE_DEFINITIONS_V1].toLowerCase();
    for (const [label, text] of [["original", original], ["paraphrase", paraphrase]] as const) {
      const hasDisposition = skeleton.dispositions.some((marker) => text.includes(marker));
      const hasCondition = skeleton.conditions.some((marker) => text.includes(marker));
      if (!hasDisposition || !hasCondition) {
        ok = false;
        detail.push(
          `${token}/${label}: skeleton unmet (disposition=${String(hasDisposition)}, condition=${String(hasCondition)})`
        );
      }
    }
  }
  if (ok) detail.push("both wordings satisfy the same frozen disposition+condition skeleton for all three tokens");
  return { audit: "C3_STRUCTURAL_EQUIVALENCE", status: ok ? "PASS" : "FAIL", detail };
}

export interface C3ManifestV1 {
  readonly manifest_version: "decision-probe-v1-c3-paraphrase-manifest";
  readonly paraphrase_definitions: typeof C3_PARAPHRASE_DEFINITIONS_V1;
  readonly c3_override_block: string;
  readonly hashes: {
    readonly c3_override_block_hash: HashV1;
    readonly original_override_block_hash: HashV1;
    readonly manifest_hash: HashV1;
  };
  readonly audits: readonly C3AuditV0[];
  readonly all_audits_pass: boolean;
  /** Declared, not proven: semantic equivalence is a human judgement and is NOT machine-verified. */
  readonly semantic_equivalence: "DECLARED_BY_AUTHOR_NOT_MECHANICALLY_PROVEN";
}

export async function deriveC3ManifestV1(): Promise<C3ManifestV1> {
  const audits = [
    auditC3ConstructionV0(),
    auditC3LexicalSeparationV0(),
    auditC3SymmetryV0(),
    auditC3StructuralEquivalenceV0()
  ];
  const c3BlockHash = await hashEnvelope(V1_C3_MANIFEST_HASH_PROJECTION_V0, {
    c3_override_block: C3_OVERRIDE_BLOCK
  });
  const originalBlockHash = await hashEnvelope(V1_C3_MANIFEST_HASH_PROJECTION_V0, {
    original_override_block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED
  });
  const body = {
    paraphrase_definitions: C3_PARAPHRASE_DEFINITIONS_V1,
    c3_override_block: C3_OVERRIDE_BLOCK,
    audits
  };
  return Object.freeze({
    manifest_version: "decision-probe-v1-c3-paraphrase-manifest" as const,
    paraphrase_definitions: C3_PARAPHRASE_DEFINITIONS_V1,
    c3_override_block: C3_OVERRIDE_BLOCK,
    hashes: Object.freeze({
      c3_override_block_hash: c3BlockHash,
      original_override_block_hash: originalBlockHash,
      manifest_hash: await hashEnvelope(V1_C3_MANIFEST_HASH_PROJECTION_V0, body)
    }),
    audits,
    all_audits_pass: audits.every((audit) => audit.status === "PASS"),
    semantic_equivalence: "DECLARED_BY_AUTHOR_NOT_MECHANICALLY_PROVEN" as const
  });
}
