// SPDX-License-Identifier: MPL-2.0

import type browser from "webextension-polyfill";

import type { GuardSettings } from "./config";

export type OfficeService = "sheets" | "slides" | "docs";

export const RULE_ID_SHEETS = 1001;
export const RULE_ID_SLIDES = 1002;
export const RULE_ID_DOCS = 1003;
export const DNR_RULE_IDS = [RULE_ID_SHEETS, RULE_ID_SLIDES, RULE_ID_DOCS];

type DnrRuleTemplate = {
  id: number;
  service: OfficeService;
  pathPrefix: string;
  configKey: keyof GuardSettings;
};

export const DNR_RULE_TEMPLATES: readonly DnrRuleTemplate[] = [
  {
    id: RULE_ID_SHEETS,
    service: "sheets",
    pathPrefix: "/spreadsheets/",
    configKey: "blockSheets",
  },
  {
    id: RULE_ID_SLIDES,
    service: "slides",
    pathPrefix: "/presentation/",
    configKey: "blockSlides",
  },
  {
    id: RULE_ID_DOCS,
    service: "docs",
    pathPrefix: "/document/",
    configKey: "blockDocs",
  },
] as const;

export function buildDnrRules(
  settings: GuardSettings,
): browser.DeclarativeNetRequest.Rule[] {
  return DNR_RULE_TEMPLATES.filter((template) => settings[template.configKey]).map(
    (template) => ({
      id: template.id,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: "/blocked.html",
        },
      },
      condition: {
        urlFilter: `||docs.google.com${template.pathPrefix}`,
        resourceTypes: ["main_frame"],
      },
    }),
  );
}

export function getBlockedPaths(settings: GuardSettings): string[] {
  return DNR_RULE_TEMPLATES.filter((template) => settings[template.configKey]).map(
    (template) => template.pathPrefix,
  );
}

export function isBlockedUrl(url: string, settings: GuardSettings): boolean {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  return (
    parsedUrl.hostname === "docs.google.com" &&
    getBlockedPaths(settings).some((path) => parsedUrl.pathname.startsWith(path))
  );
}
