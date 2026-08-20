import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "product/sandbox/src/**/*.test.ts",
      "evals/conformance/**/*.test.ts"
    ],
    passWithNoTests: true,
    allowOnly: false
  }
});
