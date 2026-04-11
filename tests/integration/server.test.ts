import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createServer } from "../../src/server.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("createServer", () => {
  it("registers health and stats tools and serves structured responses", async () => {
    const root = await makeTempDir();
    const dataDir = join(root, "data");

    await writeFixture(join(dataDir, "tax_answer", "001.md"), "fixture");

    const app = createServer({
      env: {
        embeddingBackend: "none",
        logLevel: "info",
        dataDir,
        vectorsCacheDir: join(root, "vectors"),
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
    expect(tools.tools.map((tool) => tool.name)).toEqual(["health", "stats"]);

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

    await Promise.all([client.close(), app.close()]);
  });
});

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-server-"));
  createdDirs.push(dir);
  return dir;
}

async function writeFixture(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
