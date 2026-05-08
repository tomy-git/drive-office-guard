import { DEFAULT_GUARD_SETTINGS, readEffectiveSettings } from "../shared/config";

const serviceLabels = [
  {
    key: "blockSheets",
    label: "Google スプレッドシート",
  },
  {
    key: "blockSlides",
    label: "Google スライド",
  },
  {
    key: "blockDocs",
    label: "Google ドキュメント",
  },
] as const;

async function renderBlockedServices(): Promise<void> {
  const list = document.querySelector<HTMLUListElement>("#blocked-services");

  if (!list) {
    return;
  }

  const settings = await readSettings();
  const blockedServices = serviceLabels.filter((service) => settings[service.key]);

  list.replaceChildren();

  if (blockedServices.length === 0) {
    const item = document.createElement("li");
    item.textContent =
      "現在制限されている Google Docs / Sheets / Slides はありません。";
    list.appendChild(item);
    return;
  }

  for (const service of blockedServices) {
    const item = document.createElement("li");
    item.textContent = service.label;
    list.appendChild(item);
  }
}

async function readSettings() {
  try {
    return (await readEffectiveSettings()).settings;
  } catch {
    return DEFAULT_GUARD_SETTINGS;
  }
}

void renderBlockedServices();
