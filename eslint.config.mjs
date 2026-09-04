import js from "@eslint/js";
import tseslint from "typescript-eslint";

const workspacePackages = [
  "@characteros-next/subject-core",
  "@characteros-next/memory",
  "@characteros-next/appraisal",
  "@characteros-next/affect",
  "@characteros-next/regulation",
  "@characteros-next/runtime",
  "@characteros-next/belief",
  "@characteros-next/personality",
  "@characteros-next/relationship",
  "@characteros-next/long-term-state-domain",
  "@characteros-next/behavior",
  "@characteros-next/sandbox"
];

const toRestrictedPaths = (names, message) =>
  names.map((name) => ({ name, message }));

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Test files run under vitest; the runner import is allowlisted repo-wide (chore:
 * allow vitest imports in test files). Production sources remain fail-closed.
 */
const testRunnerImports = ["vitest"];

const unapprovedBareImport = (allowedPackages) => ({
  regex: `^(?!\\.{1,2}/)(?!(?:(?:${allowedPackages
    .map(escapeRegularExpression)
    .join("|")})|(?:${testRunnerImports
    .map(escapeRegularExpression)
    .join("|")}))$).+`,
  message:
    "External and undeclared workspace imports are fail-closed until explicitly allowlisted."
});

const publicEntryOnly = [
  {
    group: ["@characteros-next/*/*", "@characteros-next/*/**"],
    message: "Import workspace packages through their public package root only."
  },
  {
    regex:
      "^(?:\\.\\./)+(?:(?:packages/)?(?:subject-core|memory|appraisal|affect|regulation|runtime|belief|personality|relationship|long-term-state-domain|behavior)|product/sandbox)(?:/|$)",
    message: "Cross-package relative imports are forbidden; use a public package root."
  }
];

const restrictedImports = (paths = [], patterns = []) => [
  "error",
  {
    paths,
    patterns: [...publicEntryOnly, ...patterns]
  }
];

const noEvaluationImports = {
  group: ["**/evals", "**/evals/**"],
  message: "Production code must not depend on conformance or evaluation assets."
};

const packageBoundaryConfig = (files, allowedPackages, message) => ({
  files: [files],
  rules: {
    "no-restricted-imports": restrictedImports(
      toRestrictedPaths(
        workspacePackages.filter((name) => !allowedPackages.includes(name)),
        message
      ),
      [noEvaluationImports, unapprovedBareImport(allowedPackages)]
    )
  }
});

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "archive/**"]
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": restrictedImports([], [noEvaluationImports])
    }
  },
  {
    files: ["packages/**/*.ts", "product/sandbox/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "Dynamic imports are disabled at P2.0 package boundaries; use reviewed static public-root imports."
        },
        {
          selector: "TSImportType",
          message:
            "Type import expressions are disabled at P2.0 package boundaries; use reviewed static public-root imports."
        }
      ]
    }
  },
  packageBoundaryConfig(
    "packages/subject-core/src/**/*.ts",
    ["@characteros-next/subject-core"],
    "subject-core cannot import domain, runtime, product, or provider packages."
  ),
  packageBoundaryConfig(
    "packages/memory/src/**/*.ts",
    ["@characteros-next/memory", "@characteros-next/subject-core"],
    "memory may consume only subject-core public readonly contracts."
  ),
  packageBoundaryConfig(
    "packages/affect/src/**/*.ts",
    ["@characteros-next/affect", "@characteros-next/subject-core"],
    "affect may consume only subject-core public readonly contracts."
  ),
  packageBoundaryConfig(
    "packages/regulation/src/**/*.ts",
    ["@characteros-next/regulation", "@characteros-next/subject-core"],
    "regulation may consume only subject-core public readonly contracts."
  ),
  packageBoundaryConfig(
    "packages/appraisal/src/**/*.ts",
    [
      "@characteros-next/appraisal",
      "@characteros-next/memory",
      "@characteros-next/subject-core"
    ],
    "appraisal may consume only memory and subject-core public contracts."
  ),
  ...["belief", "relationship"].map((name) =>
    packageBoundaryConfig(
      `packages/${name}/src/**/*.ts`,
      [`@characteros-next/${name}`],
      `${name} is deferred and cannot depend on another workspace package.`
    )
  ),
  packageBoundaryConfig(
    "packages/behavior/src/**/*.ts",
    ["@characteros-next/behavior", "@characteros-next/subject-core"],
    "behavior may consume only subject-core public contracts for pure language-behavior identity/validation rules."
  ),
  packageBoundaryConfig(
    "packages/long-term-state-domain/src/**/*.ts",
    ["@characteros-next/long-term-state-domain", "@characteros-next/subject-core"],
    "long-term-state-domain may consume only subject-core public contracts."
  ),
  packageBoundaryConfig(
    "packages/long-term-state-domain/src/**/*.test.ts",
    ["@characteros-next/long-term-state-domain", "@characteros-next/subject-core", "node:fs"],
    "long-term-state-domain tests may additionally read source fixtures for executable absence guards."
  ),
  packageBoundaryConfig(
    "packages/personality/src/**/*.ts",
    [
      "@characteros-next/personality",
      "@characteros-next/subject-core",
      "@characteros-next/memory",
      "@characteros-next/memory-influence",
      "@characteros-next/influence-evidence",
      "@characteros-next/runtime"
    ],
    "personality may consume only subject-core, memory, memory-influence, influence-evidence, and runtime public contracts."
  ),
  packageBoundaryConfig(
    "packages/runtime/src/**/*.ts",
    [
      "@characteros-next/runtime",
      "@characteros-next/subject-core",
      "@characteros-next/memory",
      "@characteros-next/memory-influence",
      "@characteros-next/influence-evidence",
      "@characteros-next/appraisal",
      "@characteros-next/affect",
      "@characteros-next/regulation",
      "@characteros-next/behavior"
    ],
    "runtime may consume only active domain packages through public roots."
  ),
  packageBoundaryConfig(
    "product/sandbox/src/**/*.ts",
    ["@characteros-next/sandbox", "@characteros-next/runtime"],
    "sandbox composition must consume runtime through its public root."
  )
);
