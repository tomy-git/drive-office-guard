// SPDX-License-Identifier: MPL-2.0

import { rmSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];
const distDirectory = target
  ? resolve(import.meta.dirname, "../dist", target)
  : resolve(import.meta.dirname, "../dist");

rmSync(distDirectory, {
  force: true,
  recursive: true,
});

if (target) {
  for (const legacyPath of [
    "background-firefox.js",
    "blocked.html",
    "blocked.js",
    "drive-menu-guard.js",
    "icons",
    "manifest.json",
    "options.html",
    "options.js",
    "service-worker-chromium.js",
  ]) {
    rmSync(resolve(import.meta.dirname, "../dist", legacyPath), {
      force: true,
      recursive: true,
    });
  }
}
