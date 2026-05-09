// SPDX-License-Identifier: MPL-2.0

import { resolve } from "node:path";

import { defineConfig } from "vite";

const entries = {
  "background-firefox": "src/background/background-firefox.ts",
  "drive-menu-guard": "src/content/drive-menu-guard.ts",
  blocked: "src/pages/blocked.ts",
  options: "src/options/options.ts",
} as const;

type EntryName = keyof typeof entries;

function isEntryName(value: string): value is EntryName {
  return value in entries;
}

const buildEntry = process.env.BUILD_ENTRY;

if (!buildEntry || !isEntryName(buildEntry)) {
  throw new Error(`BUILD_ENTRY must be one of: ${Object.keys(entries).join(", ")}`);
}

const entryName = buildEntry;

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, entries[entryName]),
      formats: ["iife"],
      name: `AntiGoogleOffice${entryName.replace(/(^|-)([a-z])/g, (_, __, char: string) => char.toUpperCase())}`,
      fileName: () => `${entryName}.js`,
    },
    rollupOptions: {},
  },
});
