import { describe, expect, it } from "vitest";

import {
  discoverTsutatsuIndexPages,
  extractTsutatsuLinks,
} from "../../../../src/crawler/tsutatsu/discovery.js";

describe("discoverTsutatsuIndexPages", () => {
  it("returns tsutatsu category index URLs from the menu page", async () => {
    const urls = await discoverTsutatsuIndexPages({
      html: `
        <ul>
          <li><a href="/law/tsutatsu/kihon/shotoku/01.htm">所得税法</a></li>
          <li><a href="/law/tsutatsu/kihon/hojin/01.htm">法人税法</a></li>
          <li><a href="/law/tsutatsu/kihon/shohi/01.htm">消費税法</a></li>
          <li><a href="/law/tsutatsu/kihon/shotoku/01.htm#page-top">所得税法</a></li>
          <li><a href="/law/shitsugi/01.htm">質疑応答事例</a></li>
        </ul>
      `,
      baseUrl: "https://www.nta.go.jp/law/tsutatsu/menu.htm",
    });

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm",
      "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/01.htm",
      "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm",
    ]);
  });
});

describe("extractTsutatsuLinks", () => {
  it("extracts document pages from a category index page and strips fragments", () => {
    const urls = extractTsutatsuLinks(
      `
        <p><a href="/law/tsutatsu/kihon/shotoku/01/01.htm">〔居住者、非永住者及び非居住者〕</a></p>
        <p><a href="/law/tsutatsu/kihon/shotoku/01/03.htm#a-01">〔公社債〕</a></p>
        <p><a href="/law/tsutatsu/kihon/shotoku/00/01.htm">前文・説明文</a></p>
        <p><a href="/law/tsutatsu/kihon/shotoku/01.htm">章一覧</a></p>
      `,
      "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm",
    );

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/00/01.htm",
      "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm",
      "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/03.htm",
    ]);
  });
});
