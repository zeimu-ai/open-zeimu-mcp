import { homedir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadEnv } from "../../../src/config/env.js";

describe("loadEnv", () => {
  it("returns defaults when env vars are unset", () => {
    const env = loadEnv({});

    expect(env).toEqual({
      embeddingBackend: "none",
      logLevel: "info",
      dataDir: "./data",
      vectorsCacheDir: `${homedir()}/.cache/open-zeimu-mcp/vectors`,
      onnxModelFileName: "bge-m3-int8.onnx.tar.gz",
    });
  });

  it("parses supported env vars", () => {
    const env = loadEnv({
      EMBEDDING_BACKEND: "local",
      LOG_LEVEL: "debug",
      DATA_DIR: "/tmp/open-zeimu-mcp/data",
      VECTORS_CACHE_DIR: "~/custom-cache",
      ONNX_MODEL_FILENAME: "custom-bge.onnx.tar.gz",
    });

    expect(env).toEqual({
      embeddingBackend: "local",
      logLevel: "debug",
      dataDir: "/tmp/open-zeimu-mcp/data",
      vectorsCacheDir: `${homedir()}/custom-cache`,
      onnxModelFileName: "custom-bge.onnx.tar.gz",
    });
  });

  it("supports overriding the packaged ONNX model filename", () => {
    const env = loadEnv({
      ONNX_MODEL_FILENAME: "custom-bge.onnx.tar.gz",
    });

    expect(env.onnxModelFileName).toBe("custom-bge.onnx.tar.gz");
  });

  it("rejects unsupported embedding backends", () => {
    expect(() =>
      loadEnv({
        EMBEDDING_BACKEND: "remote",
      }),
    ).toThrow(/EMBEDDING_BACKEND/i);
  });

  it("rejects unsupported log levels", () => {
    expect(() =>
      loadEnv({
        LOG_LEVEL: "verbose",
      }),
    ).toThrow(/LOG_LEVEL/i);
  });
});
