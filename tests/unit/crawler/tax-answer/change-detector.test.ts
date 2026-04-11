import { describe, expect, it } from "vitest";

import { detectTaxAnswerChange } from "../../../../src/crawler/tax-answer/change-detector.js";

describe("detectTaxAnswerChange", () => {
  it("prefers ETag and keeps the existing version when content is unchanged", () => {
    const result = detectTaxAnswerChange({
      current: {
        id: "1200",
        contentHash: "sha256:old",
        eTag: '"etag-1"',
        lastModified: "Mon, 01 Apr 2026 00:00:00 GMT",
        version: 3,
      },
      next: {
        id: "1200",
        contentHash: "sha256:new",
        eTag: '"etag-1"',
        lastModified: "Tue, 02 Apr 2026 00:00:00 GMT",
      },
    });

    expect(result).toEqual({
      changed: false,
      reason: "etag",
      version: 3,
    });
  });

  it("falls back to content hash when validators are missing and increments the version", () => {
    const result = detectTaxAnswerChange({
      current: {
        id: "1200",
        contentHash: "sha256:old",
        eTag: null,
        lastModified: null,
        version: 3,
      },
      next: {
        id: "1200",
        contentHash: "sha256:new",
        eTag: null,
        lastModified: null,
      },
    });

    expect(result).toEqual({
      changed: true,
      reason: "content_hash",
      version: 4,
    });
  });

  it("marks a first crawl as new", () => {
    const result = detectTaxAnswerChange({
      current: null,
      next: {
        id: "6101",
        contentHash: "sha256:new",
        eTag: null,
        lastModified: null,
      },
    });

    expect(result).toEqual({
      changed: true,
      reason: "new",
      version: 1,
    });
  });
});
