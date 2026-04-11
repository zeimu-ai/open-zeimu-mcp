import { createHash } from "node:crypto";

import type { SourceType } from "../../types/index.js";
import { toAbsoluteTaxAnswerUrl } from "./url-policy.js";

type ParseTaxAnswerHtmlOptions = {
  html: string;
  url: string;
  crawledAt: string;
};

type TaxAnswerMetadata = {
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
  license: "public_data";
  version: number;
  aliases: string[];
  headings: string[];
  etag: string | null;
  last_modified: string | null;
};

export type ParsedTaxAnswer = {
  document: {
    id: string;
    title: string;
    category: string;
    categoryPath: string | null;
    canonicalUrl: string;
    sourceType: "tax_answer";
    aliases: string[];
    headings: string[];
    metadata: Omit<TaxAnswerMetadata, "version" | "content_hash" | "etag" | "last_modified"> & {
      source_type: "tax_answer";
    };
  };
  markdown: string;
  meta: TaxAnswerMetadata;
};

export function parseTaxAnswerHtml({
  html,
  url,
  crawledAt,
}: ParseTaxAnswerHtmlOptions): ParsedTaxAnswer {
  const parsedUrl = new URL(url);
  const id = extractId(parsedUrl.pathname);
  const category = extractCategory(parsedUrl.pathname);
  const bodyArea = extractBodyArea(html);
  const rawTitle = extractTagText(bodyArea, "h1");

  if (!rawTitle) {
    throw new Error(`Failed to parse title from ${url}`);
  }

  const title = stripTaxAnswerNumber(rawTitle, id);
  const categoryPath = extractTaxCategory(bodyArea);
  const bodyWithoutDecorations = stripDecorations(bodyArea);
  const bodyWithAbsoluteLinks = absolutizeLinks(bodyWithoutDecorations, url);
  const headings = extractHeadingTexts(bodyWithAbsoluteLinks).map((heading, index) =>
    index === 0 ? stripTaxAnswerNumber(heading, id) : heading,
  );
  const markdownBody = convertHtmlToMarkdown(bodyWithAbsoluteLinks, { id, title });
  const contentHash = createContentHash(markdownBody);
  const aliases = [`No.${id} ${title}`, `${id} ${title}`];

  return {
    document: {
      id,
      title,
      category,
      categoryPath,
      canonicalUrl: url,
      sourceType: "tax_answer",
      aliases,
      headings,
      metadata: {
        id,
        title,
        category,
        category_path: categoryPath,
        canonical_url: url,
        source_type: "tax_answer",
        crawled_at: crawledAt,
        updated_at: null,
        published_at: null,
        license: "public_data",
        aliases,
        headings,
      },
    },
    markdown: markdownBody,
    meta: {
      id,
      title,
      category,
      category_path: categoryPath,
      canonical_url: url,
      source_type: "tax_answer",
      crawled_at: crawledAt,
      updated_at: null,
      published_at: null,
      content_hash: contentHash,
      license: "public_data",
      version: 1,
      aliases,
      headings,
      etag: null,
      last_modified: null,
    },
  };
}

export function renderTaxAnswerMarkdown({
  document,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedTaxAnswer["document"];
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
    "source_type: tax_answer",
    "published_at: null",
    "updated_at: null",
    `crawled_at: ${crawledAt}`,
    `content_hash: ${contentHash}`,
    "license: public_data",
    `version: ${version}`,
    `aliases: [${document.aliases.map((alias) => quoteYamlString(alias)).join(", ")}]`,
    "---",
  ];

  return `${frontmatterLines.join("\n")}\n\n${renderHeadingBody(document.title, document.headings)}`;
}

function renderHeadingBody(title: string, headings: string[]) {
  void headings;
  return `# ${title}`;
}

export function composeTaxAnswerMarkdown({
  document,
  bodyMarkdown,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedTaxAnswer["document"];
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
    "source_type: tax_answer",
    "published_at: null",
    "updated_at: null",
    `crawled_at: ${crawledAt}`,
    `content_hash: ${contentHash}`,
    "license: public_data",
    `version: ${version}`,
    `aliases: [${document.aliases.map((alias) => quoteYamlString(alias)).join(", ")}]`,
    "---",
  ];

  return `${frontmatterLines.join("\n")}\n\n${bodyMarkdown.trim()}\n`;
}

function createContentHash(markdown: string) {
  return `sha256:${createHash("sha256").update(markdown).digest("hex")}`;
}

function extractId(pathname: string) {
  const match = pathname.match(/\/([^/]+)\.htm$/u);

  if (!match) {
    throw new Error(`Unexpected tax answer pathname: ${pathname}`);
  }

  return match[1];
}

function extractCategory(pathname: string) {
  const match = pathname.match(/\/taxanswer\/([^/]+)\//u);

  if (!match) {
    throw new Error(`Unexpected tax answer category pathname: ${pathname}`);
  }

  return match[1];
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

function stripTaxAnswerNumber(value: string, id: string) {
  return normalizeText(value.replace(new RegExp(`^No\\.?\\s*${escapeRegExp(id)}\\s*`, "iu"), ""));
}

function extractTaxCategory(html: string) {
  const match = html.match(/<h2[^>]*>\s*対象税目\s*<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/iu);
  return match?.[1] ? normalizeText(stripAllTags(match[1])) : null;
}

function stripDecorations(html: string) {
  return html
    .replace(/<ol[^>]*class="breadcrumb"[^>]*>[\s\S]*?<\/ol>/giu, "")
    .replace(/<p[^>]*class="skip"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<div[^>]*class="contents-feedback"[^>]*>[\s\S]*?<\/div>/giu, "")
    .replace(/<p>\s*\[[^\]]+\]\s*<\/p>/giu, "")
    .trim();
}

function extractHeadingTexts(html: string) {
  return Array.from(
    html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu),
    (match) => normalizeText(stripAllTags(match[2] ?? "")),
  ).filter(Boolean);
}

function convertHtmlToMarkdown(html: string, { id, title }: { id: string; title: string }) {
  let working = html;

  working = working.replace(/<table[\s\S]*?<\/table>/giu, (table) => `\n\n${convertTable(table)}\n\n`);
  working = working.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/giu, (_match, inner) => `\n${convertList(inner)}\n`);
  working = working.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu, (_match, level, inner) => {
    const text = normalizeText(stripAllTags(inner));
    const normalized = Number(level) === 1 ? stripTaxAnswerNumber(text, id) : text;
    return `\n${"#".repeat(Number(level))} ${normalized}\n`;
  });
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
    const text = convertInline(match[1] ?? "").replace(/^\d[\d-]*\s+/u, "");
    return text ? `- ${text}` : "";
  })
    .filter(Boolean)
    .join("\n");
}

function convertTable(tableHtml: string) {
  const rowMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu), (match) => match[1] ?? "");
  const rows = rowMatches
    .map((row) =>
      Array.from(row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/giu), (cell) =>
        convertInline(cell[1] ?? ""),
      ),
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    return "";
  }

  const [header, ...body] = rows;
  const separator = header.map(() => "---");
  const lines = [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`);

  return lines.join("\n");
}

function convertInline(fragment: string) {
  const withLinks = fragment.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu, (_match, href, text) => {
    const label = normalizeText(stripAllTags(text));
    const absoluteUrl = toAbsoluteTaxAnswerUrl(href, "https://www.nta.go.jp/taxes/shiraberu/taxanswer/index2.htm");
    return `[${label}](${absoluteUrl})`;
  });

  return normalizeText(stripAllTags(withLinks, { preserveMarkdownLinks: true }));
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
    if (/^(mailto:|tel:|javascript:)/iu.test(href)) {
      return `<a${before}href="${href}"${after}>`;
    }

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
