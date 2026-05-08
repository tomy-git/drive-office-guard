import { describe, expect, it } from "vitest";

import { DNR_RULE_IDS, buildDnrRules, isBlockedUrl } from "../../src/shared/dnr-rules";

describe("dnr-rules", () => {
  it("Phase1 の dynamic rule id 1001/1002/1003 を固定で使う", () => {
    expect(DNR_RULE_IDS).toEqual([1001, 1002, 1003]);
  });

  it("設定で有効なサービスだけ DNR redirect ルールを生成する", () => {
    const rules = buildDnrRules({
      blockSheets: true,
      blockSlides: false,
      blockDocs: true,
    });

    expect(rules.map((rule) => rule.id)).toEqual([1001, 1003]);
    expect(rules[0]).toMatchObject({
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked.html" },
      },
      condition: {
        urlFilter: "||docs.google.com/spreadsheets/",
        resourceTypes: ["main_frame"],
      },
    });
  });

  it("docs.google.com の対象 path のみをブロック判定する", () => {
    const settings = {
      blockSheets: true,
      blockSlides: false,
      blockDocs: true,
    };

    expect(
      isBlockedUrl("https://docs.google.com/spreadsheets/d/example", settings),
    ).toBe(true);
    expect(
      isBlockedUrl("https://docs.google.com/presentation/d/example", settings),
    ).toBe(false);
    expect(isBlockedUrl("https://drive.google.com/file/d/example", settings)).toBe(
      false,
    );
  });
});
