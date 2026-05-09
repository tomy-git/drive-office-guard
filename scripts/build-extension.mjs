// SPDX-License-Identifier: MPL-2.0

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const target = process.argv[2] ?? "firefox";
const entriesByTarget = {
  firefox: ["background-firefox", "drive-menu-guard", "options", "blocked"],
  chrome: ["service-worker-chromium", "drive-menu-guard", "options", "blocked"],
};

if (!(target in entriesByTarget)) {
  throw new Error(
    `Unsupported browser target "${target}". Expected one of: ${Object.keys(entriesByTarget).join(", ")}`,
  );
}

const workspaceRoot = resolve(import.meta.dirname, "..");
const outputDirectory = `dist/${target}`;

function run(command, args, env = {}) {
  execFileSync(command, args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });
}

run("node", ["scripts/clean-dist.mjs", target]);

for (const entry of entriesByTarget[target]) {
  run("node", ["node_modules/vite/bin/vite.js", "build"], {
    BUILD_ENTRY: entry,
    BUILD_OUT_DIR: outputDirectory,
  });
}

run("node", ["scripts/copy-extension-assets.mjs", target]);
run("node", ["scripts/verify-extension-dist.mjs", target]);
