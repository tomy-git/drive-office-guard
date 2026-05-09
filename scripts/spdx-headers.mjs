// SPDX-License-Identifier: MPL-2.0

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const LICENSE_IDENTIFIER = "MPL-2.0";
const SPDX_TEXT = `SPDX-License-Identifier: ${LICENSE_IDENTIFIER}`;
const REUSE_TOML_PATH = "REUSE.toml";
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldCheck = args.has("--check") || !shouldWrite;

const commentStyles = new Map([
  [".css", { prefix: "/* ", suffix: " */" }],
  [".cjs", { prefix: "// ", suffix: "" }],
  [".html", { prefix: "<!-- ", suffix: " -->" }],
  [".js", { prefix: "// ", suffix: "" }],
  [".md", { prefix: "<!-- ", suffix: " -->" }],
  [".mjs", { prefix: "// ", suffix: "" }],
  [".ts", { prefix: "// ", suffix: "" }],
  [".tsx", { prefix: "// ", suffix: "" }],
  [".toml", { prefix: "# ", suffix: "" }],
  [".yaml", { prefix: "# ", suffix: "" }],
  [".yml", { prefix: "# ", suffix: "" }],
]);

const basenameCommentStyles = new Map([[".gitignore", { prefix: "# ", suffix: "" }]]);

const excludedDirectories = new Set([".git", "coverage", "dist", "node_modules"]);

const reuseTomlManagedExtensions = new Set([".json"]);

const excludedFiles = new Set(["LICENSE"]);

function listGitFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean).sort();
}

function isExcluded(filePath) {
  const pathParts = filePath.split(path.sep);

  return (
    pathParts.some((part) => excludedDirectories.has(part)) ||
    excludedFiles.has(path.basename(filePath))
  );
}

function getCommentStyle(filePath) {
  return (
    basenameCommentStyles.get(path.basename(filePath)) ??
    commentStyles.get(path.extname(filePath))
  );
}

function expectedHeader(style) {
  return `${style.prefix}${SPDX_TEXT}${style.suffix}`;
}

function getReuseTomlLicenseBlocks() {
  if (!existsSync(REUSE_TOML_PATH)) {
    return [];
  }

  const reuseTomlContent = readFileSync(REUSE_TOML_PATH, "utf8");

  return reuseTomlContent
    .split(/\[\[annotations\]\]/)
    .slice(1)
    .map((paragraph) => {
      const pathMatch = paragraph.match(/^path\s*=\s*(?:"([^"]+)"|\[([\s\S]*?)\])/m);
      const licenseMatch = paragraph.match(
        /^SPDX-License-Identifier\s*=\s*"([^"]+)"$/m,
      );

      if (!pathMatch || !licenseMatch) {
        return null;
      }

      const patterns =
        pathMatch[1] !== undefined
          ? [pathMatch[1]]
          : [...pathMatch[2].matchAll(/"([^"]+)"/g)].map((match) => match[1]);

      return { patterns, license: licenseMatch[1].trim() };
    })
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function reuseTomlPatternToRegExp(pattern) {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];

    if (character === "*" && nextCharacter === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(character);
    }
  }

  return new RegExp(`^${source}$`);
}

function isCoveredByReuseToml(filePath, reuseTomlLicenseBlocks) {
  return reuseTomlLicenseBlocks.some(
    ({ patterns, license }) =>
      license === LICENSE_IDENTIFIER &&
      patterns.some((pattern) => reuseTomlPatternToRegExp(pattern).test(filePath)),
  );
}

function hasSpdxHeader(content) {
  const firstLines = content.split(/\r?\n/, 5).join("\n");

  return firstLines.includes(SPDX_TEXT);
}

function addHeader(content, header) {
  if (content.startsWith("#!")) {
    const newlineIndex = content.indexOf("\n");

    if (newlineIndex === -1) {
      return `${content}\n${header}\n`;
    }

    return `${content.slice(0, newlineIndex + 1)}${header}\n\n${content.slice(
      newlineIndex + 1,
    )}`;
  }

  return `${header}\n\n${content}`;
}

const missingHeaders = [];
const missingReuseTomlCoverage = [];
const updatedFiles = [];
const reuseTomlLicenseBlocks = getReuseTomlLicenseBlocks();

for (const filePath of listGitFiles()) {
  if (isExcluded(filePath)) {
    continue;
  }

  if (reuseTomlManagedExtensions.has(path.extname(filePath))) {
    if (!isCoveredByReuseToml(filePath, reuseTomlLicenseBlocks)) {
      missingReuseTomlCoverage.push(filePath);
    }

    continue;
  }

  const style = getCommentStyle(filePath);

  if (!style) {
    continue;
  }

  const content = readFileSync(filePath, "utf8");

  if (hasSpdxHeader(content)) {
    continue;
  }

  missingHeaders.push(filePath);

  if (shouldWrite) {
    writeFileSync(filePath, addHeader(content, expectedHeader(style)));
    updatedFiles.push(filePath);
  }
}

if (shouldWrite) {
  if (updatedFiles.length > 0) {
    console.log(`Added ${SPDX_TEXT} to ${updatedFiles.length} file(s).`);
  } else {
    console.log(`All checked files already include ${SPDX_TEXT}.`);
  }
}

if (shouldCheck && missingHeaders.length > 0) {
  console.error(`Missing ${SPDX_TEXT}:`);
  for (const filePath of missingHeaders) {
    console.error(`- ${filePath}`);
  }
  console.error("Run `npm run license:headers` to add missing headers.");
  process.exitCode = 1;
}

if (shouldCheck && missingReuseTomlCoverage.length > 0) {
  console.error(`Missing ${LICENSE_IDENTIFIER} coverage in ${REUSE_TOML_PATH}:`);
  for (const filePath of missingReuseTomlCoverage) {
    console.error(`- ${filePath}`);
  }
  process.exitCode = 1;
}
