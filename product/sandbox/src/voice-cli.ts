/**
 * CHARACTEROS_VOICE_CLI_V0 — the end-to-end spoken product surface.
 *
 *   microphone -> voice runtime ASR -> SpeechInputV0
 *     -> the EXISTING interactive subject host (same text ingress a typed
 *        message uses)
 *     -> reply text
 *     -> SpeechExpressionProjection over read-only canonical state
 *     -> voice runtime TTS -> speaker
 *
 * This file owns only process concerns (configuration, provider preflight,
 * readline, exit codes) and the voice orchestration; every conversational step
 * goes through the frozen product host, exactly as `cli.ts` does. No CharacterOS
 * cognition, memory or affect flow is reimplemented here, and no canonical state
 * is written by the voice layer.
 *
 * Usage:
 *   pnpm --filter @characteros-next/sandbox voice              interactive
 *   pnpm --filter @characteros-next/sandbox voice say "你好。"   one typed turn
 *   pnpm --filter @characteros-next/sandbox voice listen         one spoken turn
 *
 * Degradation: if the voice runtime is down the session still runs and still
 * replies — the reply is simply printed instead of spoken, and a typed turn
 * still works when recognition is unavailable.
 */

import { createInterface } from "node:readline";

import {
  CosyVoiceTtsAdapterV0,
  DEFAULT_VOICE_RUNTIME_CONFIG_V0,
  SenseVoiceAsrAdapterV0,
  VoiceRuntimeClientV0,
  VoiceSessionV0,
  projectSpeechExpressionV0,
  type SpeechExpressionInputsV0,
  type VoiceSessionTurnV0
} from "@characteros-next/voice";

import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0, PRODUCT_DEFAULT_DATA_ROOT_V0 } from "./product-paths.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import {
  processEnvironmentV0,
  providerUnavailableGuidanceV0,
  resolveProductConfigurationV0
} from "./product-configuration.js";
import { probeOllamaV0 } from "./product-providers.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { resolvePersistentSubjectV0, type ProductSubjectConfigV0 } from "./subject-configuration.js";
import { HostVoiceSubjectPortV0 } from "./voice-subject-port.js";

const VOICE_DEFAULT_LANGUAGE = "zh";
const VOICE_DEFAULT_VOICE_ID = "characteros-default";

function describeTurn(turn: VoiceSessionTurnV0): string {
  const parts: string[] = [];
  if (turn.recognized !== null) {
    parts.push(`heard: ${JSON.stringify(turn.recognized.input.text)} (${turn.recognized.latency_ms}ms)`);
  }
  parts.push(`status=${turn.turn.status}`);
  if (turn.expression !== null) {
    parts.push(
      `expression rate=${turn.expression.speaking_rate} volume=${turn.expression.volume} ` +
        `warmth=${turn.expression.warmth} intensity=${turn.expression.intensity} ` +
        `pause=${turn.expression.pause_bias} (revision ${turn.expression.provenance.state_revision ?? "n/a"})`
    );
  }
  if (turn.speech !== null) {
    parts.push(`spoken ${turn.speech.audio_ms}ms in ${turn.speech.total_ms}ms (rtf ${turn.speech.rtf})`);
  }
  if (turn.speech_stream !== null) {
    parts.push(
      `streamed ttfa=${turn.speech_stream.ttfa_ms}ms audio=${turn.speech_stream.audio_ms}ms ` +
        `chunks=${turn.speech_stream.chunks}`
    );
  }
  if (turn.speech_failure !== null) {
    parts.push(`SPEECH DEGRADED (${turn.speech_failure.code}): ${turn.speech_failure.message}`);
  }
  return parts.join(" | ");
}

async function main(): Promise<number> {
  const environment = processEnvironmentV0();
  const configuration = resolveProductConfigurationV0({
    environment,
    default_data_root: PRODUCT_DEFAULT_DATA_ROOT_V0,
    default_data_root_origin: PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0
  });
  const baseUrl = configuration.endpoint.value;
  const model = configuration.model.value;
  const dataDir = configuration.data_root.value;
  const write = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };

  // Provider preflight: without a cognition/language model there is no reply to
  // speak, so this fails closed exactly like the text product.
  const probe = await probeOllamaV0(baseUrl, model);
  if (!probe.reachable || probe.failure !== null) {
    for (const line of providerUnavailableGuidanceV0(baseUrl, probe.failure ?? "unknown")) console.error(line);
    return 1;
  }

  const runtimeUrl = environment.get("CHARACTEROS_VOICE_RUNTIME_URL") ?? DEFAULT_VOICE_RUNTIME_CONFIG_V0.base_url;
  const runtimeConfig = { ...DEFAULT_VOICE_RUNTIME_CONFIG_V0, base_url: runtimeUrl };
  const client = new VoiceRuntimeClientV0(runtimeConfig);

  // Speech capability is OPTIONAL. Each half is enabled only if the runtime
  // reports that model as loaded, so a partially available runtime degrades to
  // "can hear but not speak" (or the reverse) instead of failing.
  let canSpeak = false;
  let canListen = false;
  let runtimeState: string;
  try {
    const health = await client.health();
    runtimeState = health.state;
    canSpeak = health.tts.loaded;
    canListen = health.asr.loaded;
  } catch {
    runtimeState = "UNAVAILABLE";
  }

  const bundle = createProductProviderBundleV0({ configuration, write, debug: configuration.debug.value });
  // The real bundle always wires both adaptation providers; a reduced double
  // must fail loudly rather than silently run without lived-evidence adaptation.
  if (bundle.beliefSemanticProvider === null || bundle.relationshipFamiliarityAdmissionProvider === null) {
    console.error("Product provider bundle is missing the adaptation providers.");
    return 1;
  }
  const subjectId = environment.get("CHARACTEROS_SUBJECT_ID") ?? "alice";
  const resolution = await resolvePersistentSubjectV0({
    dataRoot: dataDir,
    ...(environment.get("CHARACTEROS_SUBJECT_ID") === undefined ? {} : { overrideSubjectId: subjectId }),
    ...(environment.get("CHARACTEROS_DISPLAY_NAME") === undefined
      ? {}
      : { overrideDisplayName: environment.get("CHARACTEROS_DISPLAY_NAME") as string })
  });
  if (resolution.kind === "CREATE_REQUIRED") {
    console.error("No persistent subject is configured. Run `pnpm interactive` once to create one.");
    return 1;
  }
  const config: ProductSubjectConfigV0 = resolution.config;
  const sharedStore = new FileSharedSubjectSourceStoreV0(dataDir, config.subject_id);
  const host = await InteractiveSubjectHostV0.open(
    {
      subject_id: config.subject_id,
      display_name: config.display_name,
      identity_anchors: config.identity_anchors,
      session_id: `voice-${config.subject_id}-${process.pid}`,
      storage_root: dataDir
    },
    {
      conversationCognitionTransport: bundle.transports.cognition,
      languageTransport: bundle.transports.language,
      appraisalProvider: bundle.appraisalProvider,
      beliefSemanticProvider: bundle.beliefSemanticProvider,
      relationshipFamiliarityAdmissionProvider: bundle.relationshipFamiliarityAdmissionProvider,
      sharedSourceStore: sharedStore,
      clock: () => new Date().toISOString()
    }
  );

  const session = new VoiceSessionV0(
    {
      voice_id: environment.get("CHARACTEROS_VOICE_ID") ?? VOICE_DEFAULT_VOICE_ID,
      language: environment.get("CHARACTEROS_VOICE_LANGUAGE") ?? VOICE_DEFAULT_LANGUAGE,
      speak: canSpeak,
      streaming: environment.get("CHARACTEROS_VOICE_STREAMING") !== "false"
    },
    {
      subject: new HostVoiceSubjectPortV0(host),
      ...(canListen ? { asr: new SenseVoiceAsrAdapterV0({ client }) } : {}),
      ...(canSpeak ? { tts: new CosyVoiceTtsAdapterV0({ client }) } : {})
    }
  );

  write(`CharacterOS voice — subject ${config.display_name} (${config.subject_id})`);
  write(`  cognition model : ${model}`);
  write(`  voice runtime   : ${runtimeUrl} [${runtimeState}]`);
  write(`  can speak       : ${canSpeak ? "yes" : "NO (replies will be printed only)"}`);
  write(`  can hear        : ${canListen ? "yes" : "NO (type instead)"}`);
  write("  commands        : /mic  /stop  /state  /exit");

  const mode = process.argv[2];
  const runOne = async (text: string | null): Promise<number> => {
    const turn = text === null ? await session.handleMicrophone() : await session.handleText(text);
    if (turn === null) {
      write("(heard only silence)");
      return 0;
    }
    write(`\n${config.display_name} > ${turn.turn.reply_text ?? `(turn failed: ${turn.turn.failure})`}`);
    write(`  ${describeTurn(turn)}`);
    return turn.turn.status === "COMPLETED" ? 0 : 2;
  };

  if (mode === "say") {
    const text = process.argv.slice(3).join(" ").trim();
    if (text.length === 0) {
      console.error("usage: voice say <text>");
      return 1;
    }
    return await runOne(text);
  }
  if (mode === "listen") {
    if (!canListen) {
      console.error("the voice runtime reports ASR not loaded; cannot listen.");
      return 1;
    }
    return await runOne(null);
  }

  // ---- interactive ----------------------------------------------------------
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
  write("");
  rl.setPrompt("You > ");
  rl.prompt();

  rl.on("line", (line) => {
    void (async () => {
      const trimmed = line.trim();
      try {
        if (trimmed === "/exit") {
          rl.close();
          return;
        }
        if (trimmed === "/stop") {
          await session.cancelSpeech();
          write("(speech cancelled)");
        } else if (trimmed === "/state") {
          const inputs: SpeechExpressionInputsV0 = await new HostVoiceSubjectPortV0(host).readSpeechExpressionInputs();
          const expression = projectSpeechExpressionV0(inputs);
          write(`state inputs  : ${JSON.stringify(inputs)}`);
          write(`expression    : rate=${expression.speaking_rate} volume=${expression.volume} ` +
            `warmth=${expression.warmth} intensity=${expression.intensity} certainty=${expression.certainty} ` +
            `hesitation=${expression.hesitation} pause=${expression.pause_bias} ` +
            `expressiveness=${expression.expressiveness} assertiveness=${expression.assertiveness}`);
          write(`(these are presentation parameters derived from canonical state; they are not state)`);
        } else if (trimmed === "/mic" || trimmed.length === 0) {
          if (!canListen) {
            write("ASR is not available; type your message instead.");
          } else {
            const turn = await session.handleMicrophone();
            if (turn === null) {
              write("(heard only silence)");
            } else {
              write(`\n${config.display_name} > ${turn.turn.reply_text ?? "(turn failed)"}`);
              write(`  ${describeTurn(turn)}`);
            }
          }
        } else {
          const turn = await session.handleText(trimmed);
          write(`\n${config.display_name} > ${turn.turn.reply_text ?? `(turn failed: ${turn.turn.failure})`}`);
          write(`  ${describeTurn(turn)}`);
        }
      } catch (error) {
        write(`error: ${error instanceof Error ? error.message : String(error)}`);
      }
      rl.prompt();
    })();
  });
  rl.on("close", () => {
    // Graceful, non-abrupt shutdown: let the event loop drain rather than
    // racing readline/stdin teardown (the same reason cli.ts avoids process.exit).
    process.stdin.pause();
  });
  return await new Promise<number>((resolve) => {
    rl.on("close", () => resolve(0));
  });
}

main()
  .then((code) => {
    if (typeof code === "number" && code !== 0) process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error("voice runtime failed.");
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
