// SPDX-License-Identifier: MPL-2.0

import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const copies = [
  ["manifest.firefox.json", "dist/manifest.json"],
  ["src/pages/blocked.html", "dist/blocked.html"],
  ["src/pages/options.html", "dist/options.html"],
];

for (const [from, to] of copies) {
  const destination = resolve(import.meta.dirname, "..", to);

  mkdirSync(dirname(destination), {
    recursive: true,
  });

  copyFileSync(resolve(import.meta.dirname, "..", from), destination);
}

/* icons copy */
cpSync(
  resolve(import.meta.dirname, "..", "public/icons"),
  resolve(import.meta.dirname, "..", "dist/icons"),
  {
    recursive: true,
  },
);
