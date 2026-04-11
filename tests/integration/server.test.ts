import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createServer } from "../../src/server.js";

const fixturesDir = fileURLToPath(new URL("../fixtures/data", import.meta.url));

describe("createServer", () => {
  it("registers health, stats, and lexical_search tools and serves structured responses", async () => {
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
        size: 2,
      },
      source_types: {
        tax_answer: {
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

    await Promise.all([client.close(), app.close()]);
  });
});
