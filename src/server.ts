import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { Env } from "./config/env.js";
import { loadMarkdownDocuments } from "./data/md-loader.js";
import { createLogger } from "./lib/logger.js";
import { buildLexicalIndex } from "./search/lexical-index.js";
import { buildHealthResult, healthInputSchema, healthOutputSchema } from "./tools/health.js";
import {
  buildGetQaCaseResult,
  getQaCaseInputSchema,
  getQaCaseOutputSchema,
} from "./tools/get-qa-case.js";
import {
  buildGetTaxAnswerResult,
  getTaxAnswerInputSchema,
  getTaxAnswerOutputSchema,
} from "./tools/get-tax-answer.js";
import {
  buildGetWrittenAnswerResult,
  getWrittenAnswerInputSchema,
  getWrittenAnswerOutputSchema,
} from "./tools/get-written-answer.js";
import {
  buildGetTsutatsuResult,
  getTsutatsuInputSchema,
  getTsutatsuOutputSchema,
} from "./tools/get-tsutatsu.js";
import {
  buildListQaCaseCategoriesResult,
  listQaCaseCategoriesInputSchema,
  listQaCaseCategoriesOutputSchema,
} from "./tools/list-qa-case-categories.js";
import {
  buildListTaxAnswerCategoriesResult,
  listTaxAnswerCategoriesInputSchema,
  listTaxAnswerCategoriesOutputSchema,
} from "./tools/list-tax-answer-categories.js";
import {
  buildListTsutatsuCategoriesResult,
  listTsutatsuCategoriesInputSchema,
  listTsutatsuCategoriesOutputSchema,
} from "./tools/list-tsutatsu-categories.js";
import {
  lexicalSearchInputSchema,
  lexicalSearchOutputSchema,
  runLexicalSearch,
} from "./tools/lexical-search.js";
import {
  buildSearchQaCaseResult,
  searchQaCaseInputSchema,
  searchQaCaseOutputSchema,
} from "./tools/search-qa-case.js";
import {
  buildSearchTaxAnswerResult,
  searchTaxAnswerInputSchema,
  searchTaxAnswerOutputSchema,
} from "./tools/search-tax-answer.js";
import {
  buildSearchTsutatsuResult,
  searchTsutatsuInputSchema,
  searchTsutatsuOutputSchema,
} from "./tools/search-tsutatsu.js";
import {
  buildSearchWrittenAnswerResult,
  searchWrittenAnswerInputSchema,
  searchWrittenAnswerOutputSchema,
} from "./tools/search-written-answer.js";
import { buildStatsResult, statsInputSchema, statsOutputSchema } from "./tools/stats.js";
import { buildGetLawResult, getLawInputSchema, getLawOutputSchema } from "./tools/get-law.js";
import {
  buildSearchLawResult,
  searchLawInputSchema,
  searchLawOutputSchema,
} from "./tools/search-law.js";
import { EgovRepository } from "./repository/egov-repository.js";

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
}): Promise<OpenZeimuMcpServer> {
  return createServerInternal({ env, version });
}

async function createServerInternal({
  env,
  version,
}: {
  env: Env;
  version: string;
}): Promise<OpenZeimuMcpServer> {
  const logger = createLogger(env);
  const startedAt = Date.now();
  const documents = await loadMarkdownDocuments({ dataDir: env.dataDir });
  const lexicalIndex = await buildLexicalIndex({ documents });
  const egovRepository = new EgovRepository();
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
      const structuredContent = await buildStatsResult({ env, lexicalIndex });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "lexical_search",
    {
      title: "Lexical Search",
      description: "Lexical search over packaged Japanese tax documents.",
      inputSchema: lexicalSearchInputSchema,
      outputSchema: lexicalSearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = runLexicalSearch({
        lexicalIndex,
        input: lexicalSearchInputSchema.parse(input),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "list_tax_answer_categories",
    {
      title: "List Tax Answer Categories",
      description: "同梱済みタックスアンサーのカテゴリ一覧と文書件数を返します。",
      inputSchema: listTaxAnswerCategoriesInputSchema,
      outputSchema: listTaxAnswerCategoriesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const structuredContent = buildListTaxAnswerCategoriesResult({ documents });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "list_tsutatsu_categories",
    {
      title: "List Tsutatsu Categories",
      description: "同梱済み通達のカテゴリ一覧と文書件数を返します。",
      inputSchema: listTsutatsuCategoriesInputSchema,
      outputSchema: listTsutatsuCategoriesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const structuredContent = buildListTsutatsuCategoriesResult({ documents });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "list_qa_case_categories",
    {
      title: "List QA Case Categories",
      description: "同梱済み質疑応答事例のカテゴリ一覧と文書件数を返します。",
      inputSchema: listQaCaseCategoriesInputSchema,
      outputSchema: listQaCaseCategoriesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const structuredContent = buildListQaCaseCategoriesResult({ documents });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_tax_answer",
    {
      title: "Get Tax Answer",
      description: "ID を指定して、パッケージ済みのタックスアンサー本文を取得します。",
      inputSchema: getTaxAnswerInputSchema,
      outputSchema: getTaxAnswerOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = await buildGetTaxAnswerResult({
        input: getTaxAnswerInputSchema.parse(input),
        documents,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_tsutatsu",
    {
      title: "Get Tsutatsu",
      description: "ID を指定して、パッケージ済みの通達本文を取得します。",
      inputSchema: getTsutatsuInputSchema,
      outputSchema: getTsutatsuOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = await buildGetTsutatsuResult({
        input: getTsutatsuInputSchema.parse(input),
        documents,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_qa_case",
    {
      title: "Get QA Case",
      description: "ID を指定して、パッケージ済みの質疑応答事例本文を取得します。",
      inputSchema: getQaCaseInputSchema,
      outputSchema: getQaCaseOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = await buildGetQaCaseResult({
        input: getQaCaseInputSchema.parse(input),
        documents,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "search_tax_answer",
    {
      title: "Search Tax Answer",
      description: "パッケージ済みのタックスアンサーを全文検索します。",
      inputSchema: searchTaxAnswerInputSchema,
      outputSchema: searchTaxAnswerOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = buildSearchTaxAnswerResult({
        lexicalIndex,
        input: searchTaxAnswerInputSchema.parse(input),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "search_tsutatsu",
    {
      title: "Search Tsutatsu",
      description: "パッケージ済みの通達を全文検索します。",
      inputSchema: searchTsutatsuInputSchema,
      outputSchema: searchTsutatsuOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = buildSearchTsutatsuResult({
        lexicalIndex,
        documents,
        input: searchTsutatsuInputSchema.parse(input),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "search_qa_case",
    {
      title: "Search QA Case",
      description: "パッケージ済みの質疑応答事例を全文検索します。",
      inputSchema: searchQaCaseInputSchema,
      outputSchema: searchQaCaseOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = buildSearchQaCaseResult({
        lexicalIndex,
        documents,
        input: searchQaCaseInputSchema.parse(input),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_written_answer",
    {
      title: "Get Written Answer",
      description: "ID を指定して、パッケージ済みの文書回答事例本文を取得します。",
      inputSchema: getWrittenAnswerInputSchema,
      outputSchema: getWrittenAnswerOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = await buildGetWrittenAnswerResult({
        input: getWrittenAnswerInputSchema.parse(input),
        documents,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "search_written_answer",
    {
      title: "Search Written Answer",
      description: "パッケージ済みの文書回答事例を全文検索します。",
      inputSchema: searchWrittenAnswerInputSchema,
      outputSchema: searchWrittenAnswerOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = buildSearchWrittenAnswerResult({
        lexicalIndex,
        documents,
        input: searchWrittenAnswerInputSchema.parse(input),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_law",
    {
      title: "Get Law",
      description:
        "法令名または法令番号から e-Gov 法令 API v2 経由で法令本文を取得します。取得結果は 24 時間 in-memory cache されます。一次情報取得 tool です。",
      inputSchema: getLawInputSchema,
      outputSchema: getLawOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const structuredContent = await buildGetLawResult({
        input: getLawInputSchema.parse(input),
        repo: egovRepository,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "search_law",
    {
      title: "Search Law",
      description:
        "キーワードで e-Gov 法令 API v2 を検索し、該当する法令の一覧を返します。取得結果は 24 時間 in-memory cache されます。一次情報取得 tool です。",
      inputSchema: searchLawInputSchema,
      outputSchema: searchLawOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const structuredContent = await buildSearchLawResult({
        input: searchLawInputSchema.parse(input),
        repo: egovRepository,
      });

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
      logger.info({ toolCount: 16, lexicalIndexSize: lexicalIndex.size }, "MCP server started");
    },
    close() {
      return server.close();
    },
  };
}
