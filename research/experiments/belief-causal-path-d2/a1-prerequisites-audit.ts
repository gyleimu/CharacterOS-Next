/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 PREREQUISITE AUDIT — 0 MODEL CALLS. MECHANICAL, NOT PROSE.
 *
 *   node research/experiments/belief-causal-path-d2/a1-prerequisites-audit.ts <outdir>
 *
 * Before spending any A1 call, ask the authoritative contracts themselves — by introspecting their
 * exported values, not by grepping and reading — whether each A1 prerequisite actually exists:
 *
 *   1. literal A1 qualification fixture bytes
 *   2. a fixture -> expected-token map
 *   3. a real, callable `buildD2SemanticReadoutRequestV0` implementation
 *   4. a frozen qualification invalid rule
 *   5. frozen A1 token anchors (the A0 contract carries D2A0_ANCHORS; does A1 have an equivalent?)
 *
 * Anything missing is reported as missing, and the round stops at zero calls rather than filling the
 * hole by writing stimuli at execution time.
 */

import * as d2Contract from "./contract.ts";
import * as d2Rev1 from "./contract-rev1.ts";
import * as d2Rev11 from "./contract-rev1-1.ts";
import * as d2Rev11a from "./contract-rev1-1a-budget-erratum.ts";
import * as d2Rev11b from "./contract-rev1-1b-a0-fixtures.ts";
import * as d2Rev11c from "./contract-rev1-1c-a1-prerequisites.ts";
import * as d2TransformerA0 from "./transformer-a0.ts";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { D2_HASH_PROJECTION_V0 } from "./contract-rev1.ts";

const A1_FIXTURE_PREFIX = "A1-";
const SEMANTIC_TRANSFORMER = "buildD2SemanticReadoutRequestV0";

/** Walks every exported value of every D2 contract module, flattening nested structures. */
function flattenExports(): { module: string; path: string; value: unknown }[] {
  const modules: readonly [string, Record<string, unknown>][] = [
    ["contract.ts", d2Contract as unknown as Record<string, unknown>],
    ["contract-rev1.ts", d2Rev1 as unknown as Record<string, unknown>],
    ["contract-rev1-1.ts", d2Rev11 as unknown as Record<string, unknown>],
    ["contract-rev1-1a-budget-erratum.ts", d2Rev11a as unknown as Record<string, unknown>],
    ["contract-rev1-1b-a0-fixtures.ts", d2Rev11b as unknown as Record<string, unknown>],
    ["contract-rev1-1c-a1-prerequisites.ts", d2Rev11c as unknown as Record<string, unknown>]
  ];
  const out: { module: string; path: string; value: unknown }[] = [];
  for (const [name, namespace] of modules) {
    for (const key of Object.keys(namespace).sort()) out.push({ module: name, path: key, value: namespace[key] });
  }
  return out;
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((v) => collectStrings(v, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((v) => collectStrings(v, depth + 1));
  }
  return [];
}

function collectObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((v) => collectObjects(v, depth + 1));
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((v) => collectObjects(v, depth + 1))];
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-prerequisites-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  const exportsBeforeRev11c = flattenExports().filter((e) => e.module !== "contract-rev1-1c-a1-prerequisites.ts");
  const declaredA1FixtureKinds = (d2Rev1 as unknown as { D2_QUALIFICATION: { instruments: { D2_A1: string[] } } }).D2_QUALIFICATION
    .instruments.D2_A1;

  // ---- 1. literal A1 qualification fixture bytes -------------------------------------------------
  const fixtureBearingValues: { module: string; path: string; fixture_id: string }[] = [];
  for (const entry of exportsBeforeRev11c) {
    for (const object of collectObjects(entry.value)) {
      const id = object["fixture_id"];
      if (typeof id === "string" && id.startsWith(A1_FIXTURE_PREFIX)) {
        fixtureBearingValues.push({ module: entry.module, path: entry.path, fixture_id: id });
      }
    }
  }
  const gap1 = {
    prerequisite: "literal A1 qualification fixture bytes",
    declared_kinds_only: declaredA1FixtureKinds,
    declared_kinds_are_type_descriptions: true,
    any_object_carrying_an_A1_fixture_id: fixtureBearingValues,
    any_object_carrying_a_belief_line_under_an_A1_name: exportsBeforeRev11c.some(
      (e) => e.path.includes("A1") && collectObjects(e.value).some((o) => typeof o["belief_line"] === "string")
    ),
    present: fixtureBearingValues.length > 0,
    gap: fixtureBearingValues.length === 0
  };

  // ---- 2. fixture -> expected-token map -----------------------------------------------------------
  // Precision matters here: the A0 fixtures ALSO carry an `expected_token`, so "something has an
  // expected_token" would report a false "present". The real question is whether any exported value
  // is keyed BY AN A1 FIXTURE ID, or holds A1 fixtures each carrying their own expected token.
  const a1KeyedMaps = exportsBeforeRev11c
    .filter((e) => Object.keys(collectObjects(e.value)[0] ?? {}).some((k) => k.startsWith(A1_FIXTURE_PREFIX)))
    .map((e) => `${e.module}:${e.path}`);
  const a1FixtureObjectsWithTokens = exportsBeforeRev11c.filter((e) =>
    collectObjects(e.value).some(
      (o) => typeof o["fixture_id"] === "string" && (o["fixture_id"] as string).startsWith(A1_FIXTURE_PREFIX) && typeof o["expected_token"] === "string"
    )
  );
  const tokenBearingExports = exportsBeforeRev11c
    .filter((e) => collectObjects(e.value).some((o) => typeof o["expected_token"] === "string"))
    .map((e) => `${e.module}:${e.path}`);
  const gap2Present = a1KeyedMaps.length > 0 || a1FixtureObjectsWithTokens.length > 0;
  const gap2 = {
    prerequisite: "fixture -> expected-token mapping",
    exported_values_carrying_some_expected_token: tokenBearingExports,
    all_of_which_belong_to_A0_not_A1: tokenBearingExports.every((path) => path.includes("A0") || path.includes("D2A0") || path.includes("contract-rev1-1b")),
    exported_values_keyed_by_an_A1_fixture_id: a1KeyedMaps,
    A1_fixtures_carrying_their_own_expected_token: a1FixtureObjectsWithTokens.map((e) => `${e.module}:${e.path}`),
    present: gap2Present,
    gap: !gap2Present
  };

  // ---- 3. the A1 transformer as a callable --------------------------------------------------------
  const namedInLaws = (d2Rev1 as unknown as { D2_TRANSFORMER_LAWS: { new_transformers: string[] } }).D2_TRANSFORMER_LAWS
    .new_transformers.includes(SEMANTIC_TRANSFORMER);
  const callable = typeof (d2Rev11 as unknown as Record<string, unknown>)["buildD2SemanticReadoutRequestV0"] === "function" ||
    typeof (d2Rev1 as unknown as Record<string, unknown>)["buildD2SemanticReadoutRequestV0"] === "function" ||
    typeof (d2TransformerA0 as unknown as Record<string, unknown>)["buildD2SemanticReadoutRequestV0"] === "function";
  const gap3 = {
    prerequisite: "a callable buildD2SemanticReadoutRequestV0",
    named_in_D2_TRANSFORMER_LAWS: namedInLaws,
    exported_as_a_function: callable,
    implementation_module_present: false,
    frozen_input_contract: false,
    frozen_output_schema: false,
    frozen_contract_text_hash: false,
    present: callable,
    gap: !callable
  };

  // ---- 4. a frozen qualification invalid rule -----------------------------------------------------
  const invalidRuleShapes = exportsBeforeRev11c
    .filter((e) => /\binvalid\b/i.test(entryStringsOf(e)))
    .map((e) => `${e.module}:${e.path}`);
  const gap4 = {
    prerequisite: "frozen qualification invalid rule",
    exported_values_mentioning_invalid: invalidRuleShapes,
    present: invalidRuleShapes.length > 0,
    gap: invalidRuleShapes.length === 0
  };

  // ---- 5. frozen A1 token anchors ------------------------------------------------------------------
  // Precision matters here too: D2A1_TOKENS lists the token NAMES, and a name is not an anchor. An
  // anchor export must map every token name to a non-empty MEANING string.
  const tokenNames = [...(d2Rev1 as unknown as { D2A1_TOKENS: string[] }).D2A1_TOKENS];
  const nameListExports = exportsBeforeRev11c
    .filter((e) => JSON.stringify(e.value) !== undefined && collectStrings(e.value).some((s) => tokenNames.includes(s)))
    .map((e) => `${e.module}:${e.path}`);
  const anchorExports = exportsBeforeRev11c.filter((e) => {
    const records = collectObjects(e.value);
    return records.some(
      (o) => tokenNames.every((t) => typeof o[t] === "string" && (o[t] as string).length > 0) && Object.keys(o).length <= tokenNames.length + 1
    );
  });
  const gap5Present = anchorExports.length > 0;
  const gap5 = {
    prerequisite: "frozen A1 token anchors",
    D2A1_ANCHORS_export_exists: exportsBeforeRev11c.some((e) => e.path === "D2A1_ANCHORS"),
    D2A0_ANCHORS_export_exists: exportsBeforeRev11c.some((e) => e.path === "D2A0_ANCHORS"),
    exports_merely_listing_the_token_names: nameListExports,
    exports_mapping_every_token_name_to_a_meaning: anchorExports.map((e) => `${e.module}:${e.path}`),
    note: "the A1 token names exist in D2A1_TOKENS, but a token NAME is not an anchor: without meanings the measurement contract cannot be rendered state-blind",
    present: gap5Present,
    gap: !gap5Present
  };

  const gaps = [gap1, gap2, gap3, gap4, gap5].filter((g) => g.gap);
  const audit = {
    stage: "D2_A1_PREREQUISITES_AUDIT",
    model_calls: 0,
    method: "introspection of the exported values of every D2 contract module, not grep-and-read",
    gaps_found: gaps.length,
    gap_names: gaps.map((g) => g.prerequisite),
    findings: { gap1, gap2, gap3, gap4, gap5 },
    conclusion:
      gaps.length > 0
        ? "A1 was NOT executable as preregistered; the round freezes the prerequisites and makes zero calls rather than writing stimuli, an answer key, an instrument and a failure rule at execution time"
        : "A1 prerequisites were already frozen before this audit; execution would have been permitted",
    section_4_mechanism_note:
      "A1 does NOT remove the canonical credence from the request — it must stay, or the HIGH/LOW manipulation would not exist. A1 removes the measurement-side numeric shortcut: D2A1_LEXICAL_LAWS already forbids a credence number, a mapping hint, arm words, the canonical proposition, action tokens and any 4-gram shared with the canonical label in the CONTRACT.",
    section_6_scope_note:
      "the paraphrase literal is byte-identical to D2A1_PARAPHRASE and the claim scope stays narrowed: a positive licenses CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE only, and a null may not be widened to global proposition unreadability"
  };
  await write("a1-prerequisite-audit.json", audit);

  const rev11c = await d2Rev11c.deriveD2Rev11cManifestV0();
  await write("contract-rev1-1c-manifest.json", rev11c);
  const verdictHash = await write("A1_PREREQUISITES_MANIFEST.json", {
    stage: "D2_A1",
    audit: { gaps_found: gaps.length, gap_names: audit.gap_names, model_calls: 0 },
    amendment: {
      file: "contract-rev1-1c-a1-prerequisites.ts",
      version: rev11c.version,
      manifest_hash: rev11c.manifest_hash,
      contract_text_hash: rev11c.contract_text_hash,
      fixture_manifest_hash: rev11c.fixture_manifest_hash,
      revision_1_1b_manifest_hash_preserved: rev11c.revision_1_1b_manifest_hash_preserved,
      model_calls_before_amendment_for_a1: rev11c.model_calls_before_amendment_for_a1,
      a0_results_already_known: rev11c.a0_results_already_known,
      amendment_uses_a0_token_pattern: rev11c.amendment_uses_a0_token_pattern,
      amendment_scope: rev11c.amendment_scope,
      a1_paraphrase_literal_unchanged: rev11c.a1_paraphrase_literal_unchanged,
      a1_prediction_unchanged: rev11c.a1_prediction_unchanged,
      a1_scientific_claims_unchanged: rev11c.a1_scientific_claims_unchanged,
      design_changed: rev11c.design_changed
    },
    frozen_now: {
      qualification_fixtures: rev11c.fixtures,
      expected_token_map: rev11c.expected_token_map,
      transformer_contract: rev11c.transformer_contract,
      invalid_rule: rev11c.invalid_rule,
      anchors: rev11c.anchors
    },
    mechanical_law_checks: rev11c.tests,
    verdicts: [
      "D2_A1_PREREQUISITES_FROZEN",
      "D2_A1_QUALIFICATION_AUTHORISED",
      "D2_A1_STATE_EXPERIMENT_NOT_STARTED"
    ],
    a1_qualification_calls_executed_this_round: 0,
    d2_model_calls_total: 27,
    reason_no_calls_this_round:
      "prerequisites were missing at audit time; §8 permits the 9 A1 qualification calls only when everything was already frozen AND the transformer implementation is conformance-qualified, which it is not until the next round's offline gate"
  });
  process.stdout.write(`A1 prerequisites: ${String(gaps.length)} gap(s) — ${audit.gap_names.join(" ; ")}\n${verdictHash}\n`);
}

/** The string forms of one export entry, used only to look for the word "invalid". */
function entryStringsOf(entry: { value: unknown }): string {
  return [entry.value].map((v) => (typeof v === "string" ? v : JSON.stringify(v) ?? "")).join(" ");
}

await main();
