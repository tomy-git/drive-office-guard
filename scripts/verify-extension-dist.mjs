// SPDX-License-Identifier: MPL-2.0

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2] ?? "firefox";

const checksByTarget = {
  firefox: {
    required: ["background-firefox.js"],
    forbidden: ["service-worker-chromium.js", "managed_schema.json"],
    background: {
      scripts: ["background-firefox.js"],
      type: "module",
    },
    hasManagedSchema: false,
  },
  chrome: {
    required: ["service-worker-chromium.js", "managed_schema.json"],
    forbidden: ["background-firefox.js"],
    background: {
      service_worker: "service-worker-chromium.js",
      type: "module",
    },
    hasManagedSchema: true,
  },
};

if (!(target in checksByTarget)) {
  throw new Error(
    `Unsupported browser target "${target}". Expected one of: ${Object.keys(checksByTarget).join(", ")}`,
  );
}

const distDirectory = resolve(import.meta.dirname, "..", "dist", target);
const manifestPath = resolve(distDirectory, "manifest.json");
const checks = checksByTarget[target];

function assertExists(fileName) {
  if (!existsSync(resolve(distDirectory, fileName))) {
    throw new Error(`${target} build is missing dist/${target}/${fileName}`);
  }
}

function assertAbsent(fileName) {
  if (existsSync(resolve(distDirectory, fileName))) {
    throw new Error(`${target} build must not include dist/${target}/${fileName}`);
  }
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read dist/${target}/manifest.json for ${target} build`, {
      cause: error,
    });
  }
}

for (const fileName of checks.required) {
  assertExists(fileName);
}

for (const fileName of checks.forbidden) {
  assertAbsent(fileName);
}

const manifest = readManifest();

if (JSON.stringify(manifest.background) !== JSON.stringify(checks.background)) {
  throw new Error(`${target} build has unexpected manifest background entry`);
}

if (checks.hasManagedSchema) {
  if (manifest.storage?.managed_schema !== "managed_schema.json") {
    throw new Error(`${target} build must reference managed_schema.json`);
  }
} else if ("storage" in manifest) {
  throw new Error(`${target} build must not include a managed storage schema`);
}
