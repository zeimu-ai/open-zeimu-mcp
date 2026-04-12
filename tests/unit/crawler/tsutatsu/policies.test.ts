import { describe, expect, it } from "vitest";

import { detectTsutatsuChange } from "../../../../src/crawler/tsutatsu/change-detector.js";
import { FixedRateLimiter } from "../../../../src/crawler/tsutatsu/rate-limit.js";
import { TsutatsuRobotsPolicy } from "../../../../src/crawler/tsutatsu/robots.js";
import { assertAllowedTsutatsuUrl } from "../../../../src/crawler/tsutatsu/url-policy.js";

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

describe("TsutatsuRobotsPolicy", () => {
  it("allows tsutatsu paths not covered by Disallow and blocks matching paths", () => {
    const policy = new TsutatsuRobotsPolicy("User-agent: *\nDisallow: /private/\nDisallow: /law/tsutatsu/kihon/blocked/\n");

    expect(policy.isAllowed("/law/tsutatsu/kihon/shotoku/01/01.htm")).toBe(true);
    expect(policy.isAllowed("/law/tsutatsu/kihon/blocked/01.htm")).toBe(false);
  });
});

describe("assertAllowedTsutatsuUrl", () => {
  it("accepts NTA tsutatsu URLs and rejects other hosts", () => {
    expect(() =>
      assertAllowedTsutatsuUrl("https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm"),
    ).not.toThrow();
    expect(() =>
      assertAllowedTsutatsuUrl("https://evil.example.com/law/tsutatsu/kihon/shotoku/01/01.htm"),
    ).toThrow(/Disallowed host/u);
  });
});

describe("detectTsutatsuChange", () => {
  it("marks a first crawl as new", () => {
    expect(
      detectTsutatsuChange({
        current: null,
        next: {
          id: "tsutatsu-shotoku-01-01",
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
