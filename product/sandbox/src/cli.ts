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

import { accessSync, appendFileSync, constants, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";

import type { InteractiveTurnOutcomeV0 } from "@characteros-next/runtime";
import { EnvironmentSubjectHostV0 } from "./environment-subject-host.js";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { ProductLifeOperationsV0 } from "./product-life-operations.js";
import {
  PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0,
  PRODUCT_DEFAULT_DATA_ROOT_V0
} from "./product-paths.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import {
  ProductConfigurationErrorV0,
  dataDirectoryFailureGuidanceV0,
  firstRunGuidanceV0,
  formatConfigurationErrorLinesV0,
  formatStartupSummaryV0,
  modelMissingGuidanceV0,
  parsePositiveIntV0,
  processEnvironmentV0,
  providerUnavailableGuidanceV0,
  resolveProductConfigurationV0,
  type ProductConfigurationV0,
  type ProductIdentityProvenanceV0
} from "./product-configuration.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { advanceSubjectTimeV0, SubjectTimeAdvanceErrorV0 } from "./subject-time-advance.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { probeOllamaV0 } from "./product-providers.js";
import { SerialTaskQueueV0 } from "./serial-task-queue.js";
import {
  SubjectConfigurationErrorV0,
  buildSubjectConfigForCreationV0,
  markSubjectDurableStatePresentV0,
  resolvePersistentSubjectV0,
  writeProductSubjectConfigV0,
  type ProductSubjectConfigV0
} from "./subject-configuration.js";

async function main(): Promise<number> {
  const environment = processEnvironmentV0();
  const env = (name: string): string | undefined => environment.get(name);

  // CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — resolve the SAME
  // product settings as before (env → built-in default), but fail early on
  // malformed values instead of silently coercing them.
  let configuration: ProductConfigurationV0;
  try {
    configuration = resolveProductConfigurationV0({
      environment,
      default_data_root: PRODUCT_DEFAULT_DATA_ROOT_V0,
      default_data_root_origin: PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0
    });
  } catch (error) {
    if (error instanceof ProductConfigurationErrorV0) {
      for (const line of formatConfigurationErrorLinesV0(error)) console.error(line);
      return 1;
    }
    throw error;
  }
  const baseUrl = configuration.endpoint.value;
  const model = configuration.model.value;
  const numPredict = configuration.num_predict.value;
  const contextWindowTokens = configuration.context_window_tokens.value;
  const debug = configuration.debug.value;
  const dataDir = configuration.data_root.value;
  // Data root must exist and be writable; report the product-level cause actionably.
  try {
    mkdirSync(dataDir, { recursive: true });
    accessSync(dataDir, constants.W_OK);
  } catch (error) {
    for (const line of dataDirectoryFailureGuidanceV0(dataDir, error instanceof Error ? error.message : String(error))) {
      console.error(line);
    }
    return 1;
  }

  console.log("CharacterOS-Next");
  const probe = await probeOllamaV0(baseUrl, model);
  if (!probe.reachable) {
    for (const line of providerUnavailableGuidanceV0(baseUrl, probe.failure ?? "unknown")) console.error(line);
    return 1;
  }
  // MODEL MISSING: reachable endpoint but the configured model is not installed.
  // Fail closed with the configured identifier; never auto-download or install.
  if (probe.failure !== null) {
    for (const line of modelMissingGuidanceV0(model, baseUrl, probe.failure)) console.error(line);
    return 1;
  }

  // CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — ONE shared provider bundle keeps
  // the CLI and the local web product on identical provider semantics (same
  // transports, appraisal/belief/relationship wiring, budgets and turn plan).
  const bundle = createProductProviderBundleV0({
    configuration,
    write: (line) => process.stdout.write(`${line}\n`),
    debug
  });
  const transports = bundle.transports;
  const diagnostics = bundle.diagnostics;
  const cognitionTransport = transports.cognition;
  const languageTransport = transports.language;
  const appraisalProvider = bundle.appraisalProvider;
  const beliefSemanticProvider = bundle.beliefSemanticProvider;
  const relationshipFamiliarityAdmissionProvider = bundle.relationshipFamiliarityAdmissionProvider;
  // The real bundle always wires both adaptation providers (nullable only so
  // tests can construct a reduced double); a mis-wired bundle must fail loudly.
  if (beliefSemanticProvider === null || relationshipFamiliarityAdmissionProvider === null) {
    console.error("Product provider bundle is missing the adaptation providers.");
    return 1;
  }

  // SUBJECT_EXPLICIT_TIME_ADVANCE_PRODUCT_V0 — advance the SAME shared canonical
  // subject by explicit canonical TICKS (never seconds/minutes/hours). No human
  // input, environment interaction, Observation, Experience or Memory is created.
  if (process.argv[2] === "time") {
    const subjectId = env("CHARACTEROS_SUBJECT_ID") ?? "alice";
    const parsed = Number.parseInt(process.argv[3] ?? "", 10);
    try {
      const result = await advanceSubjectTimeV0(
        {
          sharedSourceStore: new FileSharedSubjectSourceStoreV0(dataDir, subjectId),
          subject: {
            subject_id: subjectId,
            display_name: env("CHARACTEROS_DISPLAY_NAME") ?? "Alice",
            identity_anchors: []
          },
          conversationCognitionTransport: cognitionTransport,
          languageTransport: languageTransport,
          factualEventAppraisalProvider: appraisalProvider,
          beliefSemanticProvider,
          relationshipFamiliarityAdmissionProvider,
          clock: () => new Date().toISOString()
        },
        Number.isNaN(parsed) ? -1 : parsed
      );
      console.log(
        `time: ${result.ticks} canonical tick(s) ${result.no_op ? "(NO_OP)" : "advanced"} ` +
          `logical_time ${result.logical_time_before} -> ${result.logical_time_after} ` +
          `valence ${result.valence_before} -> ${result.valence_after} ` +
          `activation ${result.activation_before} -> ${result.activation_after} ` +
          `shared_revision=${result.base_revision}`
      );
      return 0;
    } catch (error) {
      if (error instanceof SubjectTimeAdvanceErrorV0) {
        console.error(`time advance refused: ${error.code}: ${error.message}`);
        return 2;
      }
      throw error;
    }
  }

  // SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 + ENVIRONMENT_LIVED_EVIDENCE_ADAPTATION_V0 —
  // optional deterministic environment mode. It reuses the SAME provider
  // transports, the frozen long-horizon environment session and the SAME
  // adaptation providers as human mode; it is not the human-conversation host.
  if (process.argv[2] === "environment") {
    const subjectId = env("CHARACTEROS_SUBJECT_ID") ?? "alice";
    const interactionsRaw = process.argv[3] ?? env("CHARACTEROS_ENVIRONMENT_INTERACTIONS");
    const interactions = interactionsRaw === undefined ? 4 : parsePositiveIntV0(interactionsRaw);
    if (interactions === null) {
      console.error(
        `Configuration is invalid: CHARACTEROS_ENVIRONMENT_INTERACTIONS=${JSON.stringify(interactionsRaw)} ` +
          `(source: environment variable CHARACTEROS_ENVIRONMENT_INTERACTIONS); expected a positive integer (interactions).`
      );
      return 1;
    }
    const host = await EnvironmentSubjectHostV0.open(
      {
        subject_id: subjectId,
        display_name: env("CHARACTEROS_DISPLAY_NAME") ?? "Alice",
        session_id: `environment-${subjectId}`,
        storage_root: dataDir,
        interaction_interval_ticks: configuration.interval_ticks.value
      },
      {
        conversationCognitionTransport: cognitionTransport,
        languageTransport: languageTransport,
        factualEventAppraisalProvider: appraisalProvider,
        // ADAPTATION PARITY: the same existing providers as human mode.
        beliefSemanticProvider,
        relationshipFamiliarityAdmissionProvider,
        // ONE authoritative canonical subject source shared with the human host.
        sharedSourceStore: new FileSharedSubjectSourceStoreV0(dataDir, subjectId),
        provider_identity: {
          model,
          num_predict: numPredict,
          context_window_tokens: contextWindowTokens,
          last_trace: transports.lastCognitionTrace
        },
        clock: () => new Date().toISOString()
      }
    );
    console.log(`environment: ${host.environmentId()} (${host.resolution()})`);
    for (let i = 0; i < interactions; i++) {
      const outcome = await host.processNextInteraction();
      console.log(
        `  [${outcome.interaction_index}] ${outcome.status} env=${outcome.environment_state_hash_after} ` +
          `behavior=${JSON.stringify(outcome.behavior_text.slice(0, 80))} episode=${outcome.episode_ref ?? "(none)"}`
      );
      if (outcome.status !== "COMPLETE") break;
    }
    const status = await host.status();
    console.log(
      `done: interaction_index=${status.interaction_index}/${status.interaction_count} ` +
        `state_revision=${status.state_revision} repository=${status.repository_revision} ` +
        `environment_state=${host.environmentState().state_hash}`
    );
    return 0;
  }

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
  let sharedStore: FileSharedSubjectSourceStoreV0 | null = null;
  // Product metadata only: where the open subject's identity came from. Never
  // canonical state, never persisted.
  let subjectIdentity: ProductIdentityProvenanceV0 = {
    source: "DERIVED",
    origin: "derived from display name"
  };

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
    sharedStore = new FileSharedSubjectSourceStoreV0(dataDir, config.subject_id);
    const opened = await InteractiveSubjectHostV0.open(
      {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: config.identity_anchors,
        session_id: `interactive-${config.subject_id}-${process.pid}`,
        storage_root: dataDir
      },
      {
        conversationCognitionTransport: cognitionTransport,
        languageTransport: languageTransport,
        appraisalProvider: appraisalProvider,
        beliefSemanticProvider,
        relationshipFamiliarityAdmissionProvider,
        // ONE authoritative canonical subject source shared with environment mode.
        sharedSourceStore: sharedStore,
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
        appraisal_calls_so_far: bundle.appraisalCallCount(),
        appraisal_terminal_trace: transports.lastAppraisalTrace(),
        // Separate belief semantic accounting (§76 — no hidden calls).
        belief_adaptation: outcome.belief_adaptation,
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
      ...(sharedStore === null
        ? {}
        : {
            life: new ProductLifeOperationsV0(
              {
                storage_root: dataDir,
                subject: {
                  subject_id: subjectId,
                  display_name: opened.displayName(),
                  identity_anchors: [...(subjectConfig?.identity_anchors ?? [])]
                },
                interaction_interval_ticks: configuration.interval_ticks.value
              },
              {
                host: opened,
                sharedSourceStore: sharedStore,
                conversationCognitionTransport: cognitionTransport,
                languageTransport: languageTransport,
                factualEventAppraisalProvider: appraisalProvider,
                beliefSemanticProvider,
                relationshipFamiliarityAdmissionProvider,
                provider_identity: {
                  model,
                  num_predict: numPredict,
                  context_window_tokens: contextWindowTokens,
                  last_trace: transports.lastCognitionTrace
                },
                clock: () => new Date().toISOString()
              }
            )
          }),
      subjectLabel: opened.displayName().length > 0 ? opened.displayName() : subjectId,
      diagnostics,
      // Display-only expected plan, shared with the visual product.
      turnPlan: bundle.turnPlan,
      appraisalReuse: bundle.appraisalReuse,
      configuration,
      subjectIdentity,
      subjectDurableState: subjectConfig?.durable_state ?? "UNKNOWN",
      providerReady: true,
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
    const restored = opened.resolution() === "SUBJECT_RESTORED";
    for (const line of formatStartupSummaryV0({
      display_name: opened.displayName(),
      subject_id: opened.subjectId(),
      status: restored ? "RESTORED" : "NEW",
      created,
      model,
      data_location: opened.storageLocation(),
      provider_ready: true
    })) {
      write(line);
    }
    if (!restored) for (const line of firstRunGuidanceV0({ display_name: opened.displayName() })) write(line);
    if (restored && status.pending_behavior_outcome) {
      write("Note: your next message will also complete the previous reply's outcome.");
    }
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
        subjectIdentity = { source: "ENVIRONMENT", origin: "CHARACTEROS_SUBJECT_ID" };
        await setupSubject(buildSubjectConfigForCreationV0(preset.display_name));
      }
    } else {
      subjectIdentity =
        resolution.kind === "RECOVER_AND_RESTORE"
          ? { source: "PERSISTED_PRODUCT_CONFIG", origin: "recovered from durable snapshot identity" }
          : { source: "PERSISTED_PRODUCT_CONFIG", origin: "subject-config.json" };
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
