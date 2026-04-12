import { describe, expect, it } from "vitest";

import { detectQaCaseChange } from "../../../../src/crawler/qa-case/change-detector.js";
import { FixedRateLimiter } from "../../../../src/crawler/qa-case/rate-limit.js";
import { QaCaseRobotsPolicy } from "../../../../src/crawler/qa-case/robots.js";
import { assertAllowedQaCaseUrl } from "../../../../src/crawler/qa-case/url-policy.js";

describe("FixedRateLimiter", () => {
  it("waits until one request per two seconds is satisfied", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new FixedRateLimiter({
      intervalMs: 2_000,
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });

    await limiter.wait();
    now = 500;
    await limiter.wait();
    now += 2_000;
    await limiter.wait();

    expect(waits).toEqual([1_500]);
  });
});

describe("QaCaseRobotsPolicy", () => {
  it("allows qa_case paths not covered by Disallow and blocks matching paths", () => {
    const policy = new QaCaseRobotsPolicy(
      "User-agent: *\nDisallow: /private/\nDisallow: /law/shitsugi/blocked/\n",
    );

    expect(policy.isAllowed("/law/shitsugi/shotoku/01.htm")).toBe(true);
    expect(policy.isAllowed("/law/shitsugi/blocked/01.htm")).toBe(false);
  });
});

describe("assertAllowedQaCaseUrl", () => {
  it("accepts NTA qa_case URLs and rejects other hosts", () => {
    expect(() =>
      assertAllowedQaCaseUrl("https://www.nta.go.jp/law/shitsugi/shotoku/01/01.htm"),
    ).not.toThrow();
    expect(() =>
      assertAllowedQaCaseUrl("https://www.nta.go.jp/taxes/sake/qa/01/01.htm"),
    ).not.toThrow();
    expect(() =>
      assertAllowedQaCaseUrl("https://evil.example.com/law/shitsugi/shotoku/01/01.htm"),
    ).toThrow(/Disallowed host/u);
  });
});

describe("detectQaCaseChange", () => {
  it("marks a first crawl as new", () => {
    expect(
      detectQaCaseChange({
        current: null,
        next: {
          id: "qa-shotoku-01-01",
          contentHash: "sha256:new",
          eTag: null,
          lastModified: null,
        },
      }),
    ).toEqual({
      changed: true,
      reason: "new",
      version: 1,
    });
  });
});
