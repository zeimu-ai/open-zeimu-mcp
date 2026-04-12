import { describe, expect, it } from "vitest";

import {
  extractTaxAnswerLinks,
  extractTaxAnswerSeedPages,
} from "../../../../src/crawler/tax-answer/discovery.js";

describe("extractTaxAnswerSeedPages", () => {
  it("returns the code index and bunya seed pages from the root page", () => {
    const urls = extractTaxAnswerSeedPages(
      `
        <ul>
          <li><a href="/taxes/shiraberu/taxanswer/code/bunya-hojin.htm">法人税</a></li>
          <li><a href="/taxes/shiraberu/taxanswer/code/bunya-syohizei.htm">消費税</a></li>
          <li><a href="/taxes/shiraberu/taxanswer/code/bunya-souzoku-zoyo.htm">相続税・贈与税</a></li>
          <li><a href="/taxes/shiraberu/taxanswer/code/bunya-saigai.htm">災害</a></li>
        </ul>
      `,
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/index2.htm",
    );

    expect(urls).toEqual([
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/bunya-hojin.htm",
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/bunya-saigai.htm",
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/bunya-souzoku-zoyo.htm",
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/bunya-syohizei.htm",
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/index.htm",
    ]);
  });
});

describe("extractTaxAnswerLinks", () => {
  it("extracts direct tax answer pages from the code index and ignores anchor-only links", () => {
    const urls = extractTaxAnswerLinks(
      `
        <ul class="noListImg">
          <li><a href="/taxes/shiraberu/taxanswer/shotoku/1000.htm">1000　所得税のしくみ</a></li>
          <li><a href="/taxes/shiraberu/taxanswer/shotoku/1800.htm#page-top">1800　パート収入</a></li>
          <li><a href="/taxes/shiraberu/taxanswer/code/index.htm#code01-01">夫婦と税金</a></li>
        </ul>
      `,
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/index.htm",
    );

    expect(urls).toEqual([
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1000.htm",
      "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1800.htm",
    ]);
  });
});
