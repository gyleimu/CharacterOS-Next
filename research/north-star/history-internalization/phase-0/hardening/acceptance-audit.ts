/**
 * ACCEPTANCE-SET AUDIT — 0 provider calls.
 *
 *   npx tsx phase-0/hardening/acceptance-audit.ts <outdir>
 *
 * Runs BEFORE any provider call, because a schema whose constraint does not constrain produces a
 * meaningless probe. For every candidate formulation this computes the accepted set over an
 * enumerated corpus and reports:
 *
 *   - does the formulation actually FORBID the targeted combination?
 *   - how does its accepted set compare with the INTENDED invariant?
 *   - is the instrument falsifiable (do the mutations really change the payload bytes)?
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { accepts, type SchemaV0 } from "./schema-evaluator.ts";


/**
 * The INTENDED acceptor is NOT the conditional rule alone: it is the BASE structural schema
 * INTERSECTED with the conditional rule, exactly as production is `structural validator` AND
 * `semantic completeness validator`. Modelling intent as the conditional alone would wrongly
 * "accept" structurally invalid documents and report false divergences — which is what the first
 * version of this audit did.
 */
const BASE_STRUCTURAL: SchemaV0 = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "selection", "note"],
  properties: {
    mode: { enum: ["FACT", "STANCE", "ACT"] },
    selection: { enum: ["SELECTED", "NONE"] },
    note: { type: "string", maxLength: 40 }
  }
};

function intendedAccepts(instance: unknown): boolean {
  if (!accepts(BASE_STRUCTURAL, instance)) return false;
  const record = instance as Record<string, unknown>;
  if (record["mode"] === "STANCE" && record["selection"] !== "SELECTED") return false;
  return true;
}

const BASE_PROPERTIES = Object.freeze({
  mode: { enum: ["FACT", "STANCE", "ACT"] },
  selection: { enum: ["SELECTED", "NONE"] },
  note: { type: "string", maxLength: 40 }
});
const BASE_REQUIRED = Object.freeze(["mode", "selection", "note"]);

/** FORMULATION 1 — if/then. */
const IF_THEN: SchemaV0 = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED],
  properties: { ...BASE_PROPERTIES },
  if: { properties: { mode: { const: "STANCE" } }, required: ["mode"] },
  then: { properties: { selection: { const: "SELECTED" } } }
};

/** FORMULATION 2 (as FIRST sent) — branch 2 left `mode` free, so it did NOT forbid the target. */
const ONE_OF_DEFECTIVE: SchemaV0 = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: { ...BASE_PROPERTIES, mode: { const: "STANCE" }, selection: { const: "SELECTED" } }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: { ...BASE_PROPERTIES, selection: { const: "NONE" } }
    }
  ]
};

/** FORMULATION 2 (CORRECTED) — branch 2 now excludes mode == STANCE. */
const ONE_OF_CORRECTED: SchemaV0 = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: { ...BASE_PROPERTIES, mode: { const: "STANCE" }, selection: { const: "SELECTED" } }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...BASE_REQUIRED],
      properties: { ...BASE_PROPERTIES, mode: { enum: ["FACT", "ACT"] }, selection: { const: "NONE" } }
    }
  ]
};


const corpusSeed: { id: string; kind: "VALID" | "TARGET_FORBIDDEN" | "STRUCTURALLY_INVALID"; instance: Record<string, unknown> }[] = [
  { id: "stance_selected", kind: "VALID", instance: { mode: "STANCE", selection: "SELECTED", note: "probe" } },
  { id: "fact_none", kind: "VALID", instance: { mode: "FACT", selection: "NONE", note: "probe" } },
  { id: "fact_selected", kind: "VALID", instance: { mode: "FACT", selection: "SELECTED", note: "probe" } },
  { id: "act_none", kind: "VALID", instance: { mode: "ACT", selection: "NONE", note: "probe" } },
  { id: "act_selected", kind: "VALID", instance: { mode: "ACT", selection: "SELECTED", note: "probe" } },
  { id: "TARGET_stance_none", kind: "TARGET_FORBIDDEN", instance: { mode: "STANCE", selection: "NONE", note: "probe" } },
  { id: "missing_key", kind: "STRUCTURALLY_INVALID", instance: { mode: "FACT", selection: "NONE" } },
  { id: "extra_key", kind: "STRUCTURALLY_INVALID", instance: { mode: "FACT", selection: "NONE", note: "probe", extra: "x" } },
  { id: "wrong_enum", kind: "STRUCTURALLY_INVALID", instance: { mode: "NOPE", selection: "NONE", note: "probe" } },
  { id: "wrong_type", kind: "STRUCTURALLY_INVALID", instance: { mode: 7, selection: "NONE", note: "probe" } }
];

function audit(schemaName: string, schema: SchemaV0): Record<string, unknown> {
  const rows = corpusSeed.map((row) => {
    const schemaAccepts = accepts(schema, row.instance);
    const intendedVerdict = intendedAccepts(row.instance);
    return {
      id: row.id,
      kind: row.kind,
      schema_accepts: schemaAccepts,
      intended_validation_accepts: intendedAccepts,
      agrees: schemaAccepts === intendedVerdict
    };
  });
  const targetRow = rows.find((row) => row.id === "TARGET_stance_none") as { schema_accepts: boolean };
  return {
    schema: schemaName,
    forbids_the_targeted_combination: targetRow.schema_accepts === false,
    accepted_set_matches_intended_invariant: rows.every((row) => row.agrees),
    divergences: rows.filter((row) => !row.agrees).map((row) => ({ id: row.id, kind: row.kind, schema_accepts: row.schema_accepts })),
    rows
  };
}

function main(): void {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("ACCEPTANCE_AUDIT_USAGE: usage: acceptance-audit.ts <outdir>");
  mkdirSync(outdir, { recursive: true });

  const ifThen = audit("IF_THEN", IF_THEN);
  const oneOfDefective = audit("ONE_OF_AS_FIRST_SENT", ONE_OF_DEFECTIVE);
  const oneOfCorrected = audit("ONE_OF_CORRECTED", ONE_OF_CORRECTED);

  // ---- §7 mutation audit: each mutation must really change the payload bytes -------------------
  const baselineRow = corpusSeed.find((row) => row.id === "stance_selected");
  if (baselineRow === undefined) throw new Error("ACCEPTANCE_AUDIT_CORPUS: the baseline row is missing");
  const baseline = baselineRow.instance;
  const mutations: { id: string; mutation: string; from: Record<string, unknown>; to: Record<string, unknown> }[] = [
    { id: "M1", mutation: "SELECTED -> NONE", from: baseline, to: { ...baseline, selection: "NONE" } },
    { id: "M2", mutation: "STANCE -> ACT", from: baseline, to: { ...baseline, mode: "ACT" } },
    { id: "M3", mutation: "delete selection", from: baseline, to: { mode: baseline["mode"], note: baseline["note"] } },
    { id: "M4", mutation: "add unknown key", from: baseline, to: { ...baseline, extra: "x" } },
    { id: "M5", mutation: "change note bytes", from: baseline, to: { ...baseline, note: "probe2" } }
  ];
  const mutationRows = mutations.map((mutation) => {
    const bytesChanged = JSON.stringify(mutation.from) !== JSON.stringify(mutation.to);
    const correctedBaseline = accepts(ONE_OF_CORRECTED, mutation.from);
    const correctedMutated = accepts(ONE_OF_CORRECTED, mutation.to);
    const intendedBaseline = intendedAccepts(mutation.from);
    const intendedMutated = intendedAccepts(mutation.to);
    return {
      id: mutation.id,
      mutation: mutation.mutation,
      payload_bytes_actually_changed: bytesChanged,
      corrected_schema_verdict_changed: correctedBaseline !== correctedMutated,
      intended_verdict_changed: intendedBaseline !== intendedMutated,
      corrected_schema_matches_intent_on_the_mutation: correctedMutated === intendedMutated
    };
  });

  const artifact = {
    artifact: "OLD_VS_NEW_ACCEPTANCE_SET_AUDIT",
    provider_calls: 0,
    purpose:
      "prove locally, BEFORE any provider call, which candidate schemas actually forbid the targeted combination and how their accepted sets compare with the intended invariant",
    intended_invariant: 'mode == "STANCE" => selection == "SELECTED"',
    corpus_size: corpusSeed.length,
    formulations: {
      IF_THEN: ifThen,
      ONE_OF_AS_FIRST_SENT: oneOfDefective,
      ONE_OF_CORRECTED: oneOfCorrected
    },
    the_defect_the_audit_caught: {
      which: "ONE_OF_AS_FIRST_SENT",
      defect: "branch 2 constrained only `selection: NONE` and left `mode` free, so (STANCE, NONE) was a lawful member of the union.",
      consequence: "that formulation does NOT forbid the targeted combination, so its provider result could not distinguish ENFORCED from IGNORED. Any reading taken from it is void.",
      how_it_was_caught: "by computing the accepted set locally instead of trusting the schema's intent",
      law: "a constraint that does not constrain proves nothing"
    },
    mutation_audit: {
      artifact: "CONTRACT_EQUIVALENCE_MUTATION_AUDIT",
      rows: mutationRows,
      every_mutation_changed_the_payload_bytes: mutationRows.every((row) => row.payload_bytes_actually_changed),
      falsifiable: mutationRows.every((row) => row.payload_bytes_actually_changed)
    },
    conclusion: {
      IF_THEN_is_a_valid_instrument: ifThen["forbids_the_targeted_combination"] === true,
      ONE_OF_CORRECTED_is_a_valid_instrument: oneOfCorrected["forbids_the_targeted_combination"] === true,
      ONE_OF_AS_FIRST_SENT_is_a_valid_instrument: oneOfDefective["forbids_the_targeted_combination"] === true
    }
  };
  writeFileSync(join(outdir, "OLD_VS_NEW_ACCEPTANCE_SET_AUDIT.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  writeFileSync(
    join(outdir, "CONTRACT_EQUIVALENCE_MUTATION_AUDIT.json"),
    `${JSON.stringify(
      {
        artifact: "CONTRACT_EQUIVALENCE_MUTATION_AUDIT",
        provider_calls: 0,
        rows: artifact.mutation_audit.rows,
        every_mutation_changed_the_payload_bytes: artifact.mutation_audit.every_mutation_changed_the_payload_bytes,
        falsifiable: artifact.mutation_audit.falsifiable
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log("ACCEPTANCE-SET AUDIT (0 provider calls)");
  for (const [name, result] of Object.entries(artifact.formulations)) {
    const typed = result as Record<string, unknown>;
    console.log(
      `  ${name.padEnd(24)} forbids_target=${String(typed["forbids_the_targeted_combination"]).padEnd(5)} matches_intent=${String(typed["accepted_set_matches_intended_invariant"])}`
    );
  }
  console.log(`  every mutation changed the bytes: ${String(artifact.mutation_audit.every_mutation_changed_the_payload_bytes)}`);
}

main();
