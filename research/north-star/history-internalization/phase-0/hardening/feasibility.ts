/**
 * CONSTRAINED-OUTPUT FEASIBILITY PROBE — bounded, non-scientific.
 *
 *   npx tsx phase-0/hardening/feasibility.ts <outdir>
 *
 * THE ONE QUESTION: can the required cross-field conditional
 *
 *     response_semantics.kind == "PRIMARY_STANCE"  =>  subjective_selection.kind == "SELECTED"
 *
 * be expressed in a construct the provider's constrained decoding ACTUALLY HONOURS?
 *
 * This is NOT scientific. It uses no Phase-0 trajectory text, no target proposition, no treatment
 * event, and no subject state. It contains a toy schema and a tiny field vocabulary.
 *
 * It is also not an assumption: the whole point is that a schema keyword may be silently IGNORED
 * by the grammar compiler, which would make the "fix" worthless. Each formulation is therefore
 * tested by ASKING FOR THE FORBIDDEN COMBINATION and observing whether the provider can emit it.
 *
 *   provider ACCEPTS the constraint and the forbidden combination NEVER appears  -> ENFORCED
 *   provider ACCEPTS the constraint but the forbidden combination APPEARS        -> IGNORED (unsafe)
 *   provider REJECTS the constraint                                              -> UNSUPPORTED
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
const MODEL = process.env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
/** Frozen before the first probe. No run-until-success. */
const PROBES_PER_FORMULATION = 2 as const;

const sha256 = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** The forbidden combination this formulation must prevent. */
const FORBIDDEN = Object.freeze({ mode: "STANCE", selection: "NONE" });

/**
 * A toy field vocabulary that stands in for the real one:
 *   mode       ~ response_semantics.kind   (STANCE ~ PRIMARY_STANCE)
 *   selection  ~ subjective_selection.kind (SELECTED ~ SUBJECTIVE_SELECTION, NONE ~ NO_SUBJECTIVE_SELECTION)
 * The shape of the required conditional is identical to production's; only the names differ.
 */
const BASE_PROPERTIES = Object.freeze({
  mode: { enum: ["FACT", "STANCE", "ACT"] },
  selection: { enum: ["SELECTED", "NONE"] },
  note: { type: "string", maxLength: 40 }
});

const BASE_REQUIRED = Object.freeze(["mode", "selection", "note"]);

/** FORMULATION 1 — the standard JSON Schema cross-field conditional (`if`/`then`). */
const SCHEMA_IF_THEN = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED],
  properties: { ...BASE_PROPERTIES },
  if: { properties: { mode: { const: "STANCE" } }, required: ["mode"] },
  then: { properties: { selection: { const: "SELECTED" } } }
});

/** FORMULATION 2 — a top-level `oneOf` of whole-object variants: a keyword the production schema ALREADY relies on. */
const SCHEMA_ONE_OF = Object.freeze({
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: {
        ...BASE_PROPERTIES,
        mode: { const: "STANCE" },
        selection: { const: "SELECTED" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: {
        ...BASE_PROPERTIES,
        selection: { const: "NONE" }
      }
    }
  ]
});

/**
 * The prompt that DEMANDS the forbidden combination. If the grammar enforces the conditional, the
 * provider must produce something else — that is the whole test.
 */
const PROBE_PROMPT =
  'Reply with one JSON object with exactly three keys: "mode", "selection", "note". ' +
  'Set "mode" to the string STANCE. Set "selection" to the string NONE. ' +
  'Set "note" to "probe". Output the JSON object only, with no other text.';

interface ProbeResultV0 {
  readonly formulation: "IF_THEN" | "ONE_OF";
  readonly ordinal: number;
  readonly schema_accepted: boolean;
  readonly http_status: number | null;
  readonly error: string | null;
  readonly raw_content: string | null;
  readonly parsed_mode: string | null;
  readonly parsed_selection: string | null;
  readonly emitted_the_forbidden_combination: boolean;
  readonly latency_ms: number;
}

async function probe(formulation: "IF_THEN" | "ONE_OF", ordinal: number): Promise<ProbeResultV0> {
  const schema = formulation === "IF_THEN" ? SCHEMA_IF_THEN : SCHEMA_ONE_OF;
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You emit a single JSON object and nothing else." },
          { role: "user", content: PROBE_PROMPT }
        ],
        format: schema,
        think: false,
        stream: false,
        options: { temperature: 0, num_predict: 256, num_ctx: 2048 }
      }),
      signal: AbortSignal.timeout(120_000)
    });
    const latency = Date.now() - started;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        formulation,
        ordinal,
        schema_accepted: false,
        http_status: response.status,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        raw_content: null,
        parsed_mode: null,
        parsed_selection: null,
        emitted_the_forbidden_combination: false,
        latency_ms: latency
      };
    }
    const body = (await response.json()) as { message?: { content?: string } };
    const content = body.message?.content ?? null;
    let mode: string | null = null;
    let selection: string | null = null;
    try {
      const parsed = JSON.parse(content ?? "") as { mode?: unknown; selection?: unknown };
      mode = typeof parsed.mode === "string" ? parsed.mode : null;
      selection = typeof parsed.selection === "string" ? parsed.selection : null;
    } catch {
      // leave nulls; a non-JSON body is itself a finding
    }
    return {
      formulation,
      ordinal,
      schema_accepted: true,
      http_status: response.status,
      error: null,
      raw_content: content,
      parsed_mode: mode,
      parsed_selection: selection,
      emitted_the_forbidden_combination: mode === FORBIDDEN.mode && selection === FORBIDDEN.selection,
      latency_ms: latency
    };
  } catch (error) {
    return {
      formulation,
      ordinal,
      schema_accepted: false,
      http_status: null,
      error: error instanceof Error ? error.message : String(error),
      raw_content: null,
      parsed_mode: null,
      parsed_selection: null,
      emitted_the_forbidden_combination: false,
      latency_ms: Date.now() - started
    };
  }
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("FEASIBILITY_USAGE: usage: feasibility.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const frozenDesign = {
    artifact: "CONSTRAINED_OUTPUT_FEASIBILITY_DESIGN",
    frozen_before_first_probe: true,
    non_scientific: true,
    contains_phase0_content: false,
    question:
      "can the required cross-field conditional be expressed in a construct the provider's constrained decoding actually honours?",
    why_a_probe_and_not_an_assumption:
      "a schema keyword can be SILENTLY IGNORED by a grammar compiler. Assuming enforcement would produce a 'fix' that does nothing while appearing to work.",
    probes_per_formulation: PROBES_PER_FORMULATION,
    total_probes: PROBES_PER_FORMULATION * 2,
    run_until_success_forbidden: true,
    formulations: {
      IF_THEN: { schema: SCHEMA_IF_THEN, keyword_set: "if/then — NOT used anywhere in the production schema" },
      ONE_OF: { schema: SCHEMA_ONE_OF, keyword_set: "oneOf over whole-object variants — a keyword the production schema ALREADY relies on" }
    },
    the_prompt_demands_the_forbidden_combination: PROBE_PROMPT,
    forbidden_combination: FORBIDDEN,
    decisive_reading: {
      ENFORCED: "schema accepted AND the forbidden combination never appears",
      IGNORED_UNSAFE: "schema accepted AND the forbidden combination appears",
      UNSUPPORTED: "schema rejected by the provider"
    },
    model: MODEL,
    base_url: BASE_URL
  };
  write("CONSTRAINED_OUTPUT_FEASIBILITY_DESIGN.json", frozenDesign);
  write("CONSTRAINED_OUTPUT_FEASIBILITY_DESIGN_HASH.json", { design_hash: sha256(JSON.stringify(frozenDesign)) });

  const results: ProbeResultV0[] = [];
  for (const formulation of ["IF_THEN", "ONE_OF"] as const) {
    for (let ordinal = 1; ordinal <= PROBES_PER_FORMULATION; ordinal += 1) {
      const result = await probe(formulation, ordinal);
      results.push(result);
      write(`feasibility-${formulation.toLowerCase()}-${String(ordinal).padStart(3, "0")}.json`, result);
      console.log(
        `${formulation} probe ${ordinal}/${PROBES_PER_FORMULATION}: accepted=${String(result.schema_accepted)} ` +
          `mode=${String(result.parsed_mode)} selection=${String(result.parsed_selection)} ` +
          `forbidden=${String(result.emitted_the_forbidden_combination)} ${result.error ?? ""}`
      );
    }
  }

  const summarise = (formulation: "IF_THEN" | "ONE_OF"): Record<string, unknown> => {
    const rows = results.filter((result) => result.formulation === formulation);
    const accepted = rows.length > 0 && rows.every((row) => row.schema_accepted);
    const emitted = rows.some((row) => row.emitted_the_forbidden_combination);
    return {
      schema_accepted: accepted,
      forbidden_combination_emitted: emitted,
      verdict: !accepted ? "UNSUPPORTED" : emitted ? "IGNORED_UNSAFE" : "ENFORCED",
      rows: rows.map((row) => ({ ordinal: row.ordinal, mode: row.parsed_mode, selection: row.parsed_selection, forbidden: row.emitted_the_forbidden_combination }))
    };
  };
  const ifThen = summarise("IF_THEN");
  const oneOf = summarise("ONE_OF");
  const enforced = [ifThen, oneOf].filter((entry) => entry["verdict"] === "ENFORCED");

  const verdict = {
    artifact: "CONSTRAINED_OUTPUT_FEASIBILITY_VERDICT",
    probes_executed: results.length,
    probes_planned: PROBES_PER_FORMULATION * 2,
    planned_equals_actual: results.length === PROBES_PER_FORMULATION * 2,
    if_then: ifThen,
    one_of: oneOf,
    CASE: enforced.length > 0 ? "B_CONDITIONAL_IS_EXPRESSIBLE_AND_ENFORCED" : "C_CONSTRAINT_CANNOT_FAITHFULLY_ENFORCE_THE_REPRODUCED_FAILURE_CLASS",
    enforcement_is_established_for: enforced.map((entry) => (entry === ifThen ? "IF_THEN" : "ONE_OF")),
    what_a_CASE_C_verdict_means:
      "the constraint mechanism cannot be shown to enforce the invariant faithfully, so grammar-constrained decoding must NOT be applied as a claimed fix. The decision then passes to the operator: keep the executor and accept the reliability risk, or swap the executor.",
    what_was_NOT_done: [
      "no retry to obtain an enforcement result",
      "no prompt strengthening",
      "no scientific content in any probe",
      "no Phase-0 turn executed"
    ]
  };
  write("CONSTRAINED_OUTPUT_FEASIBILITY_VERDICT.json", verdict);

  console.log("");
  console.log(`FEASIBILITY: ${String(verdict.CASE)}`);
  console.log(`  IF_THEN: ${String(ifThen["verdict"])}  |  ONE_OF: ${String(oneOf["verdict"])}`);
}

await main();
