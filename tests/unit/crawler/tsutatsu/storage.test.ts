import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseTsutatsuPage } from "../../../../src/crawler/tsutatsu/parser.js";
import {
  buildTsutatsuMarkdownPath,
  buildTsutatsuMetadataPath,
  writeTsutatsuDocument,
} from "../../../../src/crawler/tsutatsu/storage.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <p align="center"><strong>第1編　総則</strong></p>
      <p align="center"><strong>第1章　通則</strong></p>
      <div class="page-header" id="page-top"><h1>〔居住者、非永住者及び非居住者（第3、4、5号関係）〕</h1></div>
      <h2>（住所の意義）</h2>
      <p>内容です。</p>
    </div>
  </body>
</html>`;

describe("writeTsutatsuDocument", () => {
  it("writes markdown and meta.json to data/tsutatsu/<id>/", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-tsutatsu-"));
    const dataDir = join(workspace, "data");
    const parsed = parseTsutatsuPage({
      html: fixtureHtml,
      url: "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    await writeTsutatsuDocument({
      dataDir,
      parsed,
      contentHash: parsed.meta.content_hash,
      crawledAt: "2026-04-12T01:00:00.000Z",
      version: 1,
      eTag: '"tsu-etag"',
      lastModified: "Sat, 12 Apr 2026 01:00:00 GMT",
    });

    const markdown = await readFile(buildTsutatsuMarkdownPath(dataDir, parsed.document.id), "utf8");
    const metadata = JSON.parse(
      await readFile(buildTsutatsuMetadataPath(dataDir, parsed.document.id), "utf8"),
    ) as { id: string; version: number; etag: string };

    expect(markdown).toContain('id: "tsutatsu-shotoku-01-01"');
    expect(markdown).toContain("source_type: tsutatsu");
    expect(markdown).toContain("# 〔居住者、非永住者及び非居住者（第3、4、5号関係）〕");
    expect(metadata).toMatchObject({
      id: "tsutatsu-shotoku-01-01",
      version: 1,
      etag: '"tsu-etag"',
    });
  });
});
