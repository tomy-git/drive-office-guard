// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2] ?? "firefox";
const sourceManifestByTarget = {
  firefox: "manifest.firefox.json",
  chrome: "manifest.chrome.json",
};

if (!(target in sourceManifestByTarget)) {
  throw new Error(
    `Unsupported browser target "${target}". Expected one of: ${Object.keys(sourceManifestByTarget).join(", ")}`,
  );
}

const projectRoot = resolve(
  process.env.PROJECT_ROOT ?? resolve(import.meta.dirname, ".."),
);
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "dist", target, "manifest.json"), "utf8"),
);
const sourceManifest = JSON.parse(
  readFileSync(resolve(projectRoot, sourceManifestByTarget[target]), "utf8"),
);

if (Object.hasOwn(sourceManifest, "version")) {
  throw new Error(
    `${sourceManifestByTarget[target]} must not define version; package.json is the single source of truth`,
  );
}

if (manifest.version !== packageJson.version) {
  throw new Error(
    `dist/${target}/manifest.json version (${manifest.version}) does not match package.json version (${packageJson.version})`,
  );
}

console.log(`${target} manifest version matches package.json: ${packageJson.version}`);
