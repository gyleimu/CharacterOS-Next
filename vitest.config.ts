import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "product/sandbox/src/**/*.test.ts",
      "product/web/src/**/*.test.ts",
      "evals/conformance/**/*.test.ts"
    ],
    allowOnly: false
  }
});
