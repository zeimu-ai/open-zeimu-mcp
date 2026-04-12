import { describe, expect, it } from "vitest";

import {
  discoverSaiketsuIndexPages,
  extractSaiketsuDocumentLinks,
} from "../../../../src/crawler/saiketsu/discovery.js";

describe("discoverSaiketsuIndexPages", () => {
  it("returns section page URLs from the MP root page", () => {
    const urls = discoverSaiketsuIndexPages({
      html: `
        <ul>
          <li><a href="0101000000.html">納付義務の承継</a></li>
          <li><a href="0201000000.html">納税申告</a></li>
          <li><a href="/service/MP/02/ignored.html">無関係</a></li>
        </ul>
      `,
      baseUrl: "https://www.kfs.go.jp/service/MP/01/index.html",
    });

    expect(urls).toEqual([
      "https://www.kfs.go.jp/service/MP/01/0101000000.html",
      "https://www.kfs.go.jp/service/MP/01/0201000000.html",
    ]);
  });
});

describe("extractSaiketsuDocumentLinks", () => {
  it("returns document links and citations from a section page", () => {
    const documents = extractSaiketsuDocumentLinks({
      html: `
        <div>
          <p class="article_point">▼ <a href="../../JP/55/01/index.html">裁決事例集 No.55 - 1頁</a></p>
          <p class="article_point">▼ <a href="../../JP/119/01/index.html">令和2年4月17日裁決</a></p>
        </div>
      `,
      baseUrl: "https://www.kfs.go.jp/service/MP/01/0101000000.html",
      category: "総則",
      categoryCode: "01",
    });

    expect(documents).toEqual([
      {
        url: "https://www.kfs.go.jp/service/JP/55/01/index.html",
        citation: "裁決事例集 No.55 - 1頁",
        category: "総則",
        categoryCode: "01",
      },
      {
        url: "https://www.kfs.go.jp/service/JP/119/01/index.html",
        citation: "令和2年4月17日裁決",
        category: "総則",
        categoryCode: "01",
      },
    ]);
  });

  it("returns article_point links even when the marker glyph is omitted", () => {
    const documents = extractSaiketsuDocumentLinks({
      html: `
        <div class="article">
          <p class="article_point"><a href="../../JP/103/01/index.html">平成28年5月20日裁決</a></p>
          <p>《ポイント》課税処分は違法な調査に基づいていない。</p>
        </div>
      `,
      baseUrl: "https://www.kfs.go.jp/service/MP/01/0203020000.html",
      category: "更正又は決定",
      categoryCode: "02",
    });

    expect(documents).toEqual([
      {
        url: "https://www.kfs.go.jp/service/JP/103/01/index.html",
        citation: "平成28年5月20日裁決",
        category: "更正又は決定",
        categoryCode: "02",
      },
    ]);
  });
});
