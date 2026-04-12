import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type ReleasePlan = {
  version: string;
  outputDir: string;
  assets: {
    model: string;
    vectors: string;
  };
  placeholders: {
    model: string;
    vectors: string;
  };
};

async function main() {
  const version = process.argv[2] ?? process.env.npm_package_version ?? "0.0.0";
  const outputDir = resolve(process.argv[3] ?? "artifacts/vectors");

  const plan = buildReleasePlan({ version, outputDir });

  await mkdir(plan.placeholders.model, { recursive: true });
  await mkdir(plan.placeholders.vectors, { recursive: true });
  await writeFile(
    join(plan.placeholders.model, ".gitkeep"),
    "placeholder for bge-m3 release asset directory\n",
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
      `vector_asset=${plan.assets.vectors}`,
      "The actual ONNX model and vector binary are intentionally excluded from git.",
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
      vectors: `tax-answer-vectors-${version}.bin`,
    },
    placeholders: {
      model: join(outputDir, "placeholders", "model"),
      vectors: join(outputDir, "placeholders", "vectors"),
    },
  };
}

main().catch((error) => {
  console.error("[release-vectors] fatal:", error);
  process.exit(1);
});
