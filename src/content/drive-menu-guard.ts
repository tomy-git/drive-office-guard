import browser from "webextension-polyfill";

import {
  DEFAULT_GUARD_SETTINGS,
  readEffectiveSettings,
  type GuardSettings,
} from "../shared/config";
import {
  extractDriveSignal,
  findActionableItems,
  hasSpecChangeRisk,
} from "./drive-dom-adapter";
import {
  DISABLED_SUFFIX,
  SPEC_CHANGE_NOTICE,
  shouldDisableSignal,
} from "./drive-patterns";

type SettingsResponse = {
  settings?: GuardSettings;
};

const DISABLED_DATA_KEY = "antiGoogleOfficeDisabled";
const NOTICE_DATA_KEY = "antiGoogleOfficeNotice";
const PREVIOUS_ARIA_DISABLED_KEY = "antiGoogleOfficePreviousAriaDisabled";
const PREVIOUS_TABINDEX_KEY = "antiGoogleOfficePreviousTabindex";
const PREVIOUS_OPACITY_KEY = "antiGoogleOfficePreviousOpacity";
const PREVIOUS_BACKGROUND_KEY = "antiGoogleOfficePreviousBackground";
const PREVIOUS_CURSOR_KEY = "antiGoogleOfficePreviousCursor";
const DEBOUNCE_MS = 100;

let cachedSettings: GuardSettings = DEFAULT_GUARD_SETTINGS;
let debounceTimer: number | undefined;
let observer: MutationObserver | undefined;

async function readSettings(): Promise<GuardSettings> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: "get-settings",
    })) as SettingsResponse;

    if (response?.settings) {
      return response.settings;
    }
  } catch {
    // Content script can still protect with safe defaults if background is waking.
  }

  try {
    return (await readEffectiveSettings()).settings;
  } catch {
    return DEFAULT_GUARD_SETTINGS;
  }
}

async function applyGuard(): Promise<void> {
  cachedSettings = await readSettings();

  if (hasSpecChangeRisk()) {
    stopObserver();
    notifySpecChange();
    return;
  }

  for (const element of findActionableItems()) {
    restoreMenuItem(element);

    const signal = extractDriveSignal(element);

    if (shouldDisableSignal(signal, cachedSettings)) {
      disableMenuItem(element);
    }
  }
}

function scheduleApplyGuard(): void {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    void applyGuard();
  }, DEBOUNCE_MS);
}

function disableMenuItem(element: HTMLElement): void {
  if (element.dataset[DISABLED_DATA_KEY] === "true") {
    return;
  }

  rememberPreviousState(element);
  element.dataset[DISABLED_DATA_KEY] = "true";
  element.setAttribute("aria-disabled", "true");
  element.setAttribute("tabindex", "-1");
  element.style.opacity = "0.45";
  element.style.backgroundColor = "rgba(0, 0, 0, 0.06)";
  element.style.cursor = "not-allowed";

  const suffix = document.createElement("span");
  suffix.textContent = DISABLED_SUFFIX;
  suffix.className = "anti-google-office-disabled-label";
  suffix.style.marginLeft = "8px";
  suffix.style.fontSize = "0.85em";
  suffix.style.fontWeight = "400";
  element.appendChild(suffix);

  element.addEventListener("click", stopBlockedEvent, true);
  element.addEventListener("keydown", stopBlockedEvent, true);
}

function restoreMenuItem(element: HTMLElement): void {
  if (element.dataset[DISABLED_DATA_KEY] !== "true") {
    return;
  }

  restoreAttribute(element, "aria-disabled", PREVIOUS_ARIA_DISABLED_KEY);
  restoreAttribute(element, "tabindex", PREVIOUS_TABINDEX_KEY);
  element.style.opacity = element.dataset[PREVIOUS_OPACITY_KEY] ?? "";
  element.style.backgroundColor = element.dataset[PREVIOUS_BACKGROUND_KEY] ?? "";
  element.style.cursor = element.dataset[PREVIOUS_CURSOR_KEY] ?? "";
  element
    .querySelectorAll(":scope > .anti-google-office-disabled-label")
    .forEach((suffix) => suffix.remove());
  element.removeEventListener("click", stopBlockedEvent, true);
  element.removeEventListener("keydown", stopBlockedEvent, true);
  delete element.dataset[DISABLED_DATA_KEY];
  delete element.dataset[PREVIOUS_ARIA_DISABLED_KEY];
  delete element.dataset[PREVIOUS_TABINDEX_KEY];
  delete element.dataset[PREVIOUS_OPACITY_KEY];
  delete element.dataset[PREVIOUS_BACKGROUND_KEY];
  delete element.dataset[PREVIOUS_CURSOR_KEY];
}

function rememberPreviousState(element: HTMLElement): void {
  rememberAttribute(element, "aria-disabled", PREVIOUS_ARIA_DISABLED_KEY);
  rememberAttribute(element, "tabindex", PREVIOUS_TABINDEX_KEY);
  element.dataset[PREVIOUS_OPACITY_KEY] = element.style.opacity;
  element.dataset[PREVIOUS_BACKGROUND_KEY] = element.style.backgroundColor;
  element.dataset[PREVIOUS_CURSOR_KEY] = element.style.cursor;
}

function rememberAttribute(
  element: HTMLElement,
  attributeName: string,
  datasetKey: string,
): void {
  element.dataset[datasetKey] = element.getAttribute(attributeName) ?? "";
}

function restoreAttribute(
  element: HTMLElement,
  attributeName: string,
  datasetKey: string,
): void {
  const previousValue = element.dataset[datasetKey];

  if (previousValue) {
    element.setAttribute(attributeName, previousValue);
    return;
  }

  element.removeAttribute(attributeName);
}

function stopBlockedEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function notifySpecChange(): void {
  if (document.body.dataset[NOTICE_DATA_KEY] === "true") {
    return;
  }

  document.body.dataset[NOTICE_DATA_KEY] = "true";

  const notice = document.createElement("div");
  notice.textContent = SPEC_CHANGE_NOTICE;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.style.position = "fixed";
  notice.style.insetBlockStart = "16px";
  notice.style.insetInlineEnd = "16px";
  notice.style.zIndex = "2147483647";
  notice.style.maxWidth = "360px";
  notice.style.padding = "12px 14px";
  notice.style.border = "1px solid #d0d5dd";
  notice.style.borderRadius = "6px";
  notice.style.background = "#ffffff";
  notice.style.color = "#1f2937";
  notice.style.boxShadow = "0 6px 18px rgba(15, 23, 42, 0.18)";
  document.body.appendChild(notice);
}

function stopObserver(): void {
  observer?.disconnect();
  observer = undefined;
}

export function initializeGuard(): void {
  if (!document.body || observer) {
    return;
  }

  observer = new MutationObserver(scheduleApplyGuard);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scheduleApplyGuard();
}

if (document.body) {
  initializeGuard();
} else {
  document.addEventListener("DOMContentLoaded", initializeGuard, { once: true });
}
