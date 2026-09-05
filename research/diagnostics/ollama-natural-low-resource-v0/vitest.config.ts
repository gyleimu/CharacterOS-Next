import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["research/diagnostics/ollama-natural-low-resource-v0/protocol.test.ts"],
    passWithNoTests: false,
    allowOnly: false
  }
});
