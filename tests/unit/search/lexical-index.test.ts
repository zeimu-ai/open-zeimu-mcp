import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMarkdownDocuments } from "../../../src/data/md-loader.js";
import { buildLexicalIndex } from "../../../src/search/lexical-index.js";

const fixturesDir = fileURLToPath(new URL("../../fixtures/data", import.meta.url));

describe("buildLexicalIndex", () => {
  it("builds an index and returns hits ordered by relevance", async () => {
    const documents = await loadMarkdownDocuments({ dataDir: fixturesDir });
    const lexicalIndex = await buildLexicalIndex({ documents });

    const result = lexicalIndex.search({
      query: "基礎控除",
      limit: 10,
    });

    expect(lexicalIndex.size).toBe(5);
    expect(lexicalIndex.builtAt).toBeTruthy();
    expect(result.hits[0]).toMatchObject({
      id: "1200",
      source_type: "tax_answer",
      title: "所得税の基礎控除",
    });
    expect(result.hits[0]?.snippet).toContain("基礎控除");
  });

  it("filters hits by source type", async () => {
    const documents = await loadMarkdownDocuments({ dataDir: fixturesDir });
    const lexicalIndex = await buildLexicalIndex({ documents });

    const result = lexicalIndex.search({
      query: "評価",
      sourceTypes: ["tax_answer"],
      limit: 10,
    });

    expect(result.hits).toEqual([]);
  });

  it("supports duplicate document ids across source types", async () => {
    const documents = await loadMarkdownDocuments({ dataDir: fixturesDir });
    const lexicalIndex = await buildLexicalIndex({ documents });

    const result = lexicalIndex.search({
      query: "交際費",
      sourceTypes: ["qa_case"],
      limit: 10,
    });

    expect(result.hits[0]).toMatchObject({
      id: "qa-001",
      source_type: "qa_case",
      title: "交際費の判定に関する質疑応答事例",
    });
  });

  it("filters hits by category within a source type", async () => {
    const documents = await loadMarkdownDocuments({ dataDir: fixturesDir });
    const lexicalIndex = await buildLexicalIndex({ documents });

    const result = lexicalIndex.search({
      query: "立退料",
      sourceTypes: ["saiketsu"],
      category: "shotoku",
      limit: 10,
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({
      id: "sai-001",
      source_type: "saiketsu",
    });
  });
});
