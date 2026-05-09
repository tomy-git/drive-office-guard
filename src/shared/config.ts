import browser from "webextension-polyfill";

export type ConfigKey =
  | "blockSheets"
  | "blockSlides"
  | "blockDocs"
  | "hideDisabledLabel";

export type GuardSettings = Record<ConfigKey, boolean>;

export type ManagedConfigState = {
  settings: GuardSettings;
  managedKeys: ConfigKey[];
};

export const DEFAULT_GUARD_SETTINGS: GuardSettings = {
  blockSheets: true,
  blockSlides: true,
  blockDocs: true,
  hideDisabledLabel: false,
};

const CONFIG_KEYS = [
  "blockSheets",
  "blockSlides",
  "blockDocs",
  "hideDisabledLabel",
] as const satisfies readonly ConfigKey[];

type RawConfig = Partial<Record<ConfigKey, unknown>>;

export function isConfigKey(key: string): key is ConfigKey {
  return CONFIG_KEYS.some((configKey) => configKey === key);
}

export function getConfigKeys(): ConfigKey[] {
  return [...CONFIG_KEYS];
}

export function normalizeSettings(raw: RawConfig): Partial<GuardSettings> {
  return CONFIG_KEYS.reduce<Partial<GuardSettings>>((settings, key) => {
    const value = raw[key];

    if (typeof value === "boolean") {
      settings[key] = value;
    }

    return settings;
  }, {});
}

export function isGuardSettings(value: unknown): value is GuardSettings {
  const settings = normalizeSettings(
    typeof value === "object" && value !== null ? value : {},
  );

  return CONFIG_KEYS.every((key) => typeof settings[key] === "boolean");
}

export function mergeSettings(
  syncSettings: Partial<GuardSettings>,
  managedSettings: Partial<GuardSettings>,
): ManagedConfigState {
  const settings = { ...DEFAULT_GUARD_SETTINGS, ...syncSettings };
  const managedKeys: ConfigKey[] = [];

  for (const key of CONFIG_KEYS) {
    if (typeof managedSettings[key] === "boolean") {
      settings[key] = managedSettings[key];
      managedKeys.push(key);
    }
  }

  return { settings, managedKeys };
}

export async function readEffectiveSettings(): Promise<ManagedConfigState> {
  const syncRaw = await browser.storage.sync.get(getConfigKeys());
  const managedRaw = await readManagedSettings();

  return mergeSettings(normalizeSettings(syncRaw), normalizeSettings(managedRaw));
}

export async function saveUserSettings(
  nextSettings: Partial<GuardSettings>,
  managedKeys: ConfigKey[] = [],
): Promise<void> {
  const writableSettings = normalizeSettings(nextSettings);

  for (const key of managedKeys) {
    delete writableSettings[key];
  }

  await browser.storage.sync.set(writableSettings);
}

async function readManagedSettings(): Promise<RawConfig> {
  try {
    return await browser.storage.managed.get(getConfigKeys());
  } catch {
    return {};
  }
}
