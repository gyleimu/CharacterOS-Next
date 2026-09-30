/**
 * RUN-2 CLOSURE + POLICY + ENVIRONMENT ARTIFACTS — 0 provider generation.
 *
 *   npx tsx phase-0/readiness/closure.ts <outdir>
 *
 * Produces, without invoking generation:
 *   RUN2_PROVIDER_BLOCK_CLOSURE.json    (§1)  freeze run-2 as a pre-scientific infrastructure block
 *   RUN2_PROVIDER_ATTEMPT_LEDGER.json   (§2)  exact accounting of every real provider attempt
 *   SUBJECT_ID_LEAKAGE_POLICY.json      (§3)  the model-visible identity policy
 *   PROVIDER_CAPACITY_REQUIREMENT.json  (§7)  the readiness criterion and its derivation
 *   VRAM_ENVIRONMENT_SNAPSHOT.json      (§8)  environment diagnostics (NOT a scientific gate)
 *   PROVIDER_READINESS_REQUEST.json     (§6)  the frozen probe bytes
 *   PROVIDER_READINESS_REQUEST_HASH.json (§6)
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  READINESS_CAPACITY_REQUIREMENT,
  READINESS_EXECUTION_RULE,
  READINESS_MODEL,
  READINESS_MODEL_DIGEST_FROZEN,
  READINESS_OLLAMA_BASE_URL,
  READINESS_PROBES_PLANNED,
  READINESS_SYSTEM_BYTES,
  READINESS_USER_BYTES,
  hashReadinessRequestV0,
  READINESS_REQUEST
} from "./contract-readiness.ts";

const sha256 = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** Queries the local service without invoking generation. */
async function ollamaJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${READINESS_OLLAMA_BASE_URL}${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nvidiaSmi(query: string): string {
  try {
    return execSync(`nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits`, { encoding: "utf8" }).trim();
  } catch {
    return "UNAVAILABLE";
  }
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("READINESS_CLOSURE_USAGE: usage: closure.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = (name: string, value: unknown): string => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return sha256(content);
  };

  // ---- §1 run-2 closure ------------------------------------------------------------------------
  const closure = {
    artifact: "RUN2_PROVIDER_BLOCK_CLOSURE",
    run: "HISTORY_INTERNALIZATION_V1_PHASE0_RERUN (run-2)",
    closure_token: "HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_BLOCKED_BEFORE_SCIENTIFIC_START",
    classification: "PRE_SCIENTIFIC_INFRASTRUCTURE_BLOCK",
    is_it_positive: false,
    is_it_a_scientific_null: false,
    is_it_a_scientific_inconclusive: false,
    why_not:
      "the run stopped at the NON-SCIENTIFIC bootstrap turn. No subject under study was ever created, so no scientific object exists to be positive, null, or inconclusive about.",
    facts: {
      scientific_subjects_created: false,
      scientific_subject_turns: 0,
      scientific_dataset_created: false,
      scientific_denominator_started: false,
      scientific_status: "NOT_STARTED",
      operational_status: "BLOCKED"
    },
    blocker: {
      failure_class: "PROVIDER_INFRASTRUCTURE_VRAM_EXHAUSTION",
      observed_error: "MODEL_TRANSPORT_MODEL_TIMEOUT: ollama native cognition transport timed out after 120000ms",
      where: "the non-scientific qualification/bootstrap turn"
    },
    run2_evidence_is_immutable: true,
    run2_report_modified_by_this_round: false,
    next_execution_identity_recommended: "PHASE0-RUN-3",
    why_a_new_identity:
      "run-2 already contains real bootstrap and provider-block evidence. Even with a zero scientific denominator, that provenance must not be overwritten.",
    run3_must_use: [
      "a new evidence directory",
      "fresh opaque subjects",
      "the same frozen scientific design",
      "the same provider identity"
    ]
  };
  write("RUN2_PROVIDER_BLOCK_CLOSURE.json", closure);

  // ---- §2 exact provider attempt ledger ---------------------------------------------------------
  // Every real provider attempt made during the run-2 attempt and its diagnosis. Health endpoints
  // that do NOT invoke generation are listed separately and are not counted as attempts.
  const attempts = [
    {
      attempt_id: "run2-bootstrap-cognition-001",
      scientific: false,
      purpose: "run-2 bootstrap/qualification turn (non-scientific)",
      model: READINESS_MODEL,
      model_digest: READINESS_MODEL_DIGEST_FROZEN,
      transport: "OllamaNativeCognitionTransportV0 (production cognition configuration)",
      request_hash: null,
      request_hash_status: "NOT_RECORDED — the run aborted before persisting its ledger, and the in-memory record was lost",
      start_time: "NOT_RECORDED",
      end_time: "NOT_RECORDED",
      latency_ms: 120_000,
      latency_basis: "the frozen transport timeout was reached; the transport reports the bound, not a measured completion",
      completion_tokens_if_known: null,
      throughput_if_known: null,
      status: "MODEL_TIMEOUT",
      timeout_ms: 120_000
    },
    {
      attempt_id: "diagnostic-throughput-001",
      scientific: false,
      purpose: "operator throughput diagnostic before the unload/reload cycle",
      model: READINESS_MODEL,
      model_digest: "NOT_VERIFIED_AT_THE_TIME (verified around this window as " + READINESS_MODEL_DIGEST_FROZEN.slice(0, 12) + "…)",
      transport: "raw POST /api/chat (diagnostic, NOT the production transport)",
      request_hash: sha256('{"model":"qwen3.5:9b","prompt":"Count from 1 to 20, one number per line.","think":false,"num_predict":64,"num_ctx":2048}'),
      request_hash_note: "hash of the diagnostic payload actually sent, recorded for provenance; it is NOT the production configuration",
      start_time: "NOT_RECORDED",
      end_time: "NOT_RECORDED",
      latency_ms: 52_025,
      completion_tokens_if_known: 51,
      throughput_if_known: 0.98,
      status: "COMPLETED",
      timeout_ms: null,
      diagnostic_only: true
    },
    {
      attempt_id: "diagnostic-unload-002",
      scientific: false,
      purpose: "unload the model to clear its VRAM footprint (keep_alive=0)",
      model: READINESS_MODEL,
      model_digest: READINESS_MODEL_DIGEST_FROZEN,
      transport: "raw POST /api/chat (diagnostic)",
      request_hash: sha256('{"model":"qwen3.5:9b","messages":[{"role":"user","content":"hi"}],"keep_alive":0}'),
      start_time: "NOT_RECORDED",
      end_time: "NOT_RECORDED",
      latency_ms: null,
      completion_tokens_if_known: null,
      throughput_if_known: null,
      status: "COMPLETED",
      timeout_ms: null,
      diagnostic_only: true
    },
    {
      attempt_id: "diagnostic-throughput-003",
      scientific: false,
      purpose: "operator throughput diagnostic after the unload/reload cycle",
      model: READINESS_MODEL,
      model_digest: READINESS_MODEL_DIGEST_FROZEN,
      transport: "raw POST /api/chat (diagnostic, NOT the production transport)",
      request_hash: sha256('{"model":"qwen3.5:9b","prompt":"Count from 1 to 20, one number per line.","think":false,"num_predict":64,"num_ctx":2048}'),
      start_time: "NOT_RECORDED",
      end_time: "NOT_RECORDED",
      latency_ms: 12_800,
      completion_tokens_if_known: 51,
      throughput_if_known: 3.99,
      status: "COMPLETED",
      timeout_ms: null,
      diagnostic_only: true
    }
  ];
  const ledger = {
    artifact: "RUN2_PROVIDER_ATTEMPT_LEDGER",
    scope:
      "every real provider attempt made during the run-2 execution attempt and its diagnosis. Attempts are counted ONLY when generation was actually invoked.",
    counted_as_attempts: attempts.length,
    scientific_provider_attempts: 0,
    non_scientific_provider_attempts: attempts.length,
    total_provider_attempts: attempts.length,
    terminology_law:
      "SCIENTIFIC_MODEL_CALLS = 0 must never be abbreviated to MODEL_CALLS = 0. This round made real provider attempts; none of them was scientific.",
    health_checks_that_did_NOT_invoke_generation: [
      "GET /api/tags — model availability and digest verification",
      "GET /api/ps — model residency and VRAM footprint"
    ],
    health_checks_are_not_attempts_because: "they invoke no generation",
    attempts
  };
  write("RUN2_PROVIDER_ATTEMPT_LEDGER.json", ledger);

  // ---- §3 subject-id leakage policy -------------------------------------------------------------
  const policy = {
    artifact: "SUBJECT_ID_LEAKAGE_POLICY",
    confirmed_production_fact: {
      claim: "the production cognition prompt renders the subject id into model-visible content",
      evidence: "packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts:256",
      line: "`[identity] subject_id=${JSON.stringify(projection.subject_id)}`",
      verified: true
    },
    frozen_policy: {
      MODEL_VISIBLE_SUBJECT_ID_POLICY: "OPAQUE_NON_SEMANTIC",
      rule:
        "a subject id that appears in model-visible content must be opaque and non-semantic. Arm membership exists ONLY in experiment metadata, never in the identity bytes the executor can read.",
      future_scientific_subject_ids: "subject-r3-<opaque>",
      forbidden_in_model_visible_identity: ["Alice-A", "Alice-B", "positive", "negative", "trusted", "betrayed"],
      structural_requirements: [
        "equal length across arms",
        "a shared non-semantic stem",
        "a suffix with no order or valence meaning",
        "no substring that encodes arm membership"
      ]
    },
    classification: "REMOVAL_OF_UNNECESSARY_ARM_LABEL_LEAKAGE",
    explicitly_not: "a scientific treatment change",
    why_it_is_not_a_treatment_change:
      "the policy constrains only the identity BYTES the executor can read. It changes no prompt semantics, no trajectory content, no proposition, no credence law, no scorer and no predicate. Two subjects remain identical in every respect except their opaque identity.",
    prior_application: "run-2 already used subject-r2-k7q2-4103 / subject-r2-k7q2-8267 on this policy"
  };
  write("SUBJECT_ID_LEAKAGE_POLICY.json", policy);

  // ---- §7 capacity requirement ------------------------------------------------------------------
  write("PROVIDER_CAPACITY_REQUIREMENT.json", {
    artifact: "PROVIDER_CAPACITY_REQUIREMENT",
    planned_probes: READINESS_PROBES_PLANNED,
    ...READINESS_CAPACITY_REQUIREMENT,
    execution_rule: READINESS_EXECUTION_RULE,
    honest_note:
      "this gate decides whether to ATTEMPT the scientific rerun. It is not evidence about any scientific question, and a PASS authorises a re-attempt at execution — nothing more."
  });

  // ---- §6 the frozen probe request --------------------------------------------------------------
  const requestHash = hashReadinessRequestV0();
  write("PROVIDER_READINESS_REQUEST.json", {
    artifact: "PROVIDER_READINESS_REQUEST",
    frozen_before_first_attempt: true,
    contains_scientific_input: false,
    explicitly_absent: [
      "frozen Phase-0 trajectory events",
      "the target proposition",
      "A/B valence spans",
      "scientific subject states",
      "arm identity"
    ],
    transport_configuration: {
      model: READINESS_MODEL,
      num_predict: READINESS_REQUEST.options.num_predict,
      num_ctx: READINESS_REQUEST.options.num_ctx,
      temperature: READINESS_REQUEST.options.temperature,
      think: READINESS_REQUEST.think,
      timeout_ms: 120_000,
      structured_output_constraint: null
    },
    system_bytes: READINESS_SYSTEM_BYTES,
    user_bytes: READINESS_USER_BYTES,
    calibration_basis:
      "run-1's production cognition requests carried a 12,771-byte system message and a 4,300-5,584-byte user message; this probe is shaped comparably so the probe's cost resembles a production call's cost",
    wire_request: READINESS_REQUEST
  });
  write("PROVIDER_READINESS_REQUEST_HASH.json", {
    artifact: "PROVIDER_READINESS_REQUEST_HASH",
    hash_function: "sha256 over JSON.stringify(wire_request)",
    request_hash: requestHash,
    every_replicate_must_reuse_this_hash: true,
    replicate_ordinal_in_request: false
  });

  // ---- §8 environment snapshot (diagnostic, NOT a gate) -----------------------------------------
  const tags = await ollamaJson("/api/tags");
  const ps = await ollamaJson("/api/ps");
  const models = (tags?.["models"] ?? []) as { name?: string; digest?: string }[];
  const target = models.find((model) => model.name === READINESS_MODEL);
  const loaded = ((ps?.["models"] ?? []) as { name?: string; size_vram?: number }[]).find(
    (model) => model.name === READINESS_MODEL
  );
  const snapshot = {
    artifact: "VRAM_ENVIRONMENT_SNAPSHOT",
    role: "DIAGNOSTIC_ONLY — this snapshot does NOT gate the rerun",
    why_not_a_gate:
      "§8: whether the scientific rerun is authorised must be decided by FUNCTIONAL provider readiness, not by an arbitrary VRAM number, unless that number has itself been derived mechanically from production resource requirements",
    vram_total_mib: nvidiaSmi("memory.total"),
    vram_used_mib: nvidiaSmi("memory.used"),
    gpu_utilization_percent: nvidiaSmi("utilization.gpu"),
    gpu_temperature_c: nvidiaSmi("temperature.gpu"),
    gpu_sm_clock_mhz: nvidiaSmi("clocks.current.sm"),
    gpu_sm_clock_max_mhz: nvidiaSmi("clocks.max.sm"),
    model_available: target !== undefined,
    model_digest_now: target?.digest ?? null,
    model_digest_matches_frozen: target?.digest === READINESS_MODEL_DIGEST_FROZEN,
    model_currently_loaded: loaded !== undefined,
    model_vram_bytes: loaded?.size_vram ?? null,
    measured_throughput_during_diagnosis: { before_reload_tok_s: 0.98, after_reload_tok_s: 3.99 },
    operator_processes_were_never_killed: true,
    os_or_gpu_settings_were_never_altered: true
  };
  write("VRAM_ENVIRONMENT_SNAPSHOT.json", snapshot);

  console.log("CLOSURE ARTIFACTS WRITTEN (0 provider generation)");
  console.log(`  §1 run-2 closure: ${closure.closure_token}`);
  console.log(`  §2 provider attempts: scientific ${ledger.scientific_provider_attempts}, non-scientific ${ledger.non_scientific_provider_attempts}, total ${ledger.total_provider_attempts}`);
  console.log(`  §3 MODEL_VISIBLE_SUBJECT_ID_POLICY = ${policy.frozen_policy.MODEL_VISIBLE_SUBJECT_ID_POLICY}`);
  console.log(`  §6 frozen probe request hash: ${requestHash}`);
  console.log(`  §8 VRAM: used ${String(snapshot.vram_used_mib)} / ${String(snapshot.vram_total_mib)} MiB, model loaded: ${String(snapshot.model_currently_loaded)}, digest match: ${String(snapshot.model_digest_matches_frozen)}`);
}

await main();
