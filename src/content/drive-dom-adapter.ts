import {
  type DriveDomSignal,
  MAX_MENU_CANDIDATES,
  getSpecChangeRisk,
  getOfficeFileKind,
  getMenuItemConfidence,
} from "./drive-patterns";

const MENU_CANDIDATE_SELECTOR = [
  '[role="menuitem"]',
  '[role="option"]',
  '[role="button"]',
  "a[href]",
].join(",");

const FILE_CONTEXT_SELECTOR = [
  '[aria-selected="true"]',
  '[aria-current="true"]',
  '[data-is-selected="true"]',
  '[data-selected="true"]',
  '[data-selection-target="true"]',
  "[data-target-file]",
  "[data-file-name]",
  "[data-tooltip*='Microsoft']",
  "[data-tooltip*='PowerPoint']",
  "[data-tooltip*='Excel']",
  "[data-tooltip*='Word']",
  '[aria-label*="."]',
  '[aria-label*="Microsoft"]',
  '[aria-label*="PowerPoint"]',
  '[aria-label*="Excel"]',
  '[aria-label*="Word"]',
  '[title*="."]',
  '[title*="Microsoft"]',
  '[title*="PowerPoint"]',
  '[title*="Excel"]',
  '[title*="Word"]',
].join(",");

export function getMenuCandidates(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(MENU_CANDIDATE_SELECTOR));
}

export function extractDriveSignal(element: HTMLElement): DriveDomSignal {
  return {
    role: element.getAttribute("role") ?? undefined,
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    text: element.innerText || element.textContent || undefined,
    title: element.getAttribute("title") ?? undefined,
    href: getHref(element),
    fileName: findTargetFileName(element),
    dataAttributes: getDataAttributes(element),
  };
}

export function findActionableItems(root: ParentNode = document): HTMLElement[] {
  return getMenuCandidates(root).filter((element) => {
    const signal = extractDriveSignal(element);

    return getMenuItemConfidence(signal) > 0;
  });
}

export function hasSpecChangeRisk(root: ParentNode = document): boolean {
  const candidates = getMenuCandidates(root);

  return (
    candidates.length > MAX_MENU_CANDIDATES ||
    candidates.some(
      (element) => getSpecChangeRisk(extractDriveSignal(element)) !== null,
    )
  );
}

function getHref(element: HTMLElement): string | undefined {
  if (element instanceof HTMLAnchorElement) {
    return element.href;
  }

  const anchor = element.closest("a[href]");

  return anchor instanceof HTMLAnchorElement ? anchor.href : undefined;
}

function findTargetFileName(element: HTMLElement): string | undefined {
  return findNearbyFileName(element) ?? findDocumentSelectedFileName(element);
}

function findNearbyFileName(element: HTMLElement): string | undefined {
  const labelledBy = element.getAttribute("aria-labelledby");
  const ownerDocument = element.ownerDocument;

  if (labelledBy) {
    const labelledText = labelledBy
      .split(/\s+/)
      .map((id) => ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");

    if (labelledText) {
      return labelledText;
    }
  }

  const container = element.closest<HTMLElement>(
    '[data-target-file], [data-file-name], [aria-label*="."], [title*="."]',
  );

  if (!container) {
    return undefined;
  }

  return (
    container.dataset.targetFile ??
    container.dataset.fileName ??
    container.getAttribute("aria-label") ??
    container.getAttribute("title") ??
    undefined
  );
}

function findDocumentSelectedFileName(element: HTMLElement): string | undefined {
  const candidates = Array.from(
    element.ownerDocument.querySelectorAll<HTMLElement>(FILE_CONTEXT_SELECTOR),
  );

  for (const candidate of candidates) {
    const signal = {
      role: candidate.getAttribute("role") ?? undefined,
      ariaLabel: candidate.getAttribute("aria-label") ?? undefined,
      text: candidate.innerText || candidate.textContent || undefined,
      title: candidate.getAttribute("title") ?? undefined,
      href: getHref(candidate),
      fileName:
        candidate.dataset.targetFile ??
        candidate.dataset.fileName ??
        candidate.dataset.tooltip ??
        candidate.getAttribute("aria-label") ??
        candidate.getAttribute("title") ??
        undefined,
      dataAttributes: getDataAttributes(candidate),
    };

    if (getOfficeFileKind(signal) !== null) {
      return signal.fileName ?? signal.text ?? signal.ariaLabel ?? signal.title;
    }
  }

  return undefined;
}

function getDataAttributes(element: HTMLElement): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const { name, value } of Array.from(element.attributes)) {
    if (name.startsWith("data-")) {
      attributes[name] = value;
    }
  }

  return attributes;
}
