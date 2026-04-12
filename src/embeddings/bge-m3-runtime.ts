import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";

import { normalizeVector } from "../search/semantic-indexer.js";

type TokenizerEncoding = {
  ids: number[];
  attentionMask: number[];
  typeIds?: number[];
};

type TokenizerLike = {
  encode: (text: string) => Promise<TokenizerEncoding> | TokenizerEncoding;
};

type SessionTensorLike = {
  dims: number[];
  data: Float32Array;
};

type SessionLike = {
  inputNames?: readonly string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, SessionTensorLike>>;
};

export type QueryEmbeddingRuntime = {
  encodeQuery: (query: string) => Promise<Float32Array>;
};

export async function createBgeM3Runtime({
  modelPath,
  tokenizerPath,
  tokenizerConfigPath,
  maxTokens = 512,
  loadTokenizer = defaultLoadTokenizer,
  loadSession = defaultLoadSession,
}: {
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath: string;
  maxTokens?: number;
  loadTokenizer?: (paths: {
    tokenizerPath: string;
    tokenizerConfigPath: string;
  }) => Promise<TokenizerLike>;
  loadSession?: (path: string) => Promise<SessionLike>;
}): Promise<QueryEmbeddingRuntime> {
  const missing = await collectMissingPaths([modelPath, tokenizerPath, tokenizerConfigPath]);
  if (missing.length > 0) {
    throw new Error(`Local semantic model assets are missing: ${missing.join(", ")}`);
  }

  const [tokenizer, session] = await Promise.all([
    loadTokenizer({ tokenizerPath, tokenizerConfigPath }),
    loadSession(modelPath),
  ]);

  return {
    async encodeQuery(query: string) {
      const encoded = await tokenizer.encode(query);
      const ids = encoded.ids.slice(0, maxTokens);
      const attentionMask = encoded.attentionMask.slice(0, maxTokens);
      const typeIds = (encoded.typeIds ?? new Array(ids.length).fill(0)).slice(0, maxTokens);

      const feeds: Record<string, unknown> = {
        input_ids: toBigIntTensor(ids),
        attention_mask: toBigIntTensor(attentionMask),
      };

      if (session.inputNames?.includes("token_type_ids")) {
        feeds.token_type_ids = toBigIntTensor(typeIds);
      }

      const outputs = await session.run(feeds);
      const embedding = resolveEmbedding(outputs, attentionMask);
      return normalizeVector(embedding);
    },
  };
}

async function defaultLoadTokenizer({
  tokenizerPath,
  tokenizerConfigPath,
}: {
  tokenizerPath: string;
  tokenizerConfigPath: string;
}): Promise<TokenizerLike> {
  const tokenizersModule = (await import("@huggingface/tokenizers")) as {
    Tokenizer: new (tokenizer: object, config: object) => {
      encode: (text: string) => {
        ids: number[];
        attention_mask: number[];
        token_type_ids?: number[];
      };
    };
  };

  const [tokenizerJson, tokenizerConfigJson] = await Promise.all([
    readFile(tokenizerPath, "utf8").then((text) => JSON.parse(text) as object),
    readFile(tokenizerConfigPath, "utf8").then((text) => JSON.parse(text) as object),
  ]);
  const tokenizer = new tokenizersModule.Tokenizer(tokenizerJson, tokenizerConfigJson);
  return {
    async encode(text: string) {
      const encoded = await tokenizer.encode(text);
      return {
        ids: encoded.ids,
        attentionMask: encoded.attention_mask,
        typeIds: encoded.token_type_ids,
      };
    },
  };
}

async function defaultLoadSession(path: string): Promise<SessionLike> {
  const ort = (await import("onnxruntime-node")) as unknown as {
    InferenceSession: {
      create: (inputPath: string) => Promise<SessionLike>;
    };
  };

  return ort.InferenceSession.create(path);
}

function resolveEmbedding(
  outputs: Record<string, SessionTensorLike>,
  attentionMask: number[],
) {
  const sentenceEmbedding =
    outputs.sentence_embedding ??
    outputs.dense_vecs ??
    outputs.embeddings;

  if (sentenceEmbedding) {
    return sentenceEmbedding.data.slice(0, sentenceEmbedding.dims.at(-1) ?? sentenceEmbedding.data.length);
  }

  const hiddenState = outputs.last_hidden_state;
  if (!hiddenState) {
    throw new Error("Semantic model output did not contain a supported embedding tensor");
  }

  const [, sequenceLength, hiddenSize] = hiddenState.dims;
  const pooled = new Float32Array(hiddenSize);
  let tokenCount = 0;

  for (let tokenIndex = 0; tokenIndex < sequenceLength; tokenIndex += 1) {
    if (!attentionMask[tokenIndex]) {
      continue;
    }

    tokenCount += 1;
    for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
      const flatIndex = tokenIndex * hiddenSize + hiddenIndex;
      pooled[hiddenIndex] += hiddenState.data[flatIndex];
    }
  }

  if (tokenCount === 0) {
    return pooled;
  }

  for (let index = 0; index < pooled.length; index += 1) {
    pooled[index] /= tokenCount;
  }

  return pooled;
}

function toBigIntTensor(values: number[]) {
  return {
    data: BigInt64Array.from(values.map((value) => BigInt(value))),
    dims: [1, values.length],
    type: "int64",
  };
}

async function collectMissingPaths(paths: string[]) {
  const checks = await Promise.all(
    paths.map(async (path) => ({
      path,
      exists: await pathExists(path),
    })),
  );

  return checks.filter((entry) => !entry.exists).map((entry) => entry.path);
}

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
