import { createHash } from "node:crypto";

import type { SourceType } from "../../types/index.js";
import { toAbsoluteSaiketsuUrl } from "./url-policy.js";

type ParseSaiketsuPageOptions = {
  html: string;
  url: string;
  crawledAt: string;
  id: string;
  category: string;
  categoryCode: string;
  citation: string;
};

type SaiketsuMetadata = {
  id: string;
  title: string;
  category: string;
  category_code: string;
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

export type ParsedSaiketsu = {
  document: {
    id: string;
    title: string;
    category: string;
    canonicalUrl: string;
    sourceType: "saiketsu";
    aliases: string[];
    headings: string[];
    metadata: Omit<SaiketsuMetadata, "version" | "content_hash" | "etag" | "last_modified"> & {
      source_type: "saiketsu";
    };
  };
  markdown: string;
  meta: SaiketsuMetadata;
};

export function parseSaiketsuPage({
  html,
  url,
  crawledAt,
  id,
  category,
  categoryCode,
  citation,
}: ParseSaiketsuPageOptions): ParsedSaiketsu {
  const bodyArea = extractMainArea(html);
  const title = extractTagText(bodyArea, "h1");

  if (!title) {
    throw new Error(`Failed to parse title from ${url}`);
  }

  const cleanedBodyArea = stripDecorations(bodyArea);
  const bodyWithAbsoluteLinks = absolutizeLinks(cleanedBodyArea, url);
  const headings = extractHeadingTexts(bodyWithAbsoluteLinks);
  const markdown = convertHtmlToMarkdown(bodyWithAbsoluteLinks, title);
  const contentHash = createContentHash(markdown);
  const documentNumber = extractDocumentNumber(url);
  const publishedAt =
    extractPublishedAt(html) ?? extractPublishedAtFromText(title) ?? extractPublishedAtFromText(citation);
  const aliases = uniqueStrings(
    [title, documentNumber, citation].filter((value): value is string => Boolean(value)),
  );
  const tags = uniqueStrings([
    category,
    ...extractTagHints(title),
    ...extractTagHints(citation),
    ...extractTagHints(markdown),
  ]);

  return {
    document: {
      id,
      title,
      category,
      canonicalUrl: url,
      sourceType: "saiketsu",
      aliases,
      headings: mergeTitleIntoHeadings(title, headings),
      metadata: {
        id,
        title,
        category,
        category_code: categoryCode,
        canonical_url: url,
        source_type: "saiketsu",
        crawled_at: crawledAt,
        updated_at: null,
        published_at: publishedAt,
        license: "国税不服審判所 公表裁決事例（利用規約に従って再配布）",
        aliases,
        headings: mergeTitleIntoHeadings(title, headings),
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
      category_code: categoryCode,
      canonical_url: url,
      source_type: "saiketsu",
      crawled_at: crawledAt,
      updated_at: null,
      published_at: publishedAt,
      content_hash: contentHash,
      license: "国税不服審判所 公表裁決事例（利用規約に従って再配布）",
      version: 1,
      aliases,
      headings: mergeTitleIntoHeadings(title, headings),
      citation,
      document_number: documentNumber,
      tags,
      etag: null,
      last_modified: null,
    },
  };
}

export function composeSaiketsuMarkdown({
  document,
  bodyMarkdown,
  contentHash,
  crawledAt,
  version,
}: {
  document: ParsedSaiketsu["document"];
  bodyMarkdown: string;
  contentHash: string;
  crawledAt: string;
  version: number;
}) {
  const frontmatterLines = [
    "---",
    `id: ${quoteYamlString(document.id)}`,
    `title: ${quoteYamlString(document.title)}`,
    `category: ${quoteYamlString(document.category)}`,
    `canonical_url: ${quoteYamlString(document.canonicalUrl)}`,
    "source_type: saiketsu",
    `published_at: ${document.metadata.published_at === null ? "null" : quoteYamlString(document.metadata.published_at)}`,
    "updated_at: null",
    `crawled_at: ${quoteYamlString(crawledAt)}`,
    `content_hash: ${quoteYamlString(contentHash)}`,
    `license: ${quoteYamlString("国税不服審判所 公表裁決事例（利用規約に従って再配布）")}`,
    `version: ${version}`,
    `aliases: [${document.aliases.map((alias) => quoteYamlString(alias)).join(", ")}]`,
    "---",
  ];

  return `${frontmatterLines.join("\n")}\n\n${bodyMarkdown.trim()}\n`;
}

function createContentHash(markdown: string) {
  return `sha256:${createHash("sha256").update(markdown).digest("hex")}`;
}

function extractMainArea(html: string) {
  const startTagMatch = html.match(/<div[^>]+id="main"[^>]*>/iu);

  if (!startTagMatch || startTagMatch.index === undefined) {
    throw new Error("Failed to locate #main");
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

  throw new Error("Failed to parse closing boundary for #main");
}

function extractTagText(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "iu"));
  return match?.[1] ? normalizeText(stripAllTags(match[1])) : null;
}

function stripDecorations(html: string) {
  return html
    .replace(/<div[^>]+id="pankuzu"[^>]*>[\s\S]*?<\/div>/giu, "")
    .replace(/<p[^>]*class="blockskip"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="pagetop"[^>]*>[\s\S]*?<\/p>/giu, "")
    .replace(/<p[^>]*class="red"[^>]*>[\s\S]*?<\/p>/giu, "")
    .trim();
}

function absolutizeLinks(html: string, base: string) {
  return html.replace(/<a([^>]*?)href="([^"]+)"([^>]*)>/giu, (_match, before, href, after) => {
    const absolute = new URL(href, base).toString();
    return `<a${before}href="${absolute}"${after}>`;
  });
}

function extractHeadingTexts(html: string) {
  return Array.from(
    html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu),
    (match) => normalizeText(stripAllTags(match[2] ?? "")),
  )
    .filter(Boolean)
    .filter((heading) => !heading.startsWith("トップ"))
    .filter((heading) => heading !== "《裁決書（抄）》");
}

function convertHtmlToMarkdown(html: string, title: string) {
  let working = html;

  working = working.replace(/<table[^>]*>([\s\S]*?)<\/table>/giu, (_match, inner) => {
    const table = convertTable(inner);
    return table ? `\n${table}\n` : "\n";
  });
  working = working.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu, (_match, level, inner) => {
    const text = normalizeText(stripAllTags(inner));
    return text ? `\n${"#".repeat(Number(level))} ${text}\n` : "\n";
  });
  working = working.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/giu, (_match, inner) => `\n${convertList(inner)}\n`);
  working = working.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/giu, (_match, inner) => `\n${convertList(inner)}\n`);
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

function convertTable(tableHtml: string) {
  const rows = Array.from(
    tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu),
    (rowMatch) => {
      const rowHtml = rowMatch[1] ?? "";
      const cells = Array.from(
        rowHtml.matchAll(/<(t[hd])[^>]*>([\s\S]*?)<\/t[hd]>/giu),
        (cellMatch) => normalizeText(convertInline(cellMatch[2] ?? "")),
      );

      return cells.filter(Boolean);
    },
  ).filter((row) => row.length > 0);

  if (rows.length === 0) {
    return "";
  }

  const header = rows.find((row, index) => index === 0 && row.length > 0) ?? rows[0];
  const bodyRows = rows.slice(1);
  const headerLine = `| ${header.join(" | ")} |`;
  const separatorLine = `| ${header.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((row) => `| ${row.join(" | ")} |`);

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

function convertInline(fragment: string) {
  const withLinks = fragment.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu, (_match, href, text) => {
    const label = normalizeText(stripAllTags(text));
    const absoluteUrl = toAbsoluteSaiketsuUrl(href, "https://www.kfs.go.jp/service/MP/01/index.html");
    return label ? `[${label}](${absoluteUrl})` : absoluteUrl;
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

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function mergeTitleIntoHeadings(title: string, headings: string[]) {
  if (!title) {
    return headings;
  }

  if (headings[0] === title) {
    return headings;
  }

  return [title, ...headings];
}

function extractDocumentNumber(url: string) {
  const match = url.match(/\/service\/JP\/(\d+)\/(\d+)\/index\.html$/u);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function extractPublishedAt(html: string) {
  const match = html.match(/<p[^>]*class="article_date"[^>]*>([\s\S]*?)<\/p>/iu);
  const text = match?.[1] ? normalizeText(stripAllTags(match[1])) : null;
  return text ? extractPublishedAtFromText(text) : null;
}

function extractPublishedAtFromText(text: string | null) {
  if (!text) {
    return null;
  }

  const parsed =
    parseEraDate(text) ??
    parseEraDate(text.replace(/裁決.*$/u, "")) ??
    parseEraDate(text.replace(/[（(].*$/u, ""));

  return parsed;
}

function parseEraDate(text: string) {
  const normalized = text
    .replace(/[　\s]+/gu, " ")
    .replace(/[．。]/gu, ".")
    .replace(/[０-９]/gu, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .trim();
  const match = normalized.match(
    /(令和|平成|昭和|大正|明治|令|平|昭|大|明)\s*(元|\d+)[\.年](\d+)[\.月](\d+)(?:[\.日]|日)?/u,
  );

  if (!match) {
    return null;
  }

  const era = normalizeEra(match[1] ?? "");
  const yearText = match[2] ?? "";
  const monthText = match[3] ?? "";
  const dayText = match[4] ?? "";
  const eraYear = yearText === "元" ? 1 : Number.parseInt(yearText, 10);
  const baseYear = {
    明治: 1867,
    大正: 1911,
    昭和: 1925,
    平成: 1988,
    令和: 2018,
  }[era];

  if (!baseYear || Number.isNaN(eraYear)) {
    return null;
  }

  const year = baseYear + eraYear;
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function normalizeEra(value: string) {
  switch (value) {
    case "令":
      return "令和";
    case "平":
      return "平成";
    case "昭":
      return "昭和";
    case "大":
      return "大正";
    case "明":
      return "明治";
    default:
      return value;
  }
}

function extractTagHints(text: string) {
  const hints = new Set<string>();

  for (const value of [
    "所得税",
    "法人税",
    "消費税",
    "相続税",
    "贈与税",
    "国税通則法",
    "国税徴収法",
    "不服審査",
    "附帯税",
    "相続",
    "譲渡所得",
    "立退料",
    "インボイス",
  ]) {
    if (text.includes(value)) {
      hints.add(value);
    }
  }

  return [...hints];
}
