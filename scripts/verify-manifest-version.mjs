// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(
  process.env.PROJECT_ROOT ?? resolve(import.meta.dirname, ".."),
);
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "dist/manifest.json"), "utf8"),
);
const firefoxManifest = JSON.parse(
  readFileSync(resolve(projectRoot, "manifest.firefox.json"), "utf8"),
);

if (Object.hasOwn(firefoxManifest, "version")) {
  throw new Error(
    "manifest.firefox.json must not define version; package.json is the single source of truth",
  );
}

if (manifest.version !== packageJson.version) {
  throw new Error(
    `dist/manifest.json version (${manifest.version}) does not match package.json version (${packageJson.version})`,
  );
}

console.log(`manifest version matches package.json: ${packageJson.version}`);
