import {
  getConfigKeys,
  readEffectiveSettings,
  saveUserSettings,
  type ConfigKey,
  type GuardSettings,
} from "../shared/config";

const form = document.querySelector<HTMLFormElement>("#options-form");
const statusElement = document.querySelector<HTMLElement>("#options-status");

function getInput(key: ConfigKey): HTMLInputElement {
  const input = form?.elements.namedItem(key);

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing options input: ${key}`);
  }

  return input;
}

async function loadOptions(): Promise<void> {
  const { settings, managedKeys } = await readEffectiveSettings();

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
}

function readFormSettings(): GuardSettings {
  return getConfigKeys().reduce<GuardSettings>((settings, key) => {
    settings[key] = getInput(key).checked;
    return settings;
  }, {} as GuardSettings);
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  void (async () => {
    const { managedKeys } = await readEffectiveSettings();
    await saveUserSettings(readFormSettings(), managedKeys);
    await loadOptions();

    if (statusElement) {
      statusElement.textContent = "設定を保存しました。";
    }
  })();
});

void loadOptions();
