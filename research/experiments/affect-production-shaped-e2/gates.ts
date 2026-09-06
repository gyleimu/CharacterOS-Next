/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — engineering gates (E1 conventions).
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";
import { check, equal } from "./fixtures.ts";
import { BASELINE_COMMIT, EXPERIMENT_PATH, TEST_PATH } from "./contract.ts";
import { ROOT, freshDirectory, sourceFingerprint, builtFingerprint, writeJson, frozenIntegrity } from "./artifacts.ts";

export interface GatesE2 {
  readonly status: "PASS";
  readonly source_fingerprint: string;
  readonly built_fingerprint: string;
  readonly commands: readonly { readonly name: string; readonly exit_code: number | null; readonly stdout: string; readonly stderr: string }[];
  readonly full_lint: readonly unknown[];
}

export async function runEngineeringGates(argvOutput?: string): Promise<{ output: string; gates: GatesE2 }> {
  const output = freshDirectory(argvOutput ?? "tmp/affect-production-shaped-e2-gates");
  const commands: { name: string; exit_code: number | null; stdout: string; stderr: string }[] = [];
  function run(name: string, executable: string, args: string[]): void {
    const result = spawnSync(executable, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    const record = { name, exit_code: result.status, stdout: result.stdout ?? "", stderr: (result.stderr ?? "") + (result.error?.message ?? "") };
    commands.push(record);
    writeJson(join(output, `${name.replaceAll(":", "-").replaceAll("/", "-")}.json`), record);
    console.log(`${name}: ${result.status === 0 ? "PASS" : "FAIL"}`);
    check(result.status === 0, `gate ${name}; see persisted output ${output}`);
  }

  const dirs = [...readdirSync(join(ROOT, "packages"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `packages/${e.name}`), "product/sandbox"];
  const packages = dirs.map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8")) as {
    name: string; scripts: { build: string; typecheck: string }; dependencies?: Record<string, string>;
  } }));
  const ordered: typeof packages = [];
  while (ordered.length < packages.length) {
    const next = packages.find((p) => !ordered.includes(p) && Object.keys(p.pkg.dependencies ?? {}).every((d) => !packages.some((x) => x.pkg.name === d) || ordered.some((x) => x.pkg.name === d)));
    check(next !== undefined, "workspace dependency order");
    if (next !== undefined) ordered.push(next);
  }
  for (const mode of ["build", "typecheck"] as const) {
    for (const { dir, pkg } of ordered) {
      const config = mode === "build" ? "tsconfig.json" : "tsconfig.typecheck.json";
      check(pkg.scripts[mode] === `tsc -p ${config}`, "unchanged workspace gate scripts");
      run(`${mode}:${dir}`, process.execPath, ["node_modules/typescript/bin/tsc", "-p", `${dir}/${config}`]);
    }
  }
  run("harness-typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "-p", `${EXPERIMENT_PATH}/tsconfig.json`]);
  run("conformance-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run", TEST_PATH]);
  run("e1-integrity-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run", "evals/conformance/affect-state-retention-e1.test.ts"]);
  run("full-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run"]);

  const eslint = new ESLint({ cwd: ROOT });
  const changed = await eslint.lintFiles([`${EXPERIMENT_PATH}/*.ts`, TEST_PATH]);
  writeJson(join(output, "changed-lint.json"), changed.map((r) => ({ file: r.filePath, messages: r.messages })));
  check(changed.every((r) => r.messages.length === 0), "changed-file lint zero warnings/errors");
  console.log("changed-file-lint: PASS");
  const full = (await eslint.lintFiles(["."])).filter((r) => r.messages.length).flatMap((r) => r.messages.map((m) => ({
    file: r.filePath.replaceAll("\\", "/").slice(ROOT.replaceAll("\\", "/").length), line: m.line, ruleId: m.ruleId, message: m.message
  })));
  writeJson(join(output, "full-lint.json"), full);
  check(equal(full, []), "full lint exactly the current zero-debt baseline");
  console.log("full-lint-zero-debt: PASS");

  run("diff-check", "git", ["diff", "--check", BASELINE_COMMIT]);
  const integrity = frozenIntegrity();
  check(equal(integrity.production_diff, "EMPTY"), "production and all non-E2 files frozen vs baseline");

  const gates: GatesE2 = {
    status: "PASS", source_fingerprint: sourceFingerprint(), built_fingerprint: builtFingerprint(),
    commands, full_lint: full
  };
  writeJson(join(output, "gates.json"), gates);
  writeFileSync(join(output, "SUMMARY.md"),
    `# E2 engineering gates\n\nPASS. ${String(commands.length)} commands green; changed lint clean; full lint zero debt; production frozen at ${BASELINE_COMMIT}.\n\nSource: ${gates.source_fingerprint}\nBuilt: ${gates.built_fingerprint}\n`,
    { flag: "wx" });
  console.log(output);
  return { output, gates };
}

// Run directly: `node research/experiments/affect-production-shaped-e2/gates.ts <outdir>`.
const invokedDirectly = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await runEngineeringGates(process.argv[2]);
}
