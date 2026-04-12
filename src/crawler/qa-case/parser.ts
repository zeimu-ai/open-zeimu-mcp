import { createHash } from "node:crypto";

import type { SourceType } from "../../types/index.js";
import { toAbsoluteQaCaseUrl } from "./url-policy.js";

type ParseQaCasePageOptions = {
  html: string;
  url: string;
  crawledAt: string;
};

type QaCaseMetadata = {
  id: string;
  title: string;
  category: string;
  category_path: string | null;
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
  tags: string[];
  etag: string | null;
  last_modified: string | null;
};

export type ParsedQaCase = {
  document: {
    id: string;
    title: string;
    category: string;
    categoryPath: string | null;
    canonicalUrl: string;
    sourceType: "qa_case";
    aliases: string[];
    headings: string[];
    metadata: Omit<QaCaseMetadata, "version" | "content_hash" | "etag" | "last_modified"> & {
      source_type: "qa_case";
    };
  };
  markdown: string;
  meta: QaCaseMetadata;
};

export function parseQaCasePage({
  html,
  url,
  crawledAt,
}: ParseQaCasePageOptions): ParsedQaCase {
  const parsedUrl = new URL(url);
  const category = extractCategory(parsedUrl.pathname);
  const caseCode = extractCaseCode(parsedUrl.pathname);
  const id = `qa-${category}-${caseCode}`;
  const bodyArea = extractBodyArea(html);
  const title = extractTagText(bodyArea, "h1");

  if (!title) {
    throw new Error(`Failed to parse title from ${url}`);
  }

  const categoryPath = extractCategoryPath(bodyArea);
  const cleanedBodyArea = stripDecorations(bodyArea);
  const bodyWithAbsoluteLinks = absolutizeLinks(cleanedBodyArea, url);
  const headings = extractHeadingTexts(bodyWithAbsoluteLinks);
  const markdown = convertHtmlToMarkdown(bodyWithAbsoluteLinks, title);
  const contentHash = createContentHash(markdown);
  const citation = extractSectionText(bodyWithAbsoluteLinks, "【関係法令通達】");
  const tags = [categoryPath].filter((value): value is string => Boolean(value));
  const aliases = [title, caseCode];
  const license = "国税庁 質疑応答事例（CC-BY 4.0 互換）";

  return {
    document: {
      id,
      title,
      category,
      categoryPath,
      canonicalUrl: url,
      sourceType: "qa_case",
      aliases,
      headings: [title, ...headings],
      metadata: {
        id,
        title,
        category,
        category_path: categoryPath,
        canonical_url: url,
        source_type: "qa_case",
        crawled_at: crawledAt,
        updated_at: null,
        published_at: null,
        license,
        aliases,
        headings: [title, ...headings],
        citation,
        document_number: caseCode,
        tags,
      },
    },
    markdown,
    meta: {
      id,
      title,
      category,
      category_path: categoryPath,
      canonical_url: url,
      source_type: "qa_case",
      crawled_at: crawledAt,
      updated_at: null,
      published_at: null,
      content_hash: contentHash,
      license,
      version: 1,
      aliases,
      headings: [title, ...headings],
      citation,
      document_number: caseCode,
      tags,
      etag: null,
      last_modified: null,
    },
  };
}

export function composeQaCaseMarkdown({
  document,
  bodyMarkdown,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedQaCase["document"];
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
    document.categoryPath === null
      ? "category_path: null"
      : `category_path: ${quoteYamlString(document.categoryPath)}`,
    `canonical_url: ${document.canonicalUrl}`,
    "source_type: qa_case",
    "published_at: null",
    "updated_at: null",
    `crawled_at: ${crawledAt}`,
    `content_hash: ${contentHash}`,
    `license: ${quoteYamlString("国税庁 質疑応答事例（CC-BY 4.0 互換）")}`,
    `version: ${version}`,
    `aliases: [${document.aliases.map((alias) => quoteYamlString(alias)).join(", ")}]`,
    "---",
  ];

  return `${frontmatterLines.join("\n")}\n\n${bodyMarkdown.trim()}\n`;
}

function createContentHash(markdown: string) {
  return `sha256:${createHash("sha256").update(markdown).digest("hex")}`;
}

function extractCategory(pathname: string) {
  const match = pathname.match(/\/law\/shitsugi\/([^/]+)\//u);

  if (!match) {
    throw new Error(`Unexpected qa_case category pathname: ${pathname}`);
  }

  return match[1];
}

function extractCaseCode(pathname: string) {
  const match = pathname.match(/\/([0-9]{2})\/([0-9]{2})\.htm$/u);

  if (!match) {
    throw new Error(`Unexpected qa_case pathname: ${pathname}`);
  }

  return `${match[1]}-${match[2]}`;
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

function extractCategoryPath(html: string) {
  const matches = Array.from(
    html.matchAll(/<li[^>]*>\s*<a[^>]*href="\/law\/shitsugi\/[^"]+\/01\.htm"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/giu),
    (match) => normalizeText(stripAllTags(match[1] ?? "")),
  ).filter(Boolean);

  return matches.at(-1) ?? null;
}

function stripDecorations(html: string) {
  return html
    .replace(/<ol[^>]*class="breadcrumb"[^>]*>[\s\S]*?<\/ol>/giu, "")
    .replace(/<p[^>]*class="skip"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="page-top-link"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="red"[^>]*>[\s\S]*?<\/p>/giu, "")
    .trim();
}

function extractHeadingTexts(html: string) {
  return Array.from(
    html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu),
    (match) => normalizeText(stripAllTags(match[2] ?? "")),
  )
    .filter(Boolean)
    .filter((heading) => !heading.startsWith("【注記"));
}

function extractSectionText(html: string, heading: string) {
  const escaped = escapeRegExp(heading);
  const match = html.match(
    new RegExp(`<h2[^>]*>\\s*${escaped}\\s*</h2>\\s*<p[^>]*>([\\s\\S]*?)</p>`, "iu"),
  );

  return match?.[1] ? normalizeText(stripAllTags(match[1])) : null;
}

function convertHtmlToMarkdown(html: string, title: string) {
  let working = html;

  working = working.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu, (_match, level, inner) => {
    const text = normalizeText(stripAllTags(inner));
    return `\n${"#".repeat(Number(level))} ${text}\n`;
  });
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
    return toAbsoluteQaCaseUrl(href, "https://www.nta.go.jp/law/shitsugi/01.htm");
  } catch {
    return new URL(href, "https://www.nta.go.jp/law/shitsugi/01.htm").toString();
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
