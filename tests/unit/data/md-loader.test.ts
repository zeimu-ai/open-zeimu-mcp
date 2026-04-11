import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMarkdownDocuments } from "../../../src/data/md-loader.js";

const fixturesDir = fileURLToPath(new URL("../../fixtures/data", import.meta.url));

describe("loadMarkdownDocuments", () => {
  it("loads frontmatter, headings, metadata, and body from markdown documents", async () => {
    const documents = await loadMarkdownDocuments({
      dataDir: fixturesDir,
    });

    const taxAnswer = documents.find((document) => document.id === "1200");

    expect(taxAnswer).toMatchObject({
      id: "1200",
      sourceType: "tax_answer",
      title: "所得税の基礎控除",
      category: "shotoku",
      metadata: {
        citation: "タックスアンサーNo.1200",
      },
      headings: ["所得税の基礎控除", "適用要件"],
      aliases: ["基礎控除"],
    });
    expect(taxAnswer?.body).toContain("一定額を所得から差し引く制度");
  });

  it("extracts page offsets for written_answer documents from page-break markers", async () => {
    const documents = await loadMarkdownDocuments({
      dataDir: fixturesDir,
      sourceTypes: ["written_answer"],
    });

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: "202401",
      sourceType: "written_answer",
      pageOffsets: [0, 12],
      pageCount: 2,
    });
    expect(documents[0].body).toBe("第1ページ本文です。\n\n第2ページ本文です。");
  });
});
