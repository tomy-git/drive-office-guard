// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";

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
  isGuardSettings,
  mergeSettings,
  normalizeSettings,
  readEffectiveSettings,
  saveUserSettings,
} from "../../src/shared/config";

const browserMock = vi.mocked(browser, { deep: true });

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("boolean の設定値だけを正規化する", () => {
    expect(
      normalizeSettings({
        blockSheets: false,
        blockSlides: "false",
        blockDocs: true,
        hideDisabledLabel: true,
      }),
    ).toEqual({
      blockSheets: false,
      blockDocs: true,
      hideDisabledLabel: true,
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
        hideDisabledLabel: false,
      },
      managedKeys: ["blockSlides"],
    });
  });

  it("全キーが boolean の場合だけ完全な設定値として扱う", () => {
    expect(isGuardSettings(DEFAULT_GUARD_SETTINGS)).toBe(true);
    expect(isGuardSettings({ ...DEFAULT_GUARD_SETTINGS, blockDocs: "true" })).toBe(
      false,
    );
    expect(isGuardSettings({ blockSheets: true })).toBe(false);
    expect(isGuardSettings(null)).toBe(false);
  });

  it("sync と managed から有効設定を読み込み、managed の読み込み失敗時は sync/default にフォールバックする", async () => {
    browserMock.storage.sync.get.mockResolvedValue({
      blockSheets: false,
      hideDisabledLabel: true,
    });
    browserMock.storage.managed.get.mockRejectedValue(new Error("no managed policy"));

    await expect(readEffectiveSettings()).resolves.toEqual({
      settings: {
        blockSheets: false,
        blockSlides: true,
        blockDocs: true,
        hideDisabledLabel: true,
      },
      managedKeys: [],
    });
  });

  it("ユーザー設定保存時は boolean 値だけを storage.sync に保存する", async () => {
    browserMock.storage.sync.set.mockResolvedValue(undefined);

    await saveUserSettings({
      blockSheets: false,
      blockSlides: true,
      blockDocs: false,
      hideDisabledLabel: true,
    });

    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      blockSheets: false,
      blockSlides: true,
      blockDocs: false,
      hideDisabledLabel: true,
    });
  });

  it("管理ポリシーで固定された設定値はユーザー設定として保存しない", async () => {
    browserMock.storage.sync.set.mockResolvedValue(undefined);

    await saveUserSettings(
      {
        blockSheets: false,
        blockSlides: false,
        blockDocs: false,
        hideDisabledLabel: true,
      },
      ["blockSlides", "blockDocs"],
    );

    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      blockSheets: false,
      hideDisabledLabel: true,
    });
  });

  it("storage.sync への保存に失敗した場合はエラーを呼び出し元へ伝播する", async () => {
    const storageError = new Error("storage write failed");
    browserMock.storage.sync.set.mockRejectedValue(storageError);

    await expect(saveUserSettings({ blockSheets: false })).rejects.toThrow(
      storageError,
    );
  });
});
