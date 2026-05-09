// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
    },
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
