// SPDX-License-Identifier: MPL-2.0

import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const target = process.argv[2] ?? "firefox";
const manifestByTarget = {
  firefox: "manifest.firefox.json",
  chrome: "manifest.chrome.json",
};

if (!(target in manifestByTarget)) {
  throw new Error(
    `Unsupported browser target "${target}". Expected one of: ${Object.keys(manifestByTarget).join(", ")}`,
  );
}

const distDirectory = resolve(import.meta.dirname, "..", "dist", target);

const copies = [
  ["src/pages/blocked.html", "blocked.html"],
  ["src/pages/options.html", "options.html"],
];

if (target === "chrome") {
  copies.push(["managed_schema.json", "managed_schema.json"]);
}

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, manifestByTarget[target]), "utf8"),
);

manifest.version = packageJson.version;

const manifestDestination = resolve(distDirectory, "manifest.json");

mkdirSync(dirname(manifestDestination), {
  recursive: true,
});

writeFileSync(manifestDestination, `${JSON.stringify(manifest, null, 2)}\n`);

for (const [from, to] of copies) {
  const destination = resolve(distDirectory, to);

  mkdirSync(dirname(destination), {
    recursive: true,
  });

  copyFileSync(resolve(projectRoot, from), destination);
}

/* icons copy */
cpSync(resolve(projectRoot, "public/icons"), resolve(distDirectory, "icons"), {
  recursive: true,
});
