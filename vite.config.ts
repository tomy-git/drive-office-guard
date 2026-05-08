import { resolve } from "node:path";

import { defineConfig } from "vite";

const entries = {
  "background-firefox": "src/background/background-firefox.ts",
  "drive-menu-guard": "src/content/drive-menu-guard.ts",
  options: "src/options/options.ts",
} as const;

const entryName = process.env.BUILD_ENTRY as keyof typeof entries | undefined;

if (!entryName || !(entryName in entries)) {
  throw new Error(`BUILD_ENTRY must be one of: ${Object.keys(entries).join(", ")}`);
}

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
