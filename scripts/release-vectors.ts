import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type ReleasePlan = {
  version: string;
  outputDir: string;
  assets: {
    model: string;
    tokenizer: string;
    tokenizerConfig: string;
    vectors: string[];
  };
  placeholders: {
    model: string;
    tokenizer: string;
    vectors: string;
  };
};

async function main() {
  const version = process.argv[2] ?? process.env.npm_package_version ?? "0.0.0";
  const outputDir = resolve(process.argv[3] ?? "artifacts/vectors");

  const plan = buildReleasePlan({ version, outputDir });

  await mkdir(plan.placeholders.model, { recursive: true });
  await mkdir(plan.placeholders.tokenizer, { recursive: true });
  await mkdir(plan.placeholders.vectors, { recursive: true });
  await writeFile(
    join(plan.placeholders.model, ".gitkeep"),
    "placeholder for bge-m3 release asset directory\n",
    "utf8",
  );
  await writeFile(
    join(plan.placeholders.tokenizer, ".gitkeep"),
    "placeholder for tokenizer asset directory\n",
    "utf8",
  );
  await writeFile(
    join(plan.placeholders.vectors, ".gitkeep"),
    "placeholder for precomputed vector release asset directory\n",
    "utf8",
  );
  await writeFile(
    join(outputDir, "release-plan.json"),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(outputDir, "README.txt"),
    [
      "Release vector asset scaffold",
      `version=${version}`,
      `model_asset=${plan.assets.model}`,
      `tokenizer_asset=${plan.assets.tokenizer}`,
      `tokenizer_config_asset=${plan.assets.tokenizerConfig}`,
      `vector_assets=${plan.assets.vectors.join(",")}`,
      "The actual ONNX model, tokenizer assets, and vector binaries are intentionally excluded from git.",
      "Upload these files to the GitHub Release that matches the package tag.",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(plan, null, 2));
}

export function buildReleasePlan({
  version,
  outputDir,
}: {
  version: string;
  outputDir: string;
}): ReleasePlan {
  return {
    version,
    outputDir,
    assets: {
      model: "bge-m3-int8.onnx.tar.gz",
      tokenizer: "tokenizer.json",
      tokenizerConfig: "tokenizer_config.json",
      vectors: [
        "tax_answer",
        "written_answer",
        "tsutatsu",
        "qa_case",
        "saiketsu",
      ].map((sourceType) => `${sourceType}-vectors-${version}.bin`),
    },
    placeholders: {
      model: join(outputDir, "placeholders", "model"),
      tokenizer: join(outputDir, "placeholders", "tokenizer"),
      vectors: join(outputDir, "placeholders", "vectors"),
    },
  };
}

main().catch((error) => {
  console.error("[release-vectors] fatal:", error);
  process.exit(1);
});
