// SPDX-License-Identifier: MPL-2.0

import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const copies = [
  ["src/pages/blocked.html", "dist/blocked.html"],
  ["src/pages/options.html", "dist/options.html"],
];

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const firefoxManifest = JSON.parse(
  readFileSync(resolve(projectRoot, "manifest.firefox.json"), "utf8"),
);

firefoxManifest.version = packageJson.version;

const manifestDestination = resolve(projectRoot, "dist/manifest.json");

mkdirSync(dirname(manifestDestination), {
  recursive: true,
});

writeFileSync(manifestDestination, `${JSON.stringify(firefoxManifest, null, 2)}\n`);

for (const [from, to] of copies) {
  const destination = resolve(projectRoot, to);

  mkdirSync(dirname(destination), {
    recursive: true,
  });

  copyFileSync(resolve(projectRoot, from), destination);
}

/* icons copy */
cpSync(resolve(projectRoot, "public/icons"), resolve(projectRoot, "dist/icons"), {
  recursive: true,
});
