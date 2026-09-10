import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

/** The first lintText() loads the whole flat config; under a loaded CI machine
 * that can exceed vitest's 5s default, so the probe states its budget. */
const LINT_TIMEOUT_MS = 60_000;

async function lintImport(source: string, filePath: string) {
  const [result] = await eslint.lintText(source, { filePath });
  if (result === undefined) {
    throw new Error(`ESLint returned no result for ${filePath}`);
  }
  return result;
}

describe("workspace dependency-boundary enumeration", () => {
  it.each([
    {
      filePath: "packages/influence-evidence/src/__boundary_probe__.ts",
      source: 'import "@characteros-next/appraisal";\n'
    },
    {
      filePath: "packages/memory-influence/src/__boundary_probe__.ts",
      source: 'import "@characteros-next/behavior";\n'
    },
    {
      filePath: "packages/appraisal/src/__boundary_probe__.ts",
      source: 'import "../../memory-influence/src/index.js";\n'
    }
  ])("rejects unauthorized import from $filePath", async ({ filePath, source }) => {
    const result = await lintImport(source, filePath);
    expect(result.messages.map(({ ruleId }) => ruleId)).toContain("no-restricted-imports");
    expect(result.errorCount).toBeGreaterThan(0);
  }, LINT_TIMEOUT_MS);

  it.each([
    {
      filePath: "packages/influence-evidence/src/__boundary_probe__.ts",
      source:
        'import "@characteros-next/memory-influence";\nimport "@characteros-next/subject-core";\n'
    },
    {
      filePath: "packages/memory-influence/src/__boundary_probe__.ts",
      source: 'import "@characteros-next/memory";\nimport "@characteros-next/subject-core";\n'
    }
  ])("allows declared dependencies from $filePath", async ({ filePath, source }) => {
    const result = await lintImport(source, filePath);
    expect(result.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`)).toEqual([]);
    expect(result.errorCount).toBe(0);
  }, LINT_TIMEOUT_MS);
});
