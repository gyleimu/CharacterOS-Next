#!/usr/bin/env node
/**
 * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — local visual product entrypoint.
 *
 * Each subject gets its OWN data root under `<data root>/subjects/<subject_id>`, so
 * the sandbox's one-subject-per-data-root law holds unchanged while the product can
 * create, list and open several subjects. Opening a subject builds the REAL product
 * runtime for that root: genesis creates it, an existing root restores it. The
 * browser never holds authoritative state; it reads the backend and re-fetches
 * after every action.
 *
 * Launch with `pnpm web`, then open the printed localhost URL.
 */

import { join } from "node:path";

import {
  PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0,
  PRODUCT_DEFAULT_DATA_ROOT_V0,
  ProductRuntimeStartupErrorV0,
  createHttpSpeechPortsV0,
  createProductRuntimeV0,
  unavailableVoicePortsV0
} from "@characteros-next/sandbox";
import { ProductWebSessionsV0 } from "./sessions.js";
import { WEB_DEFAULT_HOST_V0, WEB_DEFAULT_PORT_V0, startProductWebServerV0 } from "./server.js";

function envIntV0(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.length === 0) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

async function main(): Promise<number> {
  const subjectsRoot =
    process.env["CHARACTEROS_SUBJECTS_DIR"] ?? join(PRODUCT_DEFAULT_DATA_ROOT_V0, "subjects");

  const sessions = new ProductWebSessionsV0({
    subjects_root: subjectsRoot,
    open_runtime: async ({ data_root, display_name }) =>
      createProductRuntimeV0({
        session_label: "product-web",
        data_root,
        ...(display_name === undefined ? {} : { subject: { display_name } }),
        write: (line) => process.stdout.write(`${line}\n`)
      })
  });

  // Open the first existing subject when there is one. With none, the product
  // starts WITHOUT a fake subject: the UI offers the create flow.
  let startupFailure: string | null = null;
  try {
    const existing = sessions.list();
    if (existing.length > 0) await sessions.open(existing[0]?.subject_id ?? "");
  } catch (error) {
    startupFailure = error instanceof Error ? error.message : String(error);
  }

  if (startupFailure !== null) {
    console.error("The configured subject could not be opened.");
    console.error(`  detail: ${startupFailure}`);
    console.error("  Its durable files are untouched; fix the cause and relaunch.");
  }

  // VOICE MODALITY: optional, local-first and replaceable. Each direction is
  // enabled independently; an unset endpoint simply leaves it unavailable and the
  // text product is never blocked. No vendor SDK, no audio is ever persisted.
  const unavailable = unavailableVoicePortsV0();
  const sttUrl = process.env["CHARACTEROS_STT_URL"];
  const ttsUrl = process.env["CHARACTEROS_TTS_URL"];
  const voiceToken = process.env["CHARACTEROS_VOICE_TOKEN"];
  const voice = {
    stt:
      sttUrl === undefined || sttUrl.length === 0
        ? unavailable.stt
        : createHttpSpeechPortsV0({
            base_url: sttUrl,
            ...(voiceToken === undefined ? {} : { token: voiceToken })
          }).stt,
    tts:
      ttsUrl === undefined || ttsUrl.length === 0
        ? unavailable.tts
        : createHttpSpeechPortsV0({
            base_url: ttsUrl,
            ...(voiceToken === undefined ? {} : { token: voiceToken })
          }).tts
  };
  const handle = await startProductWebServerV0({
    sessions,
    voice,
    host: process.env["CHARACTEROS_WEB_HOST"] ?? WEB_DEFAULT_HOST_V0,
    port: envIntV0("CHARACTEROS_WEB_PORT") ?? WEB_DEFAULT_PORT_V0
  });

  console.log("CharacterOS — local visual product");
  console.log(`  Subjects root: ${subjectsRoot}  [${PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0}]`);
  const active = sessions.activeSummary();
  if (active === null) {
    console.log("  No subject is open yet — create one in the browser UI.");
  } else {
    const bootstrap = await sessions.current().bootstrap();
    console.log(`  Subject: ${active.display_name} (${active.subject_id})  durable: ${active.durable_state}`);
    console.log(`  Status: ${bootstrap.status}   Model: ${bootstrap.provider.model}`);
  }
  console.log(`  Open: ${handle.url}`);
  console.log(
    `  Voice: input ${voice.stt.available ? "READY (local adapter)" : "unavailable"} · output ${voice.tts.available ? "READY (local adapter)" : "browser speech"}`
  );
  console.log("  Local-only product. Press Ctrl+C to stop.");

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await handle.close();
    await sessions.close();
    process.exitCode = 0;
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
  await new Promise<void>(() => {
    // Keeps the process alive; the server owns the event loop.
  });
  return 0;
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof ProductRuntimeStartupErrorV0 && error.guidance.length > 0) {
      for (const line of error.guidance) console.error(line);
    } else {
      console.error("The local visual product failed.");
      console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exitCode = 1;
  });
