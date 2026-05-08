import { describe, expect, it, vi } from "vitest";

vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
      managed: {
        get: vi.fn(),
      },
    },
  },
}));

import {
  DEFAULT_GUARD_SETTINGS,
  mergeSettings,
  normalizeSettings,
} from "../../src/shared/config";

describe("config", () => {
  it("boolean の設定値だけを正規化する", () => {
    expect(
      normalizeSettings({
        blockSheets: false,
        blockSlides: "false",
        blockDocs: true,
      }),
    ).toEqual({
      blockSheets: false,
      blockDocs: true,
    });
  });

  it("managed の指定キーだけが sync/default より優先される", () => {
    expect(
      mergeSettings({ blockSheets: false, blockSlides: false }, { blockSlides: true }),
    ).toEqual({
      settings: {
        ...DEFAULT_GUARD_SETTINGS,
        blockSheets: false,
        blockSlides: true,
      },
      managedKeys: ["blockSlides"],
    });
  });
});
