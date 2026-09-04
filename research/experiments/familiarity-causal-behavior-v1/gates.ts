import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { check, equal } from "./fixtures.ts";
import { BASELINE, LINT_DEBT } from "./contract.ts";
import { ROOT, EXPERIMENT_PATH, TEST_PATH, sourceFingerprint, builtFingerprint, freshDirectory, writeJson, type Gates } from "./artifacts.ts";

const output = freshDirectory(process.argv[2] ?? "tmp/familiarity-gates-v1");
const commands: Gates["commands"] = [];
function run(name: string, executable: string, args: string[]) {
  const result = spawnSync(executable, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  const record = { name, executable, args, exit_code: result.status, stdout: result.stdout ?? "", stderr: (result.stderr ?? "") + (result.error?.message ?? "") };
  commands.push(record);
  writeJson(join(output, `${name.replaceAll(":", "-").replaceAll("/", "-")}.json`), record);
  console.log(`${name}: ${result.status === 0 ? "PASS" : "FAIL"}`);
  check(result.status === 0, `gate ${name}; see persisted output ${output}`);
}

// Same tsc scripts as workspace package.json, in dependency order. Direct Node
// entrypoints avoid this Windows host's broken pnpm .bin child PATH resolution.
const dirs = [...readdirSync(join(ROOT, "packages"), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => `packages/${e.name}`), "product/sandbox"];
const packages = dirs.map(dir => ({ dir, pkg: JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8")) as {
  name: string; scripts: { build: string; typecheck: string }; dependencies?: Record<string, string>
} }));
const ordered: typeof packages = [];
while (ordered.length < packages.length) {
  const next = packages.find(p => !ordered.includes(p) && Object.keys(p.pkg.dependencies ?? {}).every(d => !packages.some(x => x.pkg.name === d) || ordered.some(x => x.pkg.name === d)));
  check(next, "workspace dependency order"); ordered.push(next);
}
for (const mode of ["build", "typecheck"] as const) {
  for (const { dir, pkg } of ordered) {
    const config = mode === "build" ? "tsconfig.json" : "tsconfig.typecheck.json";
    check(pkg.scripts[mode] === `tsc -p ${config}`, "unchanged workspace gate scripts");
    run(`${mode}:${dir}`, process.execPath, ["node_modules/typescript/bin/tsc", "-p", `${dir}/${config}`]);
  }
}
run("harness-typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "-p", `${EXPERIMENT_PATH}/tsconfig.json`]);
run("targeted-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run", TEST_PATH]);
run("v0-integrity-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run", "evals/conformance/familiarity-causal-behavior-v0.test.ts", TEST_PATH]);
run("production-behavior-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run", "packages/runtime/src/transitions/conversation", "packages/behavior/src/behavior-contracts.test.ts", "packages/memory/src/records/episode-content-reader.test.ts"]);
run("full-tests", process.execPath, ["node_modules/vitest/vitest.mjs", "run"]);
const eslint = new ESLint({ cwd: ROOT });
const changed = await eslint.lintFiles([`${EXPERIMENT_PATH}/*.ts`, TEST_PATH]);
writeJson(join(output, "changed-lint.json"), changed.map(r => ({ file: r.filePath, messages: r.messages })));
check(changed.every(r => r.messages.length === 0), "changed-file lint zero warnings/errors");
console.log("changed-file-lint: PASS");
const full = (await eslint.lintFiles(["."])).filter(r => r.messages.length).flatMap(r => r.messages.map(m => ({
  file: r.filePath.replaceAll("\\", "/").slice(ROOT.replaceAll("\\", "/").length), line: m.line, ruleId: m.ruleId, message: m.message
})));
writeJson(join(output, "full-lint.json"), full);
check(equal(full, LINT_DEBT), "full lint equals exactly the two baseline debts");
console.log("full-lint-known-debt: PASS (2 baseline errors, no new debt)");
// Includes staged new harness files as well as unstaged changes.
run("diff-check", "git", ["diff", "--check", BASELINE]);
const gates: Gates = { status: "PASS", source_fingerprint: sourceFingerprint(), built_fingerprint: builtFingerprint(), commands, full_lint: full };
writeJson(join(output, "gates.json"), gates);
writeFileSync(join(output, "SUMMARY.md"), `# Engineering gates\n\nPASS. ${commands.length} commands green; changed lint clean; full lint exactly 2 baseline unused-vars errors.\n\nSource: ${gates.source_fingerprint}\nBuilt: ${gates.built_fingerprint}\n`, { flag: "wx" });
console.log(output);
