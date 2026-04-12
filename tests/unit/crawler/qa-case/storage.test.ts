import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseQaCasePage } from "../../../../src/crawler/qa-case/parser.js";
import {
  buildQaCaseMarkdownPath,
  buildQaCaseMetadataPath,
  writeQaCaseDocument,
} from "../../../../src/crawler/qa-case/storage.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/law/shitsugi/hojin/01.htm">法人税</a></li>
      </ol>
      <div class="page-header" id="page-top"><h1>共有地の分割</h1></div>
      <h2>【照会要旨】</h2>
      <p>共有地の分割は譲渡に該当しないものとして差し支えありませんか。</p>
      <h2>【回答要旨】</h2>
      <p>合理的に行われている場合には譲渡に該当しません。</p>
      <h2>【関係法令通達】</h2>
      <p>法人税基本通達2-1-19</p>
    </div>
  </body>
</html>`;

describe("writeQaCaseDocument", () => {
  it("writes markdown and meta.json to data/qa_case/<id>/", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-qa-case-"));
    const dataDir = join(workspace, "data");
    const parsed = parseQaCasePage({
      html: fixtureHtml,
      url: "https://www.nta.go.jp/law/shitsugi/hojin/01/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    await writeQaCaseDocument({
      dataDir,
      parsed,
      contentHash: parsed.meta.content_hash,
      crawledAt: "2026-04-12T01:00:00.000Z",
      version: 1,
      eTag: '"qa-etag"',
      lastModified: "Sat, 12 Apr 2026 01:00:00 GMT",
    });

    const markdown = await readFile(buildQaCaseMarkdownPath(dataDir, parsed.document.id), "utf8");
    const metadata = JSON.parse(
      await readFile(buildQaCaseMetadataPath(dataDir, parsed.document.id), "utf8"),
    ) as { id: string; version: number; etag: string };

    expect(markdown).toContain('id: "qa-hojin-01-01"');
    expect(markdown).toContain("source_type: qa_case");
    expect(markdown).toContain("# 共有地の分割");
    expect(metadata).toMatchObject({
      id: "qa-hojin-01-01",
      version: 1,
      etag: '"qa-etag"',
    });
  });
});
