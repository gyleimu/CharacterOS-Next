#!/usr/bin/env node
/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product CLI entrypoint.
 *
 * Usage: pnpm interactive
 *
 * This file owns ONLY process concerns: environment configuration, provider
 * availability preflight, readline, signal handling, an append-only local
 * operational log, and exit codes. All interaction logic lives in the host and
 * the CLI session so it can be tested offline without a real provider.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { InteractiveTurnOutcomeV0 } from "@characteros-next/runtime";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductTransportsV0, probeOllamaV0 } from "./product-providers.js";
import { SerialTaskQueueV0 } from "./serial-task-queue.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

function intEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<number> {
  const baseUrl = env("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434";
  const model = env("CHARACTEROS_MODEL") ?? "qwen3.5:9b";
  const numPredict = intEnv("CHARACTEROS_NUM_PREDICT", 2048);
  const contextWindowTokens = intEnv("CHARACTEROS_CONTEXT_WINDOW_TOKENS", 8192);
  const timeoutMs = intEnv("CHARACTEROS_TIMEOUT_MS", 120000);
  const subjectId = env("CHARACTEROS_SUBJECT_ID") ?? "alice";
  const debug = env("CHARACTEROS_DEBUG") === "1";
  const dataDir = env("CHARACTEROS_DATA_DIR") ?? fileURLToPath(new URL("../.data", import.meta.url));
  mkdirSync(dataDir, { recursive: true });

  console.log("CharacterOS-Next");
  const probe = await probeOllamaV0(baseUrl, model);
  if (!probe.reachable) {
    console.error("Provider unavailable. Is Ollama running?");
    console.error(`  endpoint: ${baseUrl}`);
    console.error(`  detail: ${probe.failure ?? "unknown"}`);
    return 1;
  }

  const transports = createProductTransportsV0({
    base_url: baseUrl,
    model,
    timeout_ms: timeoutMs,
    num_predict: numPredict,
    context_window_tokens: contextWindowTokens
  });

  let host: InteractiveSubjectHostV0;
  try {
    host = await InteractiveSubjectHostV0.open(
      {
        subject_id: subjectId,
        session_id: `interactive-${subjectId}-${process.pid}`,
        storage_root: dataDir
      },
      {
        conversationCognitionTransport: transports.cognition,
        languageTransport: transports.language,
        appraisalProvider: createProductAppraisalProviderV0(),
        provider_identity: {
          model,
          num_predict: numPredict,
          context_window_tokens: contextWindowTokens,
          last_trace: transports.lastCognitionTrace
        },
        clock: () => new Date().toISOString()
      }
    );
  } catch (error) {
    console.error("Subject restore failed. Refusing to start a new subject.");
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`  data: ${join(dataDir, `subject-${subjectId}.snapshot.json`)}`);
    return 1;
  }

  const status = await host.status();
  console.log(`Subject: ${subjectId}`);
  console.log(`Status: ${host.resolution() === "SUBJECT_RESTORED" ? "RESTORED" : "NEW"}`);
  console.log(`Memory revision: ${status.repository_revision}`);
  console.log(`Provider: OLLAMA_NATIVE / ${model} (context ${contextWindowTokens}, max output ${numPredict})`);
  console.log(`Data: ${host.storageLocation() ?? "(in-memory)"}`);
  if (host.resolution() === "SUBJECT_RESTORED" && status.pending_behavior_outcome) {
    console.log("Note: your next message will also complete the previous reply's outcome.");
  }
  console.log("Type /help for commands.");

  const operationalLog = join(dataDir, `subject-${subjectId}.interactions.jsonl`);
  const logTurn = (outcome: InteractiveTurnOutcomeV0): void => {
    const trace = outcome.provider_terminal_trace;
    const row = {
      schema_version: "interactive-subject-operational-turn-v0",
      at: new Date().toISOString(),
      session_id: outcome.session_id,
      subject_id: outcome.subject_id,
      turn_index: outcome.turn_index,
      status: outcome.status,
      user_text: outcome.user_text,
      directive: outcome.directive,
      current_intent: outcome.current_intent,
      subject_text: outcome.subject_text,
      delivery_id: outcome.delivery_id,
      completed_prior_outcome: outcome.completed_prior_outcome,
      retrieved_refs: outcome.retrieved_refs,
      working_episode_refs: outcome.working_episode_refs,
      resolved_evidence_entry_count: outcome.resolved_evidence_entry_count,
      provider_memory_section_present: outcome.provider_memory_section_present,
      repository_revision_before: outcome.repository_revision_before,
      repository_revision_after: outcome.repository_revision_after,
      state_revision_before: outcome.state_revision_before,
      state_revision_after: outcome.state_revision_after,
      provider_request_hash: outcome.provider_request_hash,
      transport_request_hash: outcome.transport_request_hash,
      provider_request_identity_match: outcome.provider_request_identity_match,
      prompt_eval_count: trace?.ollama.prompt_eval_count ?? null,
      eval_count: trace?.ollama.eval_count ?? null,
      done_reason: trace?.ollama.done_reason ?? null,
      context_window_tokens: trace?.budget.context_window_tokens ?? null,
      max_output_tokens: trace?.budget.max_output_tokens ?? null,
      language_call_required: outcome.language_call_required,
      raw_cognition_response: outcome.raw_cognition_response,
      failure: outcome.failure
    };
    try {
      appendFileSync(operationalLog, `${JSON.stringify(row)}\n`, "utf8");
    } catch {
      // Operational logging must never break the conversation.
    }
  };

  const queue = new SerialTaskQueueV0();
  const isTty = process.stdin.isTTY === true;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: isTty });
  let exitCode: number | null = null;
  let signalled = false;

  const session = new ProductCliSessionV0({
    host,
    model,
    providerLabel: "OLLAMA_NATIVE",
    contextWindowTokens,
    maxOutputTokens: numPredict,
    debug,
    write: (line) => process.stdout.write(`${line}\n`),
    onTurnComplete: logTurn
  });

  if (isTty) {
    rl.setPrompt("You > ");
    rl.prompt();
  }
  rl.on("line", (line) => {
    queue.enqueue(async () => {
      if (signalled) return;
      const result = await session.handleLine(line);
      if (result.kind === "EXIT") {
        exitCode = 0;
        rl.close();
        return;
      }
      if (signalled) return;
      if (isTty) rl.prompt();
    });
  });
  rl.on("close", () => {
    void (async () => {
      await queue.drain();
      if (exitCode === null) exitCode = 0;
      // Graceful, non-abrupt shutdown: set the exit code and let the event loop
      // drain naturally. Calling process.exit() here races readline/stdin
      // teardown on Windows (libuv assertion), while the runtime work is already
      // durably committed and the input source is released.
      process.exitCode = exitCode;
      process.stdin.pause();
    })();
  });
  process.on("SIGINT", () => {
    if (signalled || exitCode !== null) {
      // Forced second interrupt: terminate immediately (documented behavior).
      process.exitCode = 130;
      process.stdin.destroy();
      rl.close();
      return;
    }
    signalled = true;
    console.log("\nInterrupt: finishing the current turn, then exiting. Press Ctrl+C again to force.");
    rl.close();
  });

  return await new Promise<number>(() => {
    // The process exits from the readline close handler; this promise only keeps
    // the event loop alive in non-TTY (piped) mode.
  });
}

main()
  .then((code) => {
    if (typeof code === "number" && code !== 0) process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error("Interaction runtime failed.");
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
