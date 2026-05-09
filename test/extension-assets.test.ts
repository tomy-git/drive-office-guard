// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("webextension-polyfill", () => ({
  default: {},
}));

import { getConfigKeys } from "../src/shared/config";

const workspaceRoot = resolve(import.meta.dirname, "..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(workspaceRoot, path), "utf8"));
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  expect(value).toEqual(expect.any(Object));
  expect(value).not.toBeNull();

  return value as JsonObject;
}

describe("extension assets", () => {
  it("Chrome manifest は service worker と managed schema を参照する", () => {
    const manifest = asObject(readJson("manifest.chrome.json"));
    const background = asObject(manifest.background);
    const storage = asObject(manifest.storage);

    expect(background).toEqual({
      service_worker: "service-worker-chromium.js",
      type: "module",
    });
    expect(storage.managed_schema).toBe("managed_schema.json");
    expect(manifest.web_accessible_resources).toContainEqual({
      resources: ["blocked.html"],
      matches: ["https://docs.google.com/*"],
    });
  });

  it("Chrome managed schema の properties は ConfigKey と一致する", () => {
    const schema = asObject(readJson("managed_schema.json"));
    const properties = asObject(schema.properties);

    expect(schema).not.toHaveProperty("additionalProperties");
    expect(Object.keys(properties).sort()).toEqual(getConfigKeys().sort());

    for (const key of getConfigKeys()) {
      expect(properties[key]).toMatchObject({
        type: "boolean",
      });
    }
  });
});
