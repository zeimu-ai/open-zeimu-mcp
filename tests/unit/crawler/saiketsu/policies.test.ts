import { describe, expect, it } from "vitest";

import { SaiketsuRobotsPolicy } from "../../../../src/crawler/saiketsu/robots.js";
import { assertAllowedSaiketsuUrl } from "../../../../src/crawler/saiketsu/url-policy.js";

describe("SaiketsuRobotsPolicy", () => {
  it("respects disallow rules for all agents", () => {
    const policy = new SaiketsuRobotsPolicy(`
      User-agent: googlebot
      Disallow: *.csi

      User-agent: *
      Disallow: /private/
    `);

    expect(policy.isAllowed("/service/MP/01/index.html")).toBe(true);
    expect(policy.isAllowed("/private/path")).toBe(false);
  });
});

describe("assertAllowedSaiketsuUrl", () => {
  it("allows only KFS saiketsu URLs", () => {
    expect(() =>
      assertAllowedSaiketsuUrl("https://www.kfs.go.jp/service/JP/55/01/index.html"),
    ).not.toThrow();
    expect(() => assertAllowedSaiketsuUrl("https://example.com/service/JP/55/01/index.html")).toThrow(
      /Disallowed host/u,
    );
    expect(() => assertAllowedSaiketsuUrl("https://www.kfs.go.jp/private/path")).toThrow(
      /Disallowed path/u,
    );
  });
});
