import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { Env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { buildHealthResult, healthInputSchema, healthOutputSchema } from "./tools/health.js";
import { buildStatsResult, statsInputSchema, statsOutputSchema } from "./tools/stats.js";

const DEFAULT_SERVER_VERSION = "0.0.0";
const SERVER_INSTRUCTIONS = "日本税務一次情報の検索・取得 MCP サーバー";

export type OpenZeimuMcpServer = {
  server: McpServer;
  start: (transport?: Transport) => Promise<void>;
  close: () => Promise<void>;
};

export function createServer({
  env,
  version = DEFAULT_SERVER_VERSION,
}: {
  env: Env;
  version?: string;
}): OpenZeimuMcpServer {
  const logger = createLogger(env);
  const startedAt = Date.now();
  const server = new McpServer(
    {
      name: "open-zeimu-mcp",
      version,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  server.registerTool(
    "health",
    {
      title: "Health",
      description: "Runtime health checks for this MCP server.",
      inputSchema: healthInputSchema,
      outputSchema: healthOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const structuredContent = await buildHealthResult({
        env,
        version,
        startedAt,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "stats",
    {
      title: "Stats",
      description: "Dataset coverage and index readiness summary.",
      inputSchema: statsInputSchema,
      outputSchema: statsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const structuredContent = await buildStatsResult({ env });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  return {
    server,
    async start(transport: Transport = new StdioServerTransport()) {
      await server.connect(transport);
      logger.info({ toolCount: 2 }, "MCP server started");
    },
    close() {
      return server.close();
    },
  };
}
