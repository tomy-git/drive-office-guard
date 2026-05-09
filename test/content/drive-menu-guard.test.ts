// SPDX-License-Identifier: MPL-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISABLED_SUFFIX, SPEC_CHANGE_NOTICE } from "../../src/content/drive-patterns";
import { DEFAULT_GUARD_SETTINGS } from "../../src/shared/config";

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(),
    },
    managed: {
      get: vi.fn(),
    },
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: browserMock,
}));

describe("drive-menu-guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    browserMock.runtime.sendMessage.mockResolvedValue({
      settings: DEFAULT_GUARD_SETTINGS,
    });
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("Office ファイルを Google エディタで開く既知メニューを無効化しクリックを抑止する", async () => {
    document.body.innerHTML = `
      <div role="menu" data-target-file="quarterly-plan.pptx">
        <div role="menuitem" aria-label="Google スライドで開く quarterly-plan.pptx">
          Google スライドで開く
        </div>
        <div role="menuitem" aria-label="プレビュー quarterly-plan.pptx">プレビュー</div>
      </div>
    `;

    await importGuard();
    await runScheduledGuard();

    const item = getMenuItem("Google スライドで開く");
    const preview = getMenuItem("プレビュー");
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });

    expect(item.dataset.antiGoogleOfficeDisabled).toBe("true");
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("tabindex")).toBe("-1");
    expect(item.textContent).toContain(DISABLED_SUFFIX);
    expect(preview.dataset.antiGoogleOfficeDisabled).toBeUndefined();

    expect(item.dispatchEvent(clickEvent)).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it("設定で無効なサービスのメニューは無効化しない", async () => {
    browserMock.runtime.sendMessage.mockResolvedValue({
      settings: {
        ...DEFAULT_GUARD_SETTINGS,
        blockSlides: false,
      },
    });
    document.body.innerHTML = `
      <div role="menu" data-target-file="quarterly-plan.pptx">
        <div role="menuitem" aria-label="Google スライドで開く quarterly-plan.pptx">
          Google スライドで開く
        </div>
      </div>
    `;

    await importGuard();
    await runScheduledGuard();

    expect(getMenuItem("Google スライドで開く").dataset.antiGoogleOfficeDisabled).toBe(
      undefined,
    );
  });

  it("仕様変更リスクを検知した場合は無効化せず通知を表示する", async () => {
    document.body.innerHTML = `
      <div role="menu" data-target-file="budget.xlsx">
        <a
          role="menuitem"
          href="https://docs.google.com/sheets/d/example"
          aria-label="Google スプレッドシートで開く budget.xlsx"
        >
          Google スプレッドシートで開く
        </a>
      </div>
    `;

    await importGuard();
    await runScheduledGuard();

    expect(getMenuItem("Google スプレッドシートで開く").dataset).not.toHaveProperty(
      "antiGoogleOfficeDisabled",
    );
    expect(document.body.dataset.antiGoogleOfficeNotice).toBe("true");
    expect(document.body.textContent).toContain(SPEC_CHANGE_NOTICE);
  });
});

async function importGuard(): Promise<void> {
  await import("../../src/content/drive-menu-guard");
}

async function runScheduledGuard(): Promise<void> {
  await vi.runOnlyPendingTimersAsync();
  await Promise.resolve();
  await Promise.resolve();
}

function getMenuItem(text: string): HTMLElement {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((element) => element.textContent?.includes(text));

  if (!item) {
    throw new Error(`Missing menu item: ${text}`);
  }

  return item;
}
