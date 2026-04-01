import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.js"],
    hookTimeout: 60000, // Increase timeout for MongoDB memory server
    testTimeout: 30000,
    coverage: {
      reporter: ["text", "json", "html"]
    }
  }
});
