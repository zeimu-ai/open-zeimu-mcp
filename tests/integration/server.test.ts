import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createServer } from "../../src/server.js";

const fixturesDir = fileURLToPath(new URL("../fixtures/data", import.meta.url));

describe("createServer", () => {
  it("registers core tools and serves structured responses", async () => {
    const app = await createServer({
      env: {
        embeddingBackend: "none",
        logLevel: "info",
        dataDir: fixturesDir,
        vectorsCacheDir: `${fixturesDir}/vectors`,
      },
      version: "0.0.0",
    });

    const client = new Client(
      { name: "open-zeimu-mcp-test-client", version: "0.0.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([client.connect(clientTransport), app.start(serverTransport)]);

    expect(client.getInstructions()).toBe("日本税務一次情報の検索・取得 MCP サーバー");

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "health",
      "stats",
      "lexical_search",
      "list_tax_answer_categories",
      "list_tsutatsu_categories",
      "list_qa_case_categories",
      "get_tax_answer",
      "get_tsutatsu",
      "get_qa_case",
      "search_tax_answer",
      "search_tsutatsu",
      "search_qa_case",
      "get_written_answer",
      "search_written_answer",
      "get_law",
      "search_law",
    ]);

    const health = await client.callTool({ name: "health", arguments: {} });
    expect(health.structuredContent).toMatchObject({
      status: "ok",
      version: "0.0.0",
      checks: {
        data_dir: true,
        vectors: "disabled",
      },
    });

    const stats = await client.callTool({ name: "stats", arguments: {} });
    expect(stats.structuredContent).toMatchObject({
      lexical_index: {
        size: 4,
      },
      source_types: {
        tax_answer: {
          count: 1,
        },
        tsutatsu: {
          count: 1,
        },
        qa_case: {
          count: 1,
        },
      },
      semantic: {
        backend: "none",
        vectors_loaded: false,
      },
    });

    const lexicalSearch = await client.callTool({
      name: "lexical_search",
      arguments: { query: "基礎控除" },
    });
    expect(lexicalSearch.structuredContent).toMatchObject({
      hits: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
        },
      ],
    });

    const getTaxAnswer = await client.callTool({
      name: "get_tax_answer",
      arguments: { id: "1200" },
    });
    expect(getTaxAnswer.structuredContent).toMatchObject({
      source_type: "tax_answer",
      id: "1200",
      title: "所得税の基礎控除",
      canonical_url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
    });

    const searchTaxAnswer = await client.callTool({
      name: "search_tax_answer",
      arguments: { query: "基礎控除", limit: 5 },
    });
    expect(searchTaxAnswer.structuredContent).toMatchObject({
      source_type: "tax_answer",
      query: "基礎控除",
      total_count: 1,
      results: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
        },
      ],
    });

    const listTsutatsuCategories = await client.callTool({
      name: "list_tsutatsu_categories",
      arguments: {},
    });
    expect(listTsutatsuCategories.structuredContent).toMatchObject({
      source_type: "tsutatsu",
      total_count: 1,
      categories: [
        {
          category: "shohi",
          document_count: 1,
        },
      ],
    });

    const getTsutatsu = await client.callTool({
      name: "get_tsutatsu",
      arguments: { id: "tsu-001" },
    });
    expect(getTsutatsu.structuredContent).toMatchObject({
      source_type: "tsutatsu",
      id: "tsu-001",
      title: "消費税の仕入税額控除に関する通達",
      canonical_url: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
    });

    const searchTsutatsu = await client.callTool({
      name: "search_tsutatsu",
      arguments: { query: "仕入税額控除", limit: 5 },
    });
    expect(searchTsutatsu.structuredContent).toMatchObject({
      source_type: "tsutatsu",
      query: "仕入税額控除",
      total_count: 1,
      results: [
        {
          id: "tsu-001",
          source_type: "tsutatsu",
          title: "消費税の仕入税額控除に関する通達",
        },
      ],
    });

    const listQaCaseCategories = await client.callTool({
      name: "list_qa_case_categories",
      arguments: {},
    });
    expect(listQaCaseCategories.structuredContent).toMatchObject({
      source_type: "qa_case",
      total_count: 1,
      categories: [
        {
          category: "hojin",
          document_count: 1,
        },
      ],
    });

    const getQaCase = await client.callTool({
      name: "get_qa_case",
      arguments: { id: "qa-001" },
    });
    expect(getQaCase.structuredContent).toMatchObject({
      source_type: "qa_case",
      id: "qa-001",
      title: "交際費の判定に関する質疑応答事例",
      canonical_url: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
    });

    const searchQaCase = await client.callTool({
      name: "search_qa_case",
      arguments: { query: "交際費", limit: 5 },
    });
    expect(searchQaCase.structuredContent).toMatchObject({
      source_type: "qa_case",
      query: "交際費",
      total_count: 1,
      results: [
        {
          id: "qa-001",
          source_type: "qa_case",
          title: "交際費の判定に関する質疑応答事例",
        },
      ],
    });

    const listTaxAnswerCategories = await client.callTool({
      name: "list_tax_answer_categories",
      arguments: {},
    });
    expect(listTaxAnswerCategories.structuredContent).toMatchObject({
      source_type: "tax_answer",
      total_count: 1,
      categories: [
        {
          category: "shotoku",
          document_count: 1,
        },
      ],
    });

    const getWrittenAnswer = await client.callTool({
      name: "get_written_answer",
      arguments: { id: "202401" },
    });
    expect(getWrittenAnswer.structuredContent).toMatchObject({
      source_type: "written_answer",
      id: "202401",
      title: "非上場株式の評価に関する文書回答事例",
      page_count: 2,
      canonical_url: "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
    });

    const searchWrittenAnswer = await client.callTool({
      name: "search_written_answer",
      arguments: { query: "第2ページ", limit: 5 },
    });
    expect(searchWrittenAnswer.structuredContent).toMatchObject({
      source_type: "written_answer",
      query: "第2ページ",
      total_count: 1,
      results: [
        {
          id: "202401",
          source_type: "written_answer",
          title: "非上場株式の評価に関する文書回答事例",
          page_hint: "p.2",
        },
      ],
    });

    await Promise.all([client.close(), app.close()]);
  });
});
