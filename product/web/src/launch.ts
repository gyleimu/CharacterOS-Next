#!/usr/bin/env node
/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — local visual product entrypoint.
 *
 * Opens/creates the ONE persistent subject through the shared product runtime
 * and serves the local browser UI. Startup fails closed with the same actionable
 * guidance as the CLI; the product never starts a fake READY UI.
 *
 * Launch with `pnpm web`, then open the printed localhost URL.
 */

import { ProductRuntimeStartupErrorV0, createProductRuntimeV0 } from "@characteros-next/sandbox";
import { startProductWebServerV0, WEB_DEFAULT_HOST_V0, WEB_DEFAULT_PORT_V0 } from "./server.js";

function envIntV0(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.length === 0) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

async function main(): Promise<number> {
  let runtime;
  try {
    runtime = await createProductRuntimeV0({
      session_label: "product-web",
      write: (line) => process.stdout.write(`${line}\n`)
    });
  } catch (error) {
    if (error instanceof ProductRuntimeStartupErrorV0) {
      const lines =
        error.guidance.length > 0
          ? error.guidance
          : ["The local product could not start.", `  detail: ${error.message}`];
      for (const line of lines) console.error(line);
      return 1;
    }
    console.error("The local visual product failed to start.");
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const handle = await startProductWebServerV0({
    runtime,
    host: process.env["CHARACTEROS_WEB_HOST"] ?? WEB_DEFAULT_HOST_V0,
    port: envIntV0("CHARACTEROS_WEB_PORT") ?? WEB_DEFAULT_PORT_V0
  });

  const bootstrap = await runtime.bootstrap();
  console.log("CharacterOS — local visual product");
  console.log(`  Subject: ${bootstrap.identity.display_name} (${bootstrap.identity.subject_id})`);
  console.log(`  Status: ${bootstrap.status}`);
  console.log(`  Model: ${bootstrap.provider.model}   Provider: READY`);
  console.log(`  Open: ${handle.url}`);
  console.log("  Local-only product. Press Ctrl+C to stop.");

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await handle.close();
    await runtime.shutdown();
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
    console.error("The local visual product failed.");
    console.error(`  detail: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
