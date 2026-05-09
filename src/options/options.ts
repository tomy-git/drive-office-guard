// SPDX-License-Identifier: MPL-2.0

import {
  getConfigKeys,
  readEffectiveSettings,
  saveUserSettings,
  type ConfigKey,
  type GuardSettings,
} from "../shared/config";

const form = document.querySelector<HTMLFormElement>("#options-form");
const cancelButton = document.querySelector<HTMLButtonElement>("#cancel-button");
const toast = document.querySelector<HTMLElement>("#options-toast");
const toastMessage = document.querySelector<HTMLElement>("#options-toast-message");
const toastCloseButton =
  document.querySelector<HTMLButtonElement>("#options-toast-close");

let savedSettings: GuardSettings | null = null;
let savedManagedKeys: ConfigKey[] = [];

function getInput(key: ConfigKey): HTMLInputElement {
  const input = form?.elements.namedItem(key);

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing options input: ${key}`);
  }

  return input;
}

async function loadOptions(): Promise<void> {
  const { settings, managedKeys } = await readEffectiveSettings();
  savedSettings = settings;
  savedManagedKeys = managedKeys;

  for (const key of getConfigKeys()) {
    const input = getInput(key);
    const label = input.closest("label");
    input.checked = settings[key];
    input.disabled = managedKeys.includes(key);

    const managedNote = label?.querySelector<HTMLElement>(".managed");

    if (input.disabled) {
      if (managedNote) {
        managedNote.textContent = " 管理ポリシーにより固定されています。";
      } else {
        const nextManagedNote = document.createElement("small");
        nextManagedNote.className = "managed";
        nextManagedNote.textContent = " 管理ポリシーにより固定されています。";
        label?.querySelector("span")?.appendChild(nextManagedNote);
      }
    } else if (managedNote) {
      managedNote.textContent = "";
    }
  }

  updateDirtyState();
}

function readFormSettings(): GuardSettings {
  return {
    blockSheets: getInput("blockSheets").checked,
    blockSlides: getInput("blockSlides").checked,
    blockDocs: getInput("blockDocs").checked,
    hideDisabledLabel: getInput("hideDisabledLabel").checked,
  };
}

function updateDirtyState(): void {
  if (!savedSettings || !cancelButton) {
    return;
  }

  cancelButton.hidden = !hasUnsavedChanges();
}

function hasUnsavedChanges(): boolean {
  if (!savedSettings) {
    return false;
  }

  return getConfigKeys().some((key) => getInput(key).checked !== savedSettings?.[key]);
}

function restoreSavedSettings(): void {
  if (!savedSettings) {
    return;
  }

  for (const key of getConfigKeys()) {
    getInput(key).checked = savedSettings[key];
  }

  updateDirtyState();
}

function showToast(kind: "success" | "error", message: string): void {
  if (!toast || !toastMessage) {
    return;
  }

  toast.dataset.kind = kind;
  toastMessage.textContent = message;
  toast.hidden = false;
}

function hideToast(): void {
  if (toast) {
    toast.hidden = true;
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  void (async () => {
    try {
      await saveUserSettings(readFormSettings(), savedManagedKeys);
      await loadOptions();
      showToast("success", "設定を保存しました");
    } catch {
      showToast("error", "エラーが発生し設定変更に失敗しました");
    }
  })();
});

form?.addEventListener("change", updateDirtyState);

cancelButton?.addEventListener("click", () => {
  restoreSavedSettings();
});

toastCloseButton?.addEventListener("click", () => {
  hideToast();
});

void loadOptions();
