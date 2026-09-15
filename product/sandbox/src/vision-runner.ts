#!/usr/bin/env node
/**
 * VISUAL_PERCEPTION_PRODUCT_RUNNER_V0 — the composition root that runs the
 * vision adapter against the ONE persistent CharacterOS subject.
 *
 *   camera / desktop → capture → change detection → MiniCPM-V → observation
 *   → ProductRuntime.submitExternalObservation → FROZEN canonical ingress
 *
 * Run with `pnpm vision` (see package scripts). Every log line is JSON carrying
 * only structural fields: timestamp, source, latency, change score, observation
 * id, error type. No screenshot content is ever printed.
 *
 * Environment (all optional):
 *   VISION_RUN_SECONDS   stop automatically after N seconds and print metrics
 *   VISION_REPORT_EVERY_SECONDS  periodic METRICS line cadence (default 60, 0 = off)
 *   plus every VISION_* knob documented in packages/vision/README.md
 */

import {
  createStreamVisionLoggerV0,
  resolveVisionConfigV0,
  VisionPerceptionV0,
  type VisionMetricsSnapshotV0
} from "@characteros-next/vision";
import { ProductRuntimeStartupErrorV0, createProductRuntimeV0 } from "./product-runtime.js";
import { createProductVisionSinkV0 } from "./product-vision-bridge.js";

function readPositiveIntV0(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function metricsLineV0(snapshot: VisionMetricsSnapshotV0): string {
  return JSON.stringify({
    code: "METRICS",
    uptime_s: Math.round(snapshot.uptime_ms / 1000),
    attention: snapshot.attention_level,
    frames_captured: snapshot.frames_captured,
    frames_skipped_cadence: snapshot.frames_skipped_cadence,
    frames_dropped_no_change: snapshot.frames_dropped_no_change,
    frames_dropped_rate_limit: snapshot.frames_dropped_rate_limit,
    frames_dropped_superseded: snapshot.frames_dropped_superseded,
    frames_analyzed: snapshot.frames_analyzed,
    observations_emitted: snapshot.observations_emitted,
    observations_deduplicated: snapshot.observations_deduplicated,
    model_errors: snapshot.model_errors,
    invalid_model_outputs: snapshot.invalid_model_outputs,
    sink_errors: snapshot.sink_errors,
    capture_errors: snapshot.capture_errors,
    inference_calls: snapshot.inference_calls,
    inference_calls_per_minute: snapshot.inference_calls_per_minute,
    average_inference_latency_ms: snapshot.average_inference_latency_ms,
    max_inference_latency_ms: snapshot.max_inference_latency_ms,
    sources: {
      camera: snapshot.sources.camera,
      desktop: snapshot.sources.desktop
    }
  });
}

async function main(): Promise<number> {
  const config = resolveVisionConfigV0(process.env);
  const write = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const logger = createStreamVisionLoggerV0(write);

  let runtime;
  try {
    runtime = await createProductRuntimeV0({ session_label: "vision", write });
  } catch (error) {
    if (error instanceof ProductRuntimeStartupErrorV0) {
      for (const line of error.guidance.length > 0 ? error.guidance : [error.message]) process.stderr.write(`${line}\n`);
      return 1;
    }
    process.stderr.write(`CharacterOS failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const bootstrap = await runtime.bootstrap();
  write(
    JSON.stringify({
      code: "VISION_RUNNER_READY",
      subject_id: bootstrap.identity.subject_id,
      display_name: bootstrap.identity.display_name,
      status: bootstrap.status,
      vision_model: config.inference.model,
      vision_provider: config.inference.provider,
      endpoint: config.inference.endpoint,
      attention: config.attention_level,
      camera_enabled: config.camera.enabled,
      desktop_enabled: config.desktop.enabled,
      local_only: true
    })
  );

  const perception = new VisionPerceptionV0({
    config,
    sink: createProductVisionSinkV0(runtime),
    logger
  });
  const started = await perception.start();
  for (const failure of started.failed) {
    write(JSON.stringify({ code: "SOURCE_START_FAILED", source: failure.source, error: failure.code, detail: failure.detail }));
  }
  if (started.started.length === 0) {
    process.stderr.write(
      "No vision source could start. Check VISION_FFMPEG_PATH (ffmpeg must be on PATH) and that a camera is present.\n"
    );
    await perception.stop();
    await runtime.shutdown();
    return 1;
  }

  const reportEvery = readPositiveIntV0("VISION_REPORT_EVERY_SECONDS") ?? 60;
  const reportTimer =
    reportEvery === 0
      ? null
      : setInterval(() => write(metricsLineV0(perception.getMetrics())), reportEvery * 1000);

  let shuttingDown = false;
  const shutdown = async (code: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (reportTimer !== null) clearInterval(reportTimer);
    write(metricsLineV0(perception.getMetrics()));
    await perception.stop();
    await runtime.shutdown();
    process.exitCode = code;
  };

  const runSeconds = readPositiveIntV0("VISION_RUN_SECONDS");
  if (runSeconds !== null) {
    setTimeout(() => {
      void shutdown(0);
    }, runSeconds * 1000);
  }
  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (shuttingDown) {
        clearInterval(timer);
        resolve();
      }
    }, 200);
  });
  return 0;
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`vision runner failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
