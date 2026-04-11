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
    });
  });

  it("parses supported env vars", () => {
    const env = loadEnv({
      EMBEDDING_BACKEND: "local",
      LOG_LEVEL: "debug",
      DATA_DIR: "/tmp/open-zeimu-mcp/data",
      VECTORS_CACHE_DIR: "~/custom-cache",
    });

    expect(env).toEqual({
      embeddingBackend: "local",
      logLevel: "debug",
      dataDir: "/tmp/open-zeimu-mcp/data",
      vectorsCacheDir: `${homedir()}/custom-cache`,
    });
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
