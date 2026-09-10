import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fromRoot = (...parts) => join(root, ...parts);
const read = (path) => readFile(fromRoot(path), "utf8");

function invariant(condition, detail) {
  if (!condition) {
    throw new Error(`governance invariant failed: ${detail}`);
  }
}

async function workspaceDirectories() {
  const workspaceYaml = await read("pnpm-workspace.yaml");
  const patterns = [...workspaceYaml.matchAll(/^\s*-\s*["']?([^"'\r\n]+)["']?\s*$/gm)]
    .map((match) => match[1]?.trim())
    .filter((value) => value !== undefined);
  const directories = [];

  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const parent = pattern.slice(0, -2);
      const entries = await readdir(fromRoot(parent), { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) directories.push(`${parent}/${entry.name}`);
      }
    } else {
      directories.push(pattern);
    }
  }

  return directories.sort();
}

const workspaceDirs = await workspaceDirectories();
const workspacePackages = await Promise.all(
  workspaceDirs.map(async (directory) => {
    const manifest = JSON.parse(await read(`${directory}/package.json`));
    invariant(typeof manifest.name === "string", `${directory} has no package name`);
    return { directory, name: manifest.name };
  })
);

const eslintModule = await import(pathToFileURL(fromRoot("eslint.config.mjs")).href);
const eslintConfigs = eslintModule.default;
invariant(Array.isArray(eslintConfigs), "eslint config must export a configuration array");
const configuredGlobs = new Set(
  eslintConfigs.flatMap((config) => Array.isArray(config.files) ? config.files : [])
);

for (const workspace of workspacePackages) {
  const expected = `${workspace.directory}/src/**/*.ts`;
  invariant(configuredGlobs.has(expected), `${workspace.name} lacks an ESLint package-boundary rule`);
}

const currentState = await read("CURRENT_STATE.md");
for (const field of ["Status:", "Authority:", "Last verified against commit:", "Workspace projects:"]) {
  invariant(currentState.includes(field), `CURRENT_STATE.md lacks ${field}`);
}
const declaredCount = currentState.match(/Workspace projects:\s*\**\s*(\d+)/)?.[1];
invariant(Number(declaredCount) === workspacePackages.length,
  `CURRENT_STATE workspace count ${declaredCount ?? "missing"} != actual ${workspacePackages.length}`);

const activeGovernanceDocs = [
  "README.md",
  "CURRENT_STATE.md",
  "ROADMAP.md",
  "NEXT_ACTIONS.md",
  "RESEARCH_STATE.md",
  "ARCHITECTURE.md"
];
for (const path of activeGovernanceDocs) {
  const content = await read(path);
  invariant(!content.includes("<external-audit-workspace>"), `${path} contains unresolved external-audit placeholder`);
}

const conformanceFiles = (await readdir(fromRoot("evals", "conformance")))
  .filter((name) => name.endsWith(".test.ts"));
const conformanceReadme = await read("evals/conformance/README.md");
invariant(
  conformanceFiles.length === 0 || !/(contains? no tests|contains? no .*fixtures|当前无.*测试)/i.test(conformanceReadme),
  "conformance README denies tests that exist"
);

const rootManifest = JSON.parse(await read("package.json"));
for (const gate of ["build", "lint", "test", "typecheck"]) {
  const command = rootManifest.scripts?.[gate];
  invariant(typeof command === "string" && command.trim().length > 0, `missing root ${gate} command`);
  invariant(!/^\s*(?:echo\b|true\b|exit\s+0\b)/i.test(command), `root ${gate} command is a no-op`);
}

// The ordered gate sequence a clean checkout must satisfy. CI and the root
// aggregate command must both run exactly this sequence, so neither a
// developer nor a pipeline can silently skip a gate or reorder it.
const orderedGates = [
  "pnpm governance",
  "pnpm typecheck",
  "pnpm build",
  "pnpm typecheck:auxiliary",
  "pnpm lint",
  "pnpm test"
];

const verify = rootManifest.scripts?.["verify"];
invariant(typeof verify === "string" && verify.trim().length > 0, "missing root verify command");
let cursor = -1;
for (const gate of orderedGates) {
  const position = verify.indexOf(gate, cursor + 1);
  invariant(position > cursor, `root verify must run ${gate} in gate order`);
  cursor = position;
}

const ci = await read(".github/workflows/ci.yml");
invariant(ci.includes("pnpm install --frozen-lockfile"), "CI is missing pnpm install --frozen-lockfile");
cursor = -1;
for (const gate of orderedGates) {
  const position = ci.indexOf(gate, cursor + 1);
  invariant(position > cursor, `CI must run ${gate} in gate order`);
  cursor = position;
}

console.log(
  `governance invariants: PASS (${workspacePackages.length} workspaces, ${conformanceFiles.length} conformance test files)`
);
