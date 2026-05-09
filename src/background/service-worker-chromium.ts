// SPDX-License-Identifier: MPL-2.0

import browser from "webextension-polyfill";

import { readEffectiveSettings } from "../shared/config";
import { buildDnrRules, DNR_RULE_IDS } from "../shared/dnr-rules";

type RuntimeMessage = {
  type?: string;
};

function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return typeof message === "object" && message !== null;
}

async function syncDnrRules(): Promise<void> {
  const { settings } = await readEffectiveSettings();

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [...DNR_RULE_IDS],
    addRules: buildDnrRules(settings),
  });
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isRuntimeMessage(message) && message.type === "get-settings") {
    return readEffectiveSettings();
  }

  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  void syncDnrRules();
});

browser.runtime.onStartup.addListener(() => {
  void syncDnrRules();
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" || areaName === "managed") {
    void syncDnrRules();
  }
});

void syncDnrRules();
