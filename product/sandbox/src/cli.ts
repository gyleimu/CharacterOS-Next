#!/usr/bin/env node
/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 + PERSISTENT_SUBJECT_CONFIGURATION_V0
 * — product CLI entrypoint.
 *
 * Usage: pnpm interactive
 *
 * This file owns ONLY process concerns: environment configuration, provider
 * availability preflight, subject resolution/setup prompts, readline, signal
 * handling, an append-only local operational log, and exit codes. Subject
 * creation/configuration logic lives in `subject-configuration.ts` and every
 * interaction step lives in the host / CLI session, so both are testable
 * without stdin or a real provider.
 *
 * Precedence: explicit env override → persisted subject config → first-run
 * creation. Conflicting overrides inside one data root FAIL CLOSED.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { InteractiveTurnOutcomeV0 } from "@characteros-next/runtime";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductTransportsV0, probeOllamaV0 } from "./product-providers.js";
import { SerialTaskQueueV0 } from "./serial-task-queue.js";
import {
  SubjectConfigurationErrorV0,
  buildSubjectConfigForCreationV0,
  markSubjectDurableStatePresentV0,
  resolvePersistentSubjectV0,
  writeProductSubjectConfigV0,
  type ProductSubjectConfigV0
} from "./subject-configuration.js";

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
  // CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0: one model-backed appraisal call per
  // factual event, accounted separately from cognition/language.
  const appraisal = createProductAppraisalProviderV0({ transport: transports.appraisal });

  // ---- readline + startup gates ----------------------------------------------
  // The line handler is attached BEFORE any await, and every queued line waits
  // for startup: in piped/non-TTY mode readline can emit lines immediately, so
  // attaching late would silently drop them.
  const queue = new SerialTaskQueueV0();
  const isTty = process.stdin.isTTY === true;
  const rl: ReadlineInterface = createInterface({ input: process.stdin, output: process.stdout, terminal: isTty });
  let exitCode: number | null = null;
  let signalled = false;
  let startupFailed = false;
  let awaitingDisplayName = false;
  let session: ProductCliSessionV0 | null = null;
  let subjectConfig: ProductSubjectConfigV0 | null = null;

  let completeStartup: () => void = () => undefined;
  const startup = new Promise<void>((resolve) => {
    completeStartup = resolve;
  });
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const write = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const promptWith = (label: string): void => {
    if (!isTty) return;
    rl.setPrompt(label);
    rl.prompt();
  };

  const openHost = async (config: ProductSubjectConfigV0): Promise<InteractiveSubjectHostV0> => {
    subjectConfig = config;
    const opened = await InteractiveSubjectHostV0.open(
      {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: config.identity_anchors,
        session_id: `interactive-${config.subject_id}-${process.pid}`,
        storage_root: dataDir
      },
      {
        conversationCognitionTransport: transports.cognition,
        languageTransport: transports.language,
        appraisalProvider: appraisal.provider,
        provider_identity: {
          model,
          num_predict: numPredict,
          context_window_tokens: contextWindowTokens,
          last_trace: transports.lastCognitionTrace
        },
        onSnapshotPersisted: async () => {
          if (subjectConfig !== null) {
            subjectConfig = markSubjectDurableStatePresentV0(dataDir, subjectConfig);
          }
        },
        clock: () => new Date().toISOString()
      }
    );
    // A durable snapshot exists after an authoritative restore: reconcile the
    // creation marker even if a crash happened between snapshot and config.
    if (opened.resolution() === "SUBJECT_RESTORED" && subjectConfig.durable_state === "NONE") {
      subjectConfig = markSubjectDurableStatePresentV0(dataDir, subjectConfig);
    }
    return opened;
  };

  const wireSession = (opened: InteractiveSubjectHostV0): void => {
    const subjectId = opened.subjectId();
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
        observational_experience_ref: outcome.observational_experience_ref,
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
        // Separate Appraisal accounting (never folded into cognition/language).
        appraisal_calls_so_far: appraisal.stats.callCount(),
        appraisal_terminal_trace: transports.lastAppraisalTrace(),
        failure: outcome.failure
      };
      try {
        appendFileSync(operationalLog, `${JSON.stringify(row)}\n`, "utf8");
      } catch {
        // Operational logging must never break the conversation.
      }
    };
    session = new ProductCliSessionV0({
      host: opened,
      subjectLabel: opened.displayName().length > 0 ? opened.displayName() : subjectId,
      model,
      providerLabel: "OLLAMA_NATIVE",
      contextWindowTokens,
      maxOutputTokens: numPredict,
      debug,
      write,
      onTurnComplete: logTurn
    });
    markReady();
  };

  const announceReady = async (opened: InteractiveSubjectHostV0, created: boolean): Promise<void> => {
    const status = await opened.status();
    if (created) {
      write("Subject created.");
      write(`Subject ID: ${opened.subjectId()}`);
    }
    write(`Subject: ${opened.displayName().length > 0 ? opened.displayName() : opened.subjectId()}`);
    write(`Status: ${opened.resolution() === "SUBJECT_RESTORED" ? "RESTORED" : "NEW"}`);
    write(`Memory revision: ${status.repository_revision}`);
    write(`Provider: OLLAMA_NATIVE / ${model} (context ${contextWindowTokens}, max output ${numPredict})`);
    write(`Data: ${opened.storageLocation() ?? "(in-memory)"}`);
    if (opened.resolution() === "SUBJECT_RESTORED" && status.pending_behavior_outcome) {
      write("Note: your next message will also complete the previous reply's outcome.");
    }
    write("Type /help for commands.");
    promptWith("You > ");
  };

  const setupSubject = async (config: ProductSubjectConfigV0): Promise<void> => {
    writeProductSubjectConfigV0(dataDir, config);
    const opened = await openHost(config);
    awaitingDisplayName = false;
    wireSession(opened);
    await announceReady(opened, true);
  };

  // ---- line dispatch (attached before startup) --------------------------------
  rl.on("line", (line) => {
    queue.enqueue(async () => {
      if (signalled) return;
      await startup;
      if (startupFailed) return;
      if (awaitingDisplayName) {
        try {
          await setupSubject(buildSubjectConfigForCreationV0(line));
        } catch (error) {
          write(`Could not create subject: ${error instanceof Error ? error.message : String(error)}`);
          promptWith("Display name: ");
        }
        return;
      }
      await ready;
      const active = session;
      if (active === null) return;
      const result = await active.handleLine(line);
      if (result.kind === "EXIT") {
        exitCode = 0;
        rl.close();
        return;
      }
      if (signalled) return;
      promptWith("You > ");
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
      process.exitCode = 130;
      process.stdin.destroy();
      rl.close();
      return;
    }
    signalled = true;
    write("\nInterrupt: finishing the current turn, then exiting. Press Ctrl+C again to force.");
    rl.close();
  });

  // ---- startup: resolve the single persistent subject (fail closed) -----------
  try {
    const overrideSubjectId = env("CHARACTEROS_SUBJECT_ID");
    const overrideDisplayName = env("CHARACTEROS_DISPLAY_NAME");
    const resolution = await resolvePersistentSubjectV0({
      dataRoot: dataDir,
      ...(overrideSubjectId === undefined ? {} : { overrideSubjectId }),
      ...(overrideDisplayName === undefined ? {} : { overrideDisplayName })
    });

    if (resolution.kind === "CREATE_REQUIRED") {
      const preset = resolution.preset;
      if (preset === null) {
        awaitingDisplayName = true;
        write("No subject configured.");
        write("Create a persistent subject.");
        promptWith("Display name: ");
      } else {
        await setupSubject(buildSubjectConfigForCreationV0(preset.display_name));
      }
    } else {
      if (resolution.kind === "RECOVER_AND_RESTORE") {
        writeProductSubjectConfigV0(dataDir, resolution.config);
      }
      const opened = await openHost(resolution.config);
      wireSession(opened);
      await announceReady(opened, false);
    }
  } catch (error) {
    startupFailed = true;
    if (error instanceof SubjectConfigurationErrorV0) {
      console.error("Subject configuration is invalid.");
    } else {
      console.error("Subject restore failed. Refusing to start a new subject.");
    }
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`  data: ${dataDir}`);
    exitCode = 1;
    rl.close();
  } finally {
    completeStartup();
  }

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
