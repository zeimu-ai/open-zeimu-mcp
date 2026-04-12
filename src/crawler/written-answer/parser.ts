import { createHash } from "node:crypto";

import type { SourceType } from "../../types/index.js";
import { toAbsoluteWrittenAnswerUrl } from "./url-policy.js";

const WRITTEN_ANSWER_LICENSE = "国税庁 文書回答事例（利用規約に従って再配布）";

type ParseWrittenAnswerPageOptions = {
  html: string;
  url: string;
  crawledAt: string;
};

type WrittenAnswerMetadata = {
  id: string;
  title: string;
  category: string;
  canonical_url: string;
  source_type: SourceType;
  crawled_at: string;
  updated_at: string | null;
  published_at: string | null;
  content_hash: string;
  license: string;
  version: number;
  aliases: string[];
  headings: string[];
  citation: string | null;
  document_number: string | null;
  page_offsets: number[];
  etag: string | null;
  last_modified: string | null;
};

export type ParsedWrittenAnswer = {
  document: {
    id: string;
    title: string;
    category: string;
    canonicalUrl: string;
    sourceType: "written_answer";
    aliases: string[];
    headings: string[];
    pageOffsets: number[];
    metadata: Omit<WrittenAnswerMetadata, "version" | "content_hash" | "etag" | "last_modified"> & {
      source_type: "written_answer";
    };
  };
  markdown: string;
  meta: WrittenAnswerMetadata;
};

export function parseWrittenAnswerPage({
  html,
  url,
  crawledAt,
}: ParseWrittenAnswerPageOptions): ParsedWrittenAnswer {
  const parsedUrl = new URL(url);
  const category = extractCategory(parsedUrl.pathname);
  const documentNumber = extractDocumentNumber(parsedUrl.pathname);
  const id = `bunshokaito-${category}-${documentNumber}`;
  const bodyArea = extractBodyArea(html);
  const title = extractTagText(bodyArea, "h1");

  if (!title) {
    throw new Error(`Failed to parse title from ${url}`);
  }

  const citation = extractCitation(bodyArea);
  const cleanedBodyArea = stripDecorations(bodyArea);
  const bodyWithAbsoluteLinks = absolutizeLinks(cleanedBodyArea, url);
  const markdown = convertHtmlToMarkdown(bodyWithAbsoluteLinks, title);
  const contentHash = createContentHash(markdown);
  const headings = uniqueStrings([title, ...extractMarkdownHeadings(markdown)]);
  const pageOffsets: number[] = [];

  return {
    document: {
      id,
      title,
      category,
      canonicalUrl: parsedUrl.origin + parsedUrl.pathname,
      sourceType: "written_answer",
      aliases: [],
      headings,
      pageOffsets,
      metadata: {
        id,
        title,
        category,
        canonical_url: parsedUrl.origin + parsedUrl.pathname,
        source_type: "written_answer",
        crawled_at: crawledAt,
        updated_at: null,
        published_at: null,
        license: WRITTEN_ANSWER_LICENSE,
        aliases: [],
        headings,
        citation,
        document_number: documentNumber,
        page_offsets: pageOffsets,
      },
    },
    markdown,
    meta: {
      id,
      title,
      category,
      canonical_url: parsedUrl.origin + parsedUrl.pathname,
      source_type: "written_answer",
      crawled_at: crawledAt,
      updated_at: null,
      published_at: null,
      content_hash: contentHash,
      license: WRITTEN_ANSWER_LICENSE,
      version: 1,
      aliases: [],
      headings,
      citation,
      document_number: documentNumber,
      page_offsets: pageOffsets,
      etag: null,
      last_modified: null,
    },
  };
}

export function composeWrittenAnswerMarkdown({
  document,
  bodyMarkdown,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedWrittenAnswer["document"];
  bodyMarkdown: string;
  contentHash: string;
  crawledAt: string;
  version: number;
}) {
  const frontmatterLines = [
    "---",
    `id: "${document.id}"`,
    `title: ${quoteYamlString(document.title)}`,
    `category: ${document.category}`,
    `canonical_url: ${document.canonicalUrl}`,
    "source_type: written_answer",
    "published_at: null",
    "updated_at: null",
    `crawled_at: ${crawledAt}`,
    `content_hash: ${contentHash}`,
    `license: ${quoteYamlString(WRITTEN_ANSWER_LICENSE)}`,
    `version: ${version}`,
    `aliases: [${document.aliases.map((alias) => quoteYamlString(alias)).join(", ")}]`,
    `page_offsets: [${document.pageOffsets.join(", ")}]`,
    "---",
  ];

  return `${frontmatterLines.join("\n")}\n\n${bodyMarkdown.trim()}\n`;
}

function createContentHash(markdown: string) {
  return `sha256:${createHash("sha256").update(markdown).digest("hex")}`;
}

function extractCategory(pathname: string) {
  const match = pathname.match(/\/law\/bunshokaito\/([a-z0-9-]+)\//iu);

  if (!match) {
    throw new Error(`Unexpected written_answer category pathname: ${pathname}`);
  }

  return match[1];
}

function extractDocumentNumber(pathname: string) {
  const match = pathname.match(/\/law\/bunshokaito\/[a-z0-9-]+\/(.+)\.htm$/iu);

  if (!match) {
    throw new Error(`Unexpected written_answer pathname: ${pathname}`);
  }

  return match[1]
    .replace(/\/index$/iu, "")
    .replace(/\/+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function extractBodyArea(html: string) {
  const startTagMatch = html.match(/<div[^>]+id="bodyArea"[^>]*>/iu);

  if (!startTagMatch || startTagMatch.index === undefined) {
    throw new Error("Failed to locate #bodyArea");
  }

  const startIndex = startTagMatch.index + startTagMatch[0].length;
  let depth = 1;
  let cursor = startIndex;

  while (cursor < html.length) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);

    if (nextClose === -1) {
      break;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      return html.slice(startIndex, nextClose);
    }

    cursor = nextClose + 6;
  }

  throw new Error("Failed to parse closing boundary for #bodyArea");
}

function extractTagText(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "iu"));
  return match?.[1] ? normalizeText(stripAllTags(match[1])) : null;
}

function extractCitation(html: string) {
  const afterTitle = html.split(/<div class="page-header"[^>]*id="page-top"[^>]*>/iu, 2)[1] ?? html;
  const beforeInquiry = afterTitle.split(/<p[^>]*>\s*〔照会〕\s*<\/p>/iu, 1)[0] ?? afterTitle;
  const paragraphs = Array.from(
    beforeInquiry.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/giu),
    (match) => normalizeText(stripAllTags(match[1] ?? "")),
  ).filter(Boolean);

  return paragraphs.find((value) => value !== "〔照会〕" && value !== "〔回答〕") ?? null;
}

function stripDecorations(html: string) {
  return html
    .replace(/<ol[^>]*class="breadcrumb"[^>]*>[\s\S]*?<\/ol>/giu, "")
    .replace(/<p[^>]*class="skip"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="page-top-link"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="red"[^>]*>[\s\S]*?<\/p>/giu, "")
    .trim();
}

function extractMarkdownHeadings(markdown: string) {
  return Array.from(
    markdown.matchAll(/^(#{1,6})\s+(.+)$/gmu),
    (match) => normalizeText(match[2] ?? ""),
  ).filter(Boolean);
}

function convertHtmlToMarkdown(html: string, title: string) {
  let working = html;

  working = working.replace(/<p[^>]*>\s*〔照会〕\s*<\/p>/giu, "\n## 〔照会〕\n");
  working = working.replace(/<p[^>]*id="kaitou"[^>]*>\s*〔回答〕\s*<\/p>/giu, "\n## 〔回答〕\n");
  working = working.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu, (_match, level, inner) => {
    const text = normalizeText(stripAllTags(inner));
    return `\n${"#".repeat(Number(level))} ${text}\n`;
  });
  working = working.replace(/<table[^>]*>[\s\S]*?<\/table>/giu, (match) => `\n${convertTable(match)}\n`);
  working = working.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/giu, (_match, inner) => `\n${convertList(inner)}\n`);
  working = working.replace(/<p[^>]*>([\s\S]*?)<\/p>/giu, (_match, inner) => {
    const text = convertInline(inner);
    return text ? `\n${text}\n` : "\n";
  });
  working = working.replace(/<div[^>]*>|<\/div>/giu, "\n");
  working = working.replace(/<br\s*\/?>/giu, "\n");
  working = stripAllTags(working);
  working = decodeHtmlEntities(working);
  working = working.replace(/[ \t]+\n/gu, "\n");
  working = working.replace(/\n{3,}/gu, "\n\n");
  working = working.trim();

  return working.startsWith(`# ${title}`) ? working : `# ${title}\n\n${working}`;
}

function convertTable(tableHtml: string) {
  const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu), (match) => match[1] ?? "");

  return rows
    .map((row) => {
      const cells = Array.from(row.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/giu), (match) =>
        normalizeText(convertInline(match[1] ?? "")),
      ).filter(Boolean);

      return cells.length > 0 ? `| ${cells.join(" | ")} |` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function convertList(listHtml: string) {
  return Array.from(listHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/giu), (match) => {
    const text = convertInline(match[1] ?? "");
    return text ? `- ${text}` : "";
  })
    .filter(Boolean)
    .join("\n");
}

function convertInline(fragment: string) {
  const withLinks = fragment.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu, (_match, href, text) => {
    const label = normalizeText(stripAllTags(text));
    const absoluteUrl = toAbsoluteMarkdownLink(href);
    return `[${label}](${absoluteUrl})`;
  });

  return normalizeText(stripAllTags(withLinks, { preserveMarkdownLinks: true }));
}

function toAbsoluteMarkdownLink(href: string) {
  try {
    return toAbsoluteWrittenAnswerUrl(href, "https://www.nta.go.jp/law/bunshokaito/01.htm");
  } catch {
    return new URL(href, "https://www.nta.go.jp/law/bunshokaito/01.htm").toString();
  }
}

function stripAllTags(html: string, options: { preserveMarkdownLinks?: boolean } = {}) {
  const placeholderPrefix = "__MD_LINK_";
  const placeholders = new Map<string, string>();
  let working = html;

  if (options.preserveMarkdownLinks) {
    working = working.replace(/\[[^\]]+\]\([^)]+\)/gu, (match) => {
      const key = `${placeholderPrefix}${placeholders.size}__`;
      placeholders.set(key, match);
      return key;
    });
  }

  working = working.replace(/<img[^>]*alt="([^"]+)"[^>]*>/giu, "$1 ");
  working = working.replace(/<[^>]+>/gu, "");
  working = decodeHtmlEntities(working);

  for (const [key, value] of placeholders) {
    working = working.replace(key, value);
  }

  return working;
}

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t]+/gu, " ")
    .replace(/\s*\n\s*/gu, "\n")
    .replace(/\n{2,}/gu, "\n")
    .trim();
}

function absolutizeLinks(html: string, base: string) {
  return html.replace(/<a([^>]*?)href="([^"]+)"([^>]*)>/giu, (_match, before, href, after) => {
    const absolute = new URL(href, base).toString();
    return `<a${before}href="${absolute}"${after}>`;
  });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&emsp;/giu, " ")
    .replace(/&ensp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gu, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function quoteYamlString(value: string) {
  return JSON.stringify(value);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
