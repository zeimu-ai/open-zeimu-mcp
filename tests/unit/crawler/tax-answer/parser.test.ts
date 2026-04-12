import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseTaxAnswerHtml } from "../../../../src/crawler/tax-answer/parser.js";

const fixturesDir = fileURLToPath(new URL("../../../fixtures/crawler/tax-answer/html", import.meta.url));

describe("parseTaxAnswerHtml", () => {
  it("parses tax answer HTML into markdown, frontmatter metadata, aliases, and headings", async () => {
    const html = await readFile(`${fixturesDir}/1200.html`, "utf8");

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.document).toMatchObject({
      id: "1200",
      title: "税額控除",
      category: "shotoku",
      categoryPath: "所得税",
      canonicalUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
      sourceType: "tax_answer",
      aliases: ["No.1200 税額控除", "1200 税額控除"],
      headings: ["税額控除", "対象税目", "概要", "税額控除の主なもの", "配当控除", "根拠法令等", "関連コード", "お問い合わせ先"],
      metadata: {
        source_type: "tax_answer",
        category: "shotoku",
      },
    });
    expect(parsed.markdown).toContain("# 税額控除");
    expect(parsed.markdown).toContain("## 対象税目");
    expect(parsed.markdown).toContain("- [配当所得があるとき(配当控除)](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1250.htm)");
    expect(parsed.meta.content_hash).toMatch(/^sha256:/u);
  });

  it("converts tables into markdown tables and strips feedback UI", async () => {
    const html = await readFile(`${fixturesDir}/3105.html`, "utf8");

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3105.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.markdown).toContain("| 譲渡資産の種類 | 課税方法 |");
    expect(parsed.markdown).toContain("| 土地・建物等 | 分離課税 |");
    expect(parsed.markdown).not.toContain("アンケート");
    expect(parsed.document.headings).toContain("計算方法・計算式");
  });

  it("supports pages without related code list and derives aliases from the page title", async () => {
    const html = await readFile(`${fixturesDir}/6101.html`, "utf8");

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6101.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.document).toMatchObject({
      id: "6101",
      title: "消費税の基本的なしくみ",
      category: "shohi",
      aliases: ["No.6101 消費税の基本的なしくみ", "6101 消費税の基本的なしくみ"],
    });
    expect(parsed.markdown).toContain("## 関連リンク");
  });

  it("leaves javascript links as plain text instead of converting them to markdown links", async () => {
    const html = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top">
        <h1>No.1200 税額控除</h1>
      </div>
      <h2>関連リンク</h2>
      <p><a href="javascript:window.open('/taxes/shiraberu/taxanswer/shotoku/1250.htm')">配当所得があるとき(配当控除)</a></p>
    </div>
  </body>
</html>`;

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.markdown).toContain("配当所得があるとき(配当控除)");
    expect(parsed.markdown).not.toContain("javascript:window.open");
  });

  it("keeps official ministry links as markdown links", async () => {
    const html = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top">
        <h1>No.1200 税額控除</h1>
      </div>
      <h2>参考</h2>
      <p><a href="https://www.mof.go.jp/policy/tax_policy/tax_reform/outline.html">税制改正の概要</a></p>
    </div>
  </body>
</html>`;

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.markdown).toContain(
      "[税制改正の概要](https://www.mof.go.jp/policy/tax_policy/tax_reform/outline.html)",
    );
  });

  it("parses pages that use the full-content contents wrapper instead of bodyArea", async () => {
    const html = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div class="container">
      <div class="full-content contents">
        <div class="page-header" id="page-top">
          <h1>No.5207 役員賞与</h1>
        </div>
        <h2>概要</h2>
        <p>役員賞与の説明です。</p>
      </div>
    </div>
  </body>
</html>`;

    const parsed = parseTaxAnswerHtml({
      html,
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/hojin/5207.htm",
      crawledAt: "2026-04-11T12:34:56.000Z",
    });

    expect(parsed.document).toMatchObject({
      id: "5207",
      title: "役員賞与",
      category: "hojin",
    });
    expect(parsed.markdown).toContain("役員賞与の説明です。");
  });
});
