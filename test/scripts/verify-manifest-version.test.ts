// SPDX-License-Identifier: MPL-2.0

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(
  import.meta.dirname,
  "../../scripts/verify-manifest-version.mjs",
);
const tempRoots: string[] = [];

function createProject(files: {
  packageVersion?: string;
  manifestVersion?: string;
  sourceManifest?: Record<string, unknown>;
  target?: "firefox" | "chrome";
}) {
  const target = files.target ?? "firefox";
  const projectRoot = mkdtempSync(resolve(tmpdir(), "drive-office-guard-version-"));
  tempRoots.push(projectRoot);

  mkdirSync(resolve(projectRoot, "dist", target), { recursive: true });
  writeFileSync(
    resolve(projectRoot, "package.json"),
    JSON.stringify({ version: files.packageVersion ?? "1.2.3" }),
  );
  writeFileSync(
    resolve(projectRoot, "dist", target, "manifest.json"),
    JSON.stringify({ version: files.manifestVersion ?? "1.2.3" }),
  );
  writeFileSync(
    resolve(projectRoot, "manifest.firefox.json"),
    JSON.stringify(
      target === "firefox"
        ? (files.sourceManifest ?? { manifest_version: 3 })
        : { manifest_version: 3 },
    ),
  );
  writeFileSync(
    resolve(projectRoot, "manifest.chrome.json"),
    JSON.stringify(
      target === "chrome"
        ? (files.sourceManifest ?? { manifest_version: 3 })
        : { manifest_version: 3 },
    ),
  );

  return projectRoot;
}

function runVerifier(projectRoot: string, target = "firefox") {
  return () =>
    execFileSync(process.execPath, [scriptPath, target], {
      env: {
        ...process.env,
        PROJECT_ROOT: projectRoot,
      },
      stdio: "pipe",
    });
}

describe("verify-manifest-version", () => {
  afterEach(() => {
    for (const projectRoot of tempRoots.splice(0)) {
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });

  it("dist manifest と package.json の version が一致すれば成功する", () => {
    const projectRoot = createProject({});

    expect(runVerifier(projectRoot)).not.toThrow();
  });

  it("manifest.firefox.json に version がある場合は失敗する", () => {
    const projectRoot = createProject({
      sourceManifest: { manifest_version: 3, version: "1.2.3" },
    });

    expect(runVerifier(projectRoot)).toThrow(
      /manifest\.firefox\.json must not define version/,
    );
  });

  it("dist manifest と package.json の version が不一致の場合は失敗する", () => {
    const projectRoot = createProject({
      manifestVersion: "1.2.4",
      packageVersion: "1.2.3",
    });

    expect(runVerifier(projectRoot)).toThrow(
      /dist\/firefox\/manifest\.json version \(1\.2\.4\) does not match package\.json version \(1\.2\.3\)/,
    );
  });

  it("Chrome manifest も package.json の version と一致すれば成功する", () => {
    const projectRoot = createProject({ target: "chrome" });

    expect(runVerifier(projectRoot, "chrome")).not.toThrow();
  });

  it("manifest.chrome.json に version がある場合は失敗する", () => {
    const projectRoot = createProject({
      sourceManifest: { manifest_version: 3, version: "1.2.3" },
      target: "chrome",
    });

    expect(runVerifier(projectRoot, "chrome")).toThrow(
      /manifest\.chrome\.json must not define version/,
    );
  });
});
