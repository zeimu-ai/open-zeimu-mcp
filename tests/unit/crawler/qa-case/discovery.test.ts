import { describe, expect, it } from "vitest";

import {
  discoverQaCaseIndexPages,
  extractQaCaseLinks,
} from "../../../../src/crawler/qa-case/discovery.js";

describe("discoverQaCaseIndexPages", () => {
  it("returns tax category index URLs from the root page", async () => {
    const urls = await discoverQaCaseIndexPages({
      html: `
        <ul>
          <li><a href="/law/shitsugi/shotoku/01.htm">所得税</a></li>
          <li><a href="/law/shitsugi/hojin/01.htm">法人税</a></li>
          <li><a href="/law/shitsugi/shohi/01.htm">消費税</a></li>
          <li><a href="/taxes/sake/qa/01.htm">酒税</a></li>
        </ul>
      `,
      baseUrl: "https://www.nta.go.jp/law/shitsugi/01.htm",
    });

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/shitsugi/hojin/01.htm",
      "https://www.nta.go.jp/law/shitsugi/shohi/01.htm",
      "https://www.nta.go.jp/law/shitsugi/shotoku/01.htm",
    ]);
  });
});

describe("extractQaCaseLinks", () => {
  it("extracts individual case links from category pages", () => {
    const urls = extractQaCaseLinks(
      `
        <p><a href="/law/shitsugi/shohi/02/01.htm">会社員が行う建物の貸付けの取扱い</a></p>
        <p><a href="/law/shitsugi/shohi/02/42.htm">会社員が自宅に設置した太陽光発電設備による余剰電力の売却</a></p>
        <p><a href="/law/bunshokaito/shohi/09_1.htm#a-01">文書回答事例</a></p>
      `,
      "https://www.nta.go.jp/law/shitsugi/shohi/01.htm",
    );

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/shitsugi/shohi/02/01.htm",
      "https://www.nta.go.jp/law/shitsugi/shohi/02/42.htm",
    ]);
  });
});
