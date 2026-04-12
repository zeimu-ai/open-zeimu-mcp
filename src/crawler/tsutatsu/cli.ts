import { resolve } from "node:path";

import { createLogger } from "../../lib/logger.js";
import { crawlTsutatsu } from "./crawler.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger({
    embeddingBackend: "none",
    logLevel: args.verbose ? "debug" : "info",
    dataDir: args.dataDir,
    vectorsCacheDir: "~/.cache/open-zeimu-mcp/vectors",
    onnxModelFileName: "bge-m3-int8.onnx.tar.gz",
    tokenizerFileName: "tokenizer.json",
    tokenizerConfigFileName: "tokenizer_config.json",
    embeddingChunkSize: 512,
    embeddingChunkOverlap: 64,
    embeddingMaxTokens: 512,
  });

  const result = await crawlTsutatsu({
    dataDir: args.dataDir,
    repoDir: args.repoDir,
    apply: args.apply,
    dryRun: !args.apply,
    limit: args.limit,
    ids: args.ids,
    logger: logger as unknown as Pick<Console, "info" | "warn" | "error">,
  });

  logger.info(
    {
      discoveredCount: result.discoveredCount,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      unchangedCount: result.unchangedCount,
    },
    "tsutatsu crawl finished",
  );
}

function parseArgs(argv: string[]) {
  const idsArgument = readFlag(argv, "--ids");
  const limitArgument = readFlag(argv, "--limit");
  const dataDir = resolve(readFlag(argv, "--data-dir") ?? "./data");
  const repoDir = resolve(readFlag(argv, "--repo-dir") ?? process.cwd());
  const apply = argv.includes("--apply");
  const verbose = argv.includes("--verbose");

  return {
    ids: idsArgument ? idsArgument.split(",").map((value) => value.trim()).filter(Boolean) : [],
    limit: limitArgument ? Number.parseInt(limitArgument, 10) : null,
    dataDir,
    repoDir,
    apply,
    verbose,
  };
}

function readFlag(argv: string[], flag: string) {
  const index = argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  return argv[index + 1] ?? null;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
