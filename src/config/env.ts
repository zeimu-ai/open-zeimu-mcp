import { homedir } from "node:os";

import { z } from "zod";

const envSchema = z
  .object({
    EMBEDDING_BACKEND: z.enum(["none", "local", "supabase"]).optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .optional(),
    DATA_DIR: z.string().min(1).optional(),
    VECTORS_CACHE_DIR: z.string().min(1).optional(),
    ONNX_MODEL_FILENAME: z.string().min(1).optional(),
    TOKENIZER_FILENAME: z.string().min(1).optional(),
    TOKENIZER_CONFIG_FILENAME: z.string().min(1).optional(),
    EMBEDDING_CHUNK_SIZE: z.coerce.number().int().positive().optional(),
    EMBEDDING_CHUNK_OVERLAP: z.coerce.number().int().nonnegative().optional(),
    EMBEDDING_MAX_TOKENS: z.coerce.number().int().positive().optional(),
  })
  .transform((raw) => ({
    embeddingBackend: raw.EMBEDDING_BACKEND ?? "none",
    logLevel: raw.LOG_LEVEL ?? "info",
    dataDir: raw.DATA_DIR ?? "./data",
    vectorsCacheDir: expandHomeDir(
      raw.VECTORS_CACHE_DIR ?? "~/.cache/open-zeimu-mcp/vectors",
    ),
    onnxModelFileName: raw.ONNX_MODEL_FILENAME ?? "bge-m3-int8.onnx.tar.gz",
    tokenizerFileName: raw.TOKENIZER_FILENAME ?? "tokenizer.json",
    tokenizerConfigFileName: raw.TOKENIZER_CONFIG_FILENAME ?? "tokenizer_config.json",
    embeddingChunkSize: raw.EMBEDDING_CHUNK_SIZE ?? 512,
    embeddingChunkOverlap: raw.EMBEDDING_CHUNK_OVERLAP ?? 64,
    embeddingMaxTokens: raw.EMBEDDING_MAX_TOKENS ?? 512,
  }));

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

function expandHomeDir(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return `${homedir()}${path.slice(1)}`;
  }

  return path;
}
