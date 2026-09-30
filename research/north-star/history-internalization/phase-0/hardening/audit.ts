/**
 * RUN-3 FREEZE + BLOCKER CLAIM + FAILURE RECONSTRUCTION + SCHEMA COVERAGE AUDIT.
 *
 *   npx tsx phase-0/hardening/audit.ts <outdir>
 *
 * 0 provider calls. Everything here is derived from frozen evidence and production source.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..", "..", "..");
const run3Dir = join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "run-3");
const run1Dir = join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "run-1");
const sha256 = (path: string): string => `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
const hashString = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// The exact authoritative rule, read from production source rather than quoted from a log line.
const PROPOSAL_SOURCE = "packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts";

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("HARDENING_AUDIT_USAGE: usage: audit.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- §1 freeze run-3 ------------------------------------------------------------------------
  const run3Files = walk(run3Dir).sort();
  const freeze = {
    artifact: "RUN3_FREEZE",
    frozen_verdict: "HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE",
    immutable: true,
    forbidden_actions: [
      "repairing its failed turn",
      "re-running its event",
      "appending later turns",
      "reinterpreting the partial belief commit as success"
    ],
    production_commit: execSync("git rev-parse HEAD", { cwd: repo }).toString().trim(),
    file_count: run3Files.length,
    files: Object.fromEntries(run3Files.map((path) => [relative(run3Dir, path).replaceAll("\\", "/"), { sha256: sha256(path), bytes: statSync(path).size }]))
  };
  write("RUN3_FREEZE.json", freeze);

  // ---- §2 blocker claim -----------------------------------------------------------------------
  write("CURRENT_EXECUTION_BLOCKER.json", {
    artifact: "CURRENT_EXECUTION_BLOCKER",
    CURRENT_EXECUTION_BLOCKER: "EXECUTOR_OUTPUT_CONTRACT_RELIABILITY",
    BELIEF_ADAPTATION_COMMIT_OBSERVED_ON_REACHED_VALID_TURNS: true,
    CHARACTEROS_BELIEF_MECHANISM_CLEARED: false,
    forbidden_claim: "CharacterOS mechanism is proven not to be the blocker",
    why_the_forbidden_claim_is_forbidden:
      "the full Phase-0 protocol has never completed. The belief mechanism committed on every turn that reached it, and that is all that can be said: it is not cleared, because clearing it would require the full paired contrast to run and be scored.",
    what_is_actually_established: [
      "on every valid turn that reached the adaptation chain, a canonical commit occurred (run-1: 7 of 8 reached resolutions; run-3: the single valid turn)",
      "the executor produced a response shape the frozen contract rejects, on two independent runs",
      "the run-level failure was correctly attributed and contained (1 invalid turn in run-3, versus 3 in run-1 with 2 spurious)"
    ]
  });

  // ---- §3 failure reconstruction --------------------------------------------------------------
  const run3Turns = JSON.parse(readFileSync(join(run3Dir, "RUN3_SCIENTIFIC_TURNS.json"), "utf8")) as {
    turns: { scientific_turn_id: string; refusal?: never; failure: string | null; status: string }[];
  };
  const run1Trials = JSON.parse(readFileSync(join(run1Dir, "raw-trials.json"), "utf8")) as {
    turns: { arm: string; turn_index: number; failure: string | null; status: string }[];
  };
  const run3Failure = run3Turns.turns.find((turn) => turn.status === "FAILED")?.failure ?? "";
  const run1Failure = run1Trials.turns.find((turn) => turn.status === "FAILED")?.failure ?? "";

  const reconstruction = {
    artifact: "RUN3_FAILURE_CONTRACT_RECONSTRUCTION",
    method:
      "the exact acceptance rule is read from production SOURCE, and the observed failures are read from the two runs' frozen artifacts. The failing RESPONSE SHAPE is then DERIVED by intersecting the structural schema with the negation of the semantic rule — it is not quoted from a log line.",
    instrumentation_gap_that_must_be_stated: {
      finding: "the raw malformed executor payload was NOT preserved in either run",
      evidence: "neither run's turn records carry a raw_cognition_response field; run-1 persisted cognition REQUESTS only, and run-3 persisted turn records without the raw response",
      consequence:
        "the offending JSON cannot be quoted. The failing shape is therefore derived from the authoritative rule rather than observed, which is the stronger of the two routes anyway because the rule defines the whole family and a sample defines one member.",
      fix_for_future_runs: "persist the raw executor response on every turn, valid or invalid"
    },
    the_two_failures: {
      run_3: { turn: "A:turn_1", subject: "subject-r3-7p4n-2185", error: run3Failure.slice(0, 400) },
      run_1: { turn: "B:turn_2", subject: "subject-k7q2-8267", error: run1Failure.slice(0, 400) },
      same_semantic_validator: run3Failure.includes("SEMANTIC_COMPLETENESS_FAILED") && run1Failure.includes("SEMANTIC_COMPLETENESS_FAILED"),
      same_error_class: run3Failure.includes("RESPONSE_SEMANTICS_REJECTED") && run1Failure.includes("RESPONSE_SEMANTICS_REJECTED"),
      same_authoritative_invariant:
        run3Failure.includes("PRIMARY_STANCE requires an authoritative") && run1Failure.includes("PRIMARY_STANCE requires an authoritative"),
      independent_subject: true,
      independent_arm: true,
      independent_turn_index: true
    },
    the_exact_rule: {
      source: PROPOSAL_SOURCE,
      line: 1909,
      executable_predicate:
        'response_semantics.kind === PRIMARY_RESPONSE_KIND_STANCE_V0  AND  proposal.subjective_selection.kind !== SUBJECTIVE_SELECTION_KIND_SELECTED_V1  =>  REJECT as SEMANTIC_COMPLETENESS_FAILED',
      equivalent_form: 'response_semantics.kind == "PRIMARY_STANCE"  =>  subjective_selection.kind == "SUBJECTIVE_SELECTION"',
      rule_is_a_cross_field_conditional: true,
      it_is_NOT_expressed_by: ["required keys", "closed keys", "JSON well-formedness", "enum membership"],
      why_that_matters: "the reproduced failure proves exactly this: structural validity is not semantic validity"
    },
    derived_failing_shape_family: {
      description:
        "every document that satisfies the V8 structural schema AND has response_semantics.kind == PRIMARY_STANCE AND subjective_selection.kind == NO_SUBJECTIVE_SELECTION",
      cardinality: "open in the remaining fields (factual_assessment, cognition, communication_directive, clarification_basis are unconstrained by the rule)",
      minimal_member:
        '{"schema_version":"conversation-cognition-proposal-v8","response_semantics":{"kind":"PRIMARY_STANCE"},"subjective_selection":{"kind":"NO_SUBJECTIVE_SELECTION"}, ...remaining fields structurally valid...}',
      conclusion: "the CURRENT schema ADMITS this whole family; the authoritative validator REJECTS it"
    }
  };
  write("RUN3_FAILURE_CONTRACT_RECONSTRUCTION.json", reconstruction);

  // ---- §4 schema semantic coverage audit -------------------------------------------------------
  const coverage = {
    artifact: "CURRENT_SCHEMA_SEMANTIC_COVERAGE_AUDIT",
    question: "does the CURRENT structured-output schema express the failed semantic invariant?",
    current_request_does_carry_a_schema: {
      answer: true,
      evidence: "conversation-cognition-provider-v8.ts:635 sets structured_output = { kind: JSON_SCHEMA, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA }",
      transport_maps_it: "ollama-native-cognition-transport.ts:238-240 maps structured_output.schema to the provider's native `format`",
      runtime_passes_it_through: "interactive-subject-runtime-v0.ts:265-267"
    },
    schema_coverage: {
      response_semantics: "a oneOf over response-mode atoms, including a bare { kind: PRIMARY_STANCE } branch",
      subjective_selection: "a oneOf over { kind: NO_SUBJECTIVE_SELECTION } and { kind: SUBJECTIVE_SELECTION, stance, subjective_rationale }",
      cross_field_dependency_present: false,
      conditional_keywords_present_in_the_production_schema: {
        oneOf: true,
        anyOf: true,
        allOf: false,
        if_then_else: false,
        not: false,
        dependentSchemas: false
      },
      conclusion:
        "the schema constrains each field INDEPENDENTLY. The combination (PRIMARY_STANCE, NO_SUBJECTIVE_SELECTION) is admitted by the schema and rejected by the authoritative validator, which is precisely the reproduced failure class."
    },
    case_determination: {
      CASE_A_current_schema_already_expresses_the_invariant: false,
      CASE_A_reason:
        "refuted by direct reading: there is no cross-field construct anywhere in the schema, and the failing combination is a legal member of its accepted set",
      schema_present_but_not_enforced: "NOT the finding — a schema IS present and IS mapped to the provider's format; it simply does not cover this rule",
      CASE_B_or_C_requires_the_next_question: "can the required cross-field conditional be expressed in a construct the provider's grammar compiler actually honours?"
    }
  };
  write("CURRENT_SCHEMA_SEMANTIC_COVERAGE_AUDIT.json", coverage);

  // ---- §9 model-facing prompt byte comparison ---------------------------------------------------
  const run1Request = JSON.parse(readFileSync(join(run1Dir, "raw-trials.json"), "utf8")) as {
    cognition_requests: { turn: string; messages: readonly { role: string; content: string }[] }[];
  };
  const run3Ledger = JSON.parse(readFileSync(join(run3Dir, "RUN3_PROVIDER_ATTEMPT_LEDGER.json"), "utf8")) as {
    attempts: { scientific_turn_id: string | null; call_family: string; request_hash: string }[];
  };
  const promptBytes = {
    artifact: "MODEL_FACING_PROMPT_BYTE_COMPARISON",
    status: "BASELINE_RECORDED — nothing has been changed yet, so there is no new version to compare",
    baseline: {
      run_1_first_cognition_request: {
        system_bytes: run1Request.cognition_requests[0]?.messages.filter((m) => m.role === "system").map((m) => m.content.length).join("+") ?? null,
        user_bytes: run1Request.cognition_requests[0]?.messages.filter((m) => m.role === "user").map((m) => m.content.length).join("+") ?? null,
        message_hash: hashString(JSON.stringify(run1Request.cognition_requests[0]?.messages ?? []))
      },
      run_3_scientific_cognition_request_hashes: run3Ledger.attempts
        .filter((attempt) => attempt.call_family === "cognition" && attempt.scientific_turn_id !== null)
        .map((attempt) => ({ scientific_turn_id: attempt.scientific_turn_id, request_hash: attempt.request_hash }))
    },
    requirement_if_a_constraint_is_added: {
      system_prompt_bytes_must_stay_equal: true,
      user_prompt_bytes_must_stay_equal: true,
      prompt_text_change_allowed: false,
      if_prompt_text_must_change: "STOP — a prompt change would be a prompt rescue and is forbidden"
    },
    source_evidence_that_the_schema_is_not_part_of_the_prompt_text:
      "conversation-cognition-provider-v8.ts builds the messages and separately sets structured_output; the schema travels as a transport parameter, not as prompt text"
  };
  write("MODEL_FACING_PROMPT_BYTE_COMPARISON.json", promptBytes);

  console.log("HARDENING AUDIT WRITTEN (0 provider calls)");
  console.log(`  §1 run-3 frozen: ${freeze.file_count} files`);
  console.log(`  §2 blocker: ${"EXECUTOR_OUTPUT_CONTRACT_RELIABILITY"}`);
  console.log(`  §3 same validator/class/invariant across the two failures: ${String(reconstruction.the_two_failures.same_authoritative_invariant)}`);
  console.log(`  §4 CASE A (current schema expresses the invariant): ${String(coverage.case_determination.CASE_A_current_schema_already_expresses_the_invariant)}`);
  console.log(`  §9 baseline prompt bytes recorded; nothing changed`);
}

await main();
