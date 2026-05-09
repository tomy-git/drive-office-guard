// SPDX-License-Identifier: MPL-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const browserMock = vi.hoisted(() => ({
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    managed: {
      get: vi.fn(),
    },
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: browserMock,
}));

describe("options", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    loadOptionsPage();
    browserMock.storage.sync.get.mockResolvedValue({
      blockSheets: true,
      blockSlides: true,
      blockDocs: true,
      hideDisabledLabel: false,
    });
    browserMock.storage.managed.get.mockResolvedValue({});
    browserMock.storage.sync.set.mockResolvedValue(undefined);
  });

  it("保存成功時はフォームの設定値を保存して成功メッセージを表示する", async () => {
    await importOptionsPageScript();

    getInput("blockSheets").checked = false;
    getInput("hideDisabledLabel").checked = true;
    submitForm();
    await flushPromises();

    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      blockSheets: false,
      blockSlides: true,
      blockDocs: true,
      hideDisabledLabel: true,
    });
    expect(getToast().dataset.kind).toBe("success");
    expect(getToastMessage().textContent).toBe("設定を保存しました");
  });

  it("保存失敗時はエラーメッセージを表示する", async () => {
    browserMock.storage.sync.set.mockRejectedValue(new Error("write failed"));
    await importOptionsPageScript();

    getInput("blockDocs").checked = false;
    submitForm();
    await flushPromises();

    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      blockSheets: true,
      blockSlides: true,
      blockDocs: false,
      hideDisabledLabel: false,
    });
    expect(getToast().dataset.kind).toBe("error");
    expect(getToastMessage().textContent).toBe("エラーが発生し設定変更に失敗しました");
  });

  it("管理ポリシーで固定された設定は保存対象から除外する", async () => {
    browserMock.storage.managed.get.mockResolvedValue({
      blockSlides: false,
    });
    await importOptionsPageScript();

    expect(getInput("blockSlides").disabled).toBe(true);

    getInput("blockSheets").checked = false;
    getInput("blockSlides").checked = true;
    submitForm();
    await flushPromises();

    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      blockSheets: false,
      blockDocs: true,
      hideDisabledLabel: false,
    });
  });
});

function loadOptionsPage(): void {
  const html = readFileSync(resolve(__dirname, "../../src/pages/options.html"), "utf8");
  document.open();
  document.write(html);
  document.close();
}

async function importOptionsPageScript(): Promise<void> {
  await import("../../src/options/options");
  await flushPromises();
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function getInput(name: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);

  if (!input) {
    throw new Error(`Missing input: ${name}`);
  }

  return input;
}

function submitForm(): void {
  const form = document.querySelector<HTMLFormElement>("#options-form");

  if (!form) {
    throw new Error("Missing options form");
  }

  form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
}

function getToast(): HTMLElement {
  const toast = document.querySelector<HTMLElement>("#options-toast");

  if (!toast) {
    throw new Error("Missing options toast");
  }

  return toast;
}

function getToastMessage(): HTMLElement {
  const message = document.querySelector<HTMLElement>("#options-toast-message");

  if (!message) {
    throw new Error("Missing options toast message");
  }

  return message;
}
