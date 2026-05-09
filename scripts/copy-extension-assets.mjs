// SPDX-License-Identifier: MPL-2.0

import { copyFileSync, cpSync, mkdirSync } from "node:fs";
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
  [manifestByTarget[target], "manifest.json"],
  ["src/pages/blocked.html", "blocked.html"],
  ["src/pages/options.html", "options.html"],
];

if (target === "chrome") {
  copies.push(["managed_schema.json", "managed_schema.json"]);
}

for (const [from, to] of copies) {
  const destination = resolve(distDirectory, to);

  mkdirSync(dirname(destination), {
    recursive: true,
  });

  copyFileSync(resolve(import.meta.dirname, "..", from), destination);
}

/* icons copy */
cpSync(
  resolve(import.meta.dirname, "..", "public/icons"),
  resolve(distDirectory, "icons"),
  {
    recursive: true,
  },
);
