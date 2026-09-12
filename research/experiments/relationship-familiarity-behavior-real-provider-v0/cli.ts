/**
 * RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — CLI.
 *
 *   node .../cli.ts preflight <outDir>
 *   node .../cli.ts run <outDir>        # formal real-provider run (after freeze commit)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPreflight } from "./preflight.ts";
import { runFormal } from "./runner.ts";

async function main(): Promise<number> {
  const [command, outDir] = process.argv.slice(2);
  if (command === "preflight") {
    const dir = outDir ?? "tmp/familiarity-behavior-preflight";
    mkdirSync(dir, { recursive: true });
    const report = await runPreflight(async (name, value) => {
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(value, null, 2));
    });
    writeFileSync(join(dir, "preflight.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ verdict: report.verdict, failures: report.failures }, null, 2));
    if (report.verdict !== "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS") return 2;
    return 0;
  }
  if (command === "run") {
    if (outDir === undefined) throw new Error("run requires an output directory");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "source.json"),
      JSON.stringify(
        {
          experiment: "RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0",
          source_commit: process.env["CHARACTEROS_SOURCE_COMMIT"] ?? "UNKNOWN"
        },
        null,
        2
      )
    );
    const result = await runFormal(outDir);
    console.log(JSON.stringify({ final: result.final_verdict, complete: result.complete }, null, 2));
    return 0;
  }
  throw new Error(`unknown command: ${command ?? "(none)"}`);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  }
);
