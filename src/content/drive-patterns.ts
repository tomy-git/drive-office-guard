import type { GuardSettings } from "../shared/config";

export type OfficeFileKind = "xlsx" | "pptx" | "docx";
export type BlockedActionKind = "sheets" | "slides" | "docs" | "new-tab";

export type DriveDomSignal = {
  role?: string;
  ariaLabel?: string;
  text?: string;
  title?: string;
  href?: string;
  fileName?: string;
  dataAttributes: Record<string, string>;
};

export const DISABLED_SUFFIX = "（拡張機能により無効化）";
export const SPEC_CHANGE_NOTICE =
  "Googleドライブの仕様変更を検知したため、ボタンの無効化は行われません";

export const MIN_MENU_CONFIDENCE = 2;
export const MAX_MENU_CANDIDATES = 200;

const OFFICE_EXTENSION_KIND: Record<string, OfficeFileKind> = {
  xlsx: "xlsx",
  xlsm: "xlsx",
  pptx: "pptx",
  pptm: "pptx",
  docx: "docx",
  docm: "docx",
};

const BLOCKED_ACTION_PATTERNS: Record<BlockedActionKind, RegExp[]> = {
  sheets: [/google\s*スプレッドシート/i, /google\s*sheets/i],
  slides: [/google\s*スライド/i, /google\s*slides/i],
  docs: [/google\s*ドキュメント/i, /google\s*docs/i],
  "new-tab": [/新しいタブで開く/i, /open\s+in\s+new\s+tab/i],
};

const ACTION_SETTING_KEY: Partial<Record<BlockedActionKind, keyof GuardSettings>> = {
  sheets: "blockSheets",
  slides: "blockSlides",
  docs: "blockDocs",
};

const MENU_ROLES = new Set(["menuitem", "option", "button"]);

export function getSignalText(signal: DriveDomSignal): string {
  return [
    signal.text,
    signal.ariaLabel,
    signal.title,
    signal.href,
    signal.fileName,
    ...Object.values(signal.dataAttributes),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getMenuItemConfidence(signal: DriveDomSignal): number {
  let confidence = 0;

  if (signal.role && MENU_ROLES.has(signal.role.toLowerCase())) {
    confidence += 1;
  }

  if (matchesBlockedAction(signal) !== null) {
    confidence += 1;
  }

  if (getOfficeFileKind(signal) !== null) {
    confidence += 1;
  }

  return confidence;
}

export function getOfficeFileKind(signal: DriveDomSignal): OfficeFileKind | null {
  const text = getSignalText(signal);
  const match = text.match(/\.([a-z0-9]{3,4})(?:\b|$)/i);

  if (!match) {
    return null;
  }

  return OFFICE_EXTENSION_KIND[match[1].toLowerCase()] ?? null;
}

export function matchesBlockedAction(
  signal: DriveDomSignal,
  settings?: GuardSettings,
): BlockedActionKind | null {
  const text = getSignalText(signal);

  for (const [action, patterns] of Object.entries(BLOCKED_ACTION_PATTERNS)) {
    const blockedAction = action as BlockedActionKind;
    const settingKey = ACTION_SETTING_KEY[blockedAction];

    if (settingKey && settings && !settings[settingKey]) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(text))) {
      return blockedAction;
    }
  }

  return null;
}

export function shouldDisableSignal(
  signal: DriveDomSignal,
  settings: GuardSettings,
): boolean {
  return (
    getOfficeFileKind(signal) !== null &&
    getMenuItemConfidence(signal) >= MIN_MENU_CONFIDENCE &&
    matchesBlockedAction(signal, settings) !== null
  );
}
