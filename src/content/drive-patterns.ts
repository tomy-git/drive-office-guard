import type { GuardSettings } from "../shared/config";

export type OfficeFileKind = "xlsx" | "pptx" | "docx";
export type BlockedActionKind = "sheets" | "slides" | "docs" | "new-tab";
export type SpecChangeRiskKind =
  | "too-many-menu-candidates"
  | "blocked-action-link-changed"
  | "blocked-action-label-changed"
  | "new-tab-link-changed";

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
  xls: "xlsx",
  pptx: "pptx",
  pptm: "pptx",
  ppt: "pptx",
  docx: "docx",
  docm: "docx",
  doc: "docx",
};

const OFFICE_KIND_PATTERNS: Record<OfficeFileKind, RegExp[]> = {
  xlsx: [
    /\.xls[xm]?\b/i,
    /microsoft\s+excel/i,
    /excel\s+(spreadsheet|workbook)/i,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    /application\/vnd\.ms-excel/i,
  ],
  pptx: [
    /\.ppt[xm]?\b/i,
    /microsoft\s+power\s*point/i,
    /microsoft\s+powerpoint/i,
    /power\s*point\s+presentation/i,
    /powerpoint\s+presentation/i,
    /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/i,
    /application\/vnd\.ms-powerpoint/i,
  ],
  docx: [
    /\.doc[xm]?\b/i,
    /microsoft\s+word/i,
    /word\s+document/i,
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i,
    /application\/msword/i,
  ],
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
const ACTION_PATH_PREFIX: Partial<Record<BlockedActionKind, string>> = {
  sheets: "/spreadsheets/",
  slides: "/presentation/",
  docs: "/document/",
};

const MENU_ROLES = new Set(["menuitem", "option", "button"]);
const OFFICE_FILE_KINDS = ["xlsx", "pptx", "docx"] as const;
const BLOCKED_ACTION_KINDS = ["sheets", "slides", "docs", "new-tab"] as const;
const GOOGLE_OFFICE_ACTION_HINT_PATTERN =
  /google\s*(ドキュメント|スプレッドシート|スライド|プレゼンテーション|docs|sheets|slides)\s*(で|を|開く|表示|open)?|(?:開く|表示|open).{0,24}google\s*(ドキュメント|スプレッドシート|スライド|プレゼンテーション|docs|sheets|slides)/i;
const GOOGLE_OPEN_WITH_DATA_PATTERN = /open-with-google|google-(docs|sheets|slides)/i;
const ACTION_DATA_ATTRIBUTE_NAME_PATTERN = /^data-.*(?:action|command).*$/i;

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

  if (match) {
    const extensionKind = OFFICE_EXTENSION_KIND[match[1].toLowerCase()];

    if (extensionKind) {
      return extensionKind;
    }
  }

  for (const kind of OFFICE_FILE_KINDS) {
    const patterns = OFFICE_KIND_PATTERNS[kind];

    if (patterns.some((pattern) => pattern.test(text))) {
      return kind;
    }
  }

  return null;
}

export function matchesBlockedAction(
  signal: DriveDomSignal,
  settings?: GuardSettings,
): BlockedActionKind | null {
  const text = getSignalText(signal);

  for (const action of BLOCKED_ACTION_KINDS) {
    const patterns = BLOCKED_ACTION_PATTERNS[action];
    const settingKey = ACTION_SETTING_KEY[action];

    if (settingKey && settings && !settings[settingKey]) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(text))) {
      return action;
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

export function getSpecChangeRisk(
  signal: DriveDomSignal,
): Exclude<SpecChangeRiskKind, "too-many-menu-candidates"> | null {
  const action = matchesBlockedAction(signal);
  const officeFileKind = getOfficeFileKind(signal);
  const parsedHref = parseSignalHref(signal.href);

  if (
    action === "new-tab" &&
    parsedHref &&
    parsedHref.hostname !== "drive.google.com"
  ) {
    return "new-tab-link-changed";
  }

  const expectedPathPrefix = action ? ACTION_PATH_PREFIX[action] : undefined;

  if (
    expectedPathPrefix &&
    parsedHref?.hostname === "docs.google.com" &&
    !parsedHref.pathname.startsWith(expectedPathPrefix)
  ) {
    return "blocked-action-link-changed";
  }

  if (
    officeFileKind !== null &&
    signal.role &&
    MENU_ROLES.has(signal.role.toLowerCase()) &&
    action === null &&
    hasGoogleOfficeActionHint(signal)
  ) {
    return "blocked-action-label-changed";
  }

  return null;
}

function parseSignalHref(href: string | undefined): URL | null {
  if (!href) {
    return null;
  }

  try {
    return new URL(href);
  } catch {
    return null;
  }
}

function hasGoogleOfficeActionHint(signal: DriveDomSignal): boolean {
  const actionText = [signal.text, signal.ariaLabel, signal.title]
    .filter(Boolean)
    .join(" ");

  return (
    GOOGLE_OFFICE_ACTION_HINT_PATTERN.test(actionText) ||
    Object.entries(signal.dataAttributes).some(
      ([name, value]) =>
        ACTION_DATA_ATTRIBUTE_NAME_PATTERN.test(name) &&
        GOOGLE_OPEN_WITH_DATA_PATTERN.test(value),
    )
  );
}
