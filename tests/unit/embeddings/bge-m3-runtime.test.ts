import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createBgeM3Runtime } from "../../../src/embeddings/bge-m3-runtime.js";

describe("createBgeM3Runtime", () => {
  it("encodes a query with injected tokenizer and session loaders", async () => {
    const assetDir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-bge-runtime-"));
    const modelPath = join(assetDir, "model.onnx");
    const tokenizerPath = join(assetDir, "tokenizer.json");
    const tokenizerConfigPath = join(assetDir, "tokenizer_config.json");
    await mkdir(assetDir, { recursive: true });
    await writeFile(modelPath, "model", "utf8");
    await writeFile(tokenizerPath, "tokenizer", "utf8");
    await writeFile(tokenizerConfigPath, "{}", "utf8");

    const runtime = await createBgeM3Runtime({
      modelPath,
      tokenizerPath,
      tokenizerConfigPath,
      loadTokenizer: async () => ({
        encode(text: string) {
          expect(text).toBe("基礎控除");
          return {
            ids: [101, 102, 103],
            attentionMask: [1, 1, 1],
            typeIds: [0, 0, 0],
          };
        },
      }),
      loadSession: async () => ({
        inputNames: ["input_ids", "attention_mask", "token_type_ids"],
        async run() {
          return {
            last_hidden_state: {
              dims: [1, 3, 3],
              data: new Float32Array([
                1, 0, 0,
                1, 0, 0,
                1, 0, 0,
              ]),
            },
          };
        },
      }),
    });

    const vector = await runtime.encodeQuery("基礎控除");

    expect(Array.from(vector)).toEqual([1, 0, 0]);
  });

  it("throws a clean error when required assets are missing", async () => {
    await expect(
      createBgeM3Runtime({
        modelPath: "/missing/model.onnx",
        tokenizerPath: "/missing/tokenizer.json",
        tokenizerConfigPath: "/missing/tokenizer_config.json",
      }),
    ).rejects.toThrow("Local semantic model assets are missing");
  });
});
