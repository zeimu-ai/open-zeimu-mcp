import { createHash } from "node:crypto";

import type { SourceType } from "../../types/index.js";
import { toAbsoluteTsutatsuUrl } from "./url-policy.js";

type ParseTsutatsuPageOptions = {
  html: string;
  url: string;
  crawledAt: string;
};

type TsutatsuMetadata = {
  id: string;
  title: string;
  category: string;
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
  citation: string | null;
  document_number: string | null;
  tags: string[];
  etag: string | null;
  last_modified: string | null;
};

export type ParsedTsutatsu = {
  document: {
    id: string;
    title: string;
    category: string;
    canonicalUrl: string;
    sourceType: "tsutatsu";
    aliases: string[];
    headings: string[];
    metadata: Omit<TsutatsuMetadata, "version" | "content_hash" | "etag" | "last_modified"> & {
      source_type: "tsutatsu";
    };
  };
  markdown: string;
  meta: TsutatsuMetadata;
};

export function parseTsutatsuPage({
  html,
  url,
  crawledAt,
}: ParseTsutatsuPageOptions): ParsedTsutatsu {
  const parsedUrl = new URL(url);
  const category = extractCategory(parsedUrl.pathname);
  const pageSlug = extractPageSlug(parsedUrl.pathname);
  const id = `tsutatsu-${category}-${pageSlug}`;
  const bodyArea = extractBodyArea(html);
  const title = extractPrimaryTitle(bodyArea, html);

  if (!title) {
    throw new Error(`Failed to parse title from ${url}`);
  }

  const cleanedBodyArea = stripDecorations(bodyArea);
  const bodyWithAbsoluteLinks = absolutizeLinks(cleanedBodyArea, url);
  const headings = extractHeadingTexts(bodyWithAbsoluteLinks);
  const markdown = convertHtmlToMarkdown(bodyWithAbsoluteLinks, title);
  const contentHash = createContentHash(markdown);
  const citation = extractCitation(bodyWithAbsoluteLinks);
  const documentNumber = extractDocumentNumber(bodyWithAbsoluteLinks);
  const aliases = uniqueStrings([stripOuterBrackets(title), citation, documentNumber].filter(
    (value): value is string => Boolean(value),
  ));
  const tags = uniqueStrings([categoryLabel(category), ...extractTagHints(title, citation)]);

  return {
    document: {
      id,
      title,
      category,
      canonicalUrl: parsedUrl.origin + parsedUrl.pathname,
      sourceType: "tsutatsu",
      aliases,
      headings: [title, ...headings],
      metadata: {
        id,
        title,
        category,
        canonical_url: parsedUrl.origin + parsedUrl.pathname,
        source_type: "tsutatsu",
        crawled_at: crawledAt,
        updated_at: null,
        published_at: null,
        license: "public_data",
        aliases,
        headings: [title, ...headings],
        citation,
        document_number: documentNumber,
        tags,
      },
    },
    markdown,
    meta: {
      id,
      title,
      category,
      canonical_url: parsedUrl.origin + parsedUrl.pathname,
      source_type: "tsutatsu",
      crawled_at: crawledAt,
      updated_at: null,
      published_at: null,
      content_hash: contentHash,
      license: "public_data",
      version: 1,
      aliases,
      headings: [title, ...headings],
      citation,
      document_number: documentNumber,
      tags,
      etag: null,
      last_modified: null,
    },
  };
}

export function composeTsutatsuMarkdown({
  document,
  bodyMarkdown,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedTsutatsu["document"];
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
    "source_type: tsutatsu",
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

function extractCategory(pathname: string) {
  const match = pathname.match(/\/law\/tsutatsu\/(?:kihon|kobetsu)\/([^/]+)\//u);

  if (!match) {
    throw new Error(`Unexpected tsutatsu category pathname: ${pathname}`);
  }

  return match[1];
}

function extractPageSlug(pathname: string) {
  const match = pathname.match(/\/law\/tsutatsu\/(?:kihon|kobetsu)\/[^/]+\/(.+)\.htm$/u);

  if (!match) {
    throw new Error(`Unexpected tsutatsu pathname: ${pathname}`);
  }

  return match[1].replace(/\//gu, "-");
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

function extractPrimaryTitle(bodyArea: string, html: string) {
  const h1Title = extractTagText(bodyArea, "h1");

  if (h1Title) {
    return h1Title;
  }

  const centeredStrongMatch = bodyArea.match(
    /<p[^>]*(?:align="center"|text-align:\s*center)[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/iu,
  );
  const centeredStrongTitle = centeredStrongMatch?.[1]
    ? normalizeText(stripAllTags(centeredStrongMatch[1]))
    : null;

  if (centeredStrongTitle) {
    return centeredStrongTitle;
  }

  const strongMatch = bodyArea.match(/<strong>([\s\S]*?)<\/strong>/iu);
  const strongTitle = strongMatch?.[1] ? normalizeText(stripAllTags(strongMatch[1])) : null;

  if (strongTitle) {
    return strongTitle;
  }

  return extractTagText(html, "title");
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

function extractCitation(html: string) {
  const beforeTitle = html.split(/<div class="page-header"[^>]*id="page-top"[^>]*>/iu, 1)[0] ?? html;
  const centeredLines = Array.from(
    beforeTitle.matchAll(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/giu),
    (match) => normalizeText(stripAllTags(match[1] ?? "")),
  ).filter(Boolean);

  return centeredLines.at(-1) ?? null;
}

function extractDocumentNumber(html: string) {
  const match = html.match(/<strong>\s*([0-9０-９]+(?:[－\-][0-9０-９]+)*(?:の[0-9０-９]+)?)\s*　<\/strong>/u);

  if (!match?.[1]) {
    return null;
  }

  return normalizeDocumentNumber(match[1]);
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

function absolutizeLinks(html: string, base: string) {
  return html.replace(/<a([^>]*?)href="([^"]+)"([^>]*)>/giu, (_match, before, href, after) => {
    const absolute = new URL(href, base).toString();
    return `<a${before}href="${absolute}"${after}>`;
  });
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
    return toAbsoluteTsutatsuUrl(href, "https://www.nta.go.jp/law/tsutatsu/menu.htm");
  } catch {
    return new URL(href, "https://www.nta.go.jp/law/tsutatsu/menu.htm").toString();
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

function normalizeDocumentNumber(value: string) {
  return value
    .replace(/[－―ｰ]/gu, "-")
    .replace(/[　\s]+/gu, " ")
    .trim();
}

function stripOuterBrackets(value: string) {
  return value.replace(/^〔\s*/u, "").replace(/\s*〕$/u, "");
}

function categoryLabel(category: string) {
  switch (category) {
    case "shotoku":
      return "所得税";
    case "hojin":
      return "法人税";
    case "shohi":
      return "消費税";
    case "sozoku":
      return "相続税";
    case "sake":
      return "酒税";
    default:
      return category;
  }
}

function extractTagHints(title: string, citation: string | null) {
  const hints = new Set<string>();

  for (const value of [title, citation].filter((item): item is string => Boolean(item))) {
    if (value.includes("インボイス")) {
      hints.add("インボイス");
    }

    if (value.includes("消費税")) {
      hints.add("消費税");
    }

    if (value.includes("法人税")) {
      hints.add("法人税");
    }

    if (value.includes("所得税")) {
      hints.add("所得税");
    }
  }

  return [...hints];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
