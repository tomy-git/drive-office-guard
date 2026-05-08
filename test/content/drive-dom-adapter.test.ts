import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractDriveSignal,
  findActionableItems,
} from "../../src/content/drive-dom-adapter";
import {
  getOfficeFileKind,
  matchesBlockedAction,
  shouldDisableSignal,
} from "../../src/content/drive-patterns";

const DEFAULT_GUARD_SETTINGS = {
  blockSheets: true,
  blockSlides: true,
  blockDocs: true,
};

function loadFixture(name: string): HTMLElement {
  const parser = new DOMParser();
  const fixture = parser.parseFromString(
    readFileSync(resolve(__dirname, "../fixtures/drive", name), "utf8"),
    "text/html",
  );

  return fixture.body;
}

describe("drive-dom-adapter", () => {
  it("Drive メニュー fixture から Office ファイル操作の signal を抽出する", () => {
    const root = loadFixture("office-menu.html");

    const items = findActionableItems(root);
    const slideItem = items[0];
    const signal = extractDriveSignal(slideItem);

    expect(signal.role).toBe("menuitem");
    expect(signal.fileName).toContain("quarterly-plan.pptx");
    expect(getOfficeFileKind(signal)).toBe("pptx");
    expect(matchesBlockedAction(signal, DEFAULT_GUARD_SETTINGS)).toBe("slides");
    expect(shouldDisableSignal(signal, DEFAULT_GUARD_SETTINGS)).toBe(true);
  });

  it("設定で無効な Google エディタ操作は無効化対象にしない", () => {
    const root = loadFixture("office-menu.html");

    const slideItem = findActionableItems(root)[0];
    const signal = extractDriveSignal(slideItem);

    expect(
      shouldDisableSignal(signal, {
        blockSheets: true,
        blockSlides: false,
        blockDocs: true,
      }),
    ).toBe(false);
  });

  it("新しいタブで開く操作は Office ファイルであれば常時無効化対象にする", () => {
    const root = loadFixture("office-menu.html");

    const newTabItem = findActionableItems(root)[2];
    const signal = extractDriveSignal(newTabItem);

    expect(matchesBlockedAction(signal)).toBe("new-tab");
    expect(
      shouldDisableSignal(signal, {
        blockSheets: false,
        blockSlides: false,
        blockDocs: false,
      }),
    ).toBe(true);
  });

  it("メニュー近傍にファイル名がない場合は選択行から Office ファイルを補完する", () => {
    const root = loadFixture("selected-file-menu.html");

    const sheetItem = findActionableItems(root)[0];
    const signal = extractDriveSignal(sheetItem);

    expect(signal.fileName).toContain("budget.xlsx");
    expect(getOfficeFileKind(signal)).toBe("xlsx");
    expect(matchesBlockedAction(signal, DEFAULT_GUARD_SETTINGS)).toBe("sheets");
    expect(shouldDisableSignal(signal, DEFAULT_GUARD_SETTINGS)).toBe(true);
  });

  it("共有ホームの拡張子がない Office 種別表示から対象ファイルを補完する", () => {
    const root = loadFixture("shared-home-menu.html");

    const slideItem = findActionableItems(root)[0];
    const signal = extractDriveSignal(slideItem);

    expect(signal.fileName).toContain("Microsoft PowerPoint");
    expect(getOfficeFileKind(signal)).toBe("pptx");
    expect(matchesBlockedAction(signal, DEFAULT_GUARD_SETTINGS)).toBe("slides");
    expect(shouldDisableSignal(signal, DEFAULT_GUARD_SETTINGS)).toBe(true);
  });
});
