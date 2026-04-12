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
  })
  .transform((raw) => ({
    embeddingBackend: raw.EMBEDDING_BACKEND ?? "none",
    logLevel: raw.LOG_LEVEL ?? "info",
    dataDir: raw.DATA_DIR ?? "./data",
    vectorsCacheDir: expandHomeDir(
      raw.VECTORS_CACHE_DIR ?? "~/.cache/open-zeimu-mcp/vectors",
    ),
    onnxModelFileName: raw.ONNX_MODEL_FILENAME ?? "bge-m3-int8.onnx.tar.gz",
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
