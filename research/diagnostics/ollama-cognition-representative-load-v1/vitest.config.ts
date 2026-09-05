import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["research/diagnostics/ollama-cognition-representative-load-v1/fixture.test.ts"],
    passWithNoTests: false,
    allowOnly: false
  }
});
