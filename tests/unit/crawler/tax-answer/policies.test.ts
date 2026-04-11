import { describe, expect, it } from "vitest";

import { FixedRateLimiter } from "../../../../src/crawler/tax-answer/rate-limit.js";
import { TaxAnswerRobotsPolicy } from "../../../../src/crawler/tax-answer/robots.js";
import { assertAllowedTaxAnswerUrl } from "../../../../src/crawler/tax-answer/url-policy.js";

describe("FixedRateLimiter", () => {
  it("waits until one request per second is satisfied", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new FixedRateLimiter({
      intervalMs: 1_000,
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });

    await limiter.wait();
    now = 200;
    await limiter.wait();
    now += 1000;
    await limiter.wait();

    expect(waits).toEqual([800]);
  });
});

describe("TaxAnswerRobotsPolicy", () => {
  it("allows paths not covered by Disallow and blocks matching paths", () => {
    const policy = new TaxAnswerRobotsPolicy(`User-agent: *\nDisallow: /private/\nDisallow: /taxes/shiraberu/taxanswer/blocked/\n`);

    expect(policy.isAllowed("/taxes/shiraberu/taxanswer/shotoku/1200.htm")).toBe(true);
    expect(policy.isAllowed("/taxes/shiraberu/taxanswer/blocked/1200.htm")).toBe(false);
  });
});

describe("assertAllowedTaxAnswerUrl", () => {
  it("accepts allowlisted hosts and rejects other hosts", () => {
    expect(() =>
      assertAllowedTaxAnswerUrl("https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm"),
    ).not.toThrow();
    expect(() =>
      new URL("https://www.keisan.nta.go.jp/kyoutu/ky/sm/top"),
    ).not.toThrow();
    expect(() =>
      assertAllowedTaxAnswerUrl("https://evil.example.com/taxes/shiraberu/taxanswer/shotoku/1200.htm"),
    ).toThrow(/Disallowed host/u);
  });
});
