import { randomUUID } from "node:crypto";
import slugify from "slugify";
import { samplePosts } from "../data/samplePosts.js";
import { BlogPost } from "../types.js";
import { query } from "./db.js";
import { sanitizeHtml } from "./htmlSanitizer.js";

interface GeneratedPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  author: string;
  published_at: string;
  read_time_minutes: number;
  primary_keyword: string;
  secondary_keywords: string[];
  category: string;
  rating: BlogPost["rating"];
  status: NonNullable<BlogPost["status"]>;
}

async function readGeneratedPosts(): Promise<BlogPost[]> {
  const rows = await query<GeneratedPostRow>(
    `SELECT id, title, slug, excerpt, content, cover_image, author, published_at,
            read_time_minutes, primary_keyword, secondary_keywords, category, rating, status
     FROM generated_posts
     ORDER BY published_at DESC, updated_at DESC`
  );

  return rows.map(mapGeneratedPost);
}

async function upsertGeneratedPost(post: BlogPost) {
  await query(
    `INSERT INTO generated_posts (
      id, title, slug, excerpt, content, cover_image, author, published_at,
      read_time_minutes, primary_keyword, secondary_keywords, category, rating, status, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET
      id = EXCLUDED.id,
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      content = EXCLUDED.content,
      cover_image = EXCLUDED.cover_image,
      author = EXCLUDED.author,
      published_at = EXCLUDED.published_at,
      read_time_minutes = EXCLUDED.read_time_minutes,
      primary_keyword = EXCLUDED.primary_keyword,
      secondary_keywords = EXCLUDED.secondary_keywords,
      category = EXCLUDED.category,
      rating = EXCLUDED.rating,
      status = EXCLUDED.status,
      updated_at = NOW()`,
    [
      post.id,
      post.title,
      post.slug,
      post.excerpt,
      post.content,
      post.coverImage ?? null,
      post.author,
      post.publishedAt,
      post.readTimeMinutes,
      post.primaryKeyword,
      post.secondaryKeywords,
      post.category,
      post.rating,
      post.status ?? "published"
    ]
  );
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const generatedPosts = await readGeneratedPosts();
  const generatedSlugs = new Set(generatedPosts.map((post) => post.slug));
  const visibleSamplePosts = samplePosts.filter((post) => !generatedSlugs.has(post.slug));
  return [...generatedPosts, ...visibleSamplePosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getPublicPosts(): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  return posts.filter((post) => (post.status ?? "published") === "published");
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const posts = await getPublicPosts();
  return posts.find((post) => post.slug === slug);
}

export async function getAdminPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const posts = await getAllPosts();
  return posts.find((post) => post.slug === slug);
}

export async function saveGeneratedPost(post: BlogPost): Promise<BlogPost> {
  const allSlugs = new Set((await getAllPosts()).map((item) => item.slug));
  const baseSlug = post.slug;
  let slug = baseSlug;
  let index = 2;

  while (allSlugs.has(slug)) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  const savedPost = normalizePost({ ...post, slug });
  await upsertGeneratedPost(savedPost);
  return savedPost;
}

export async function createPost(post: BlogPost): Promise<BlogPost> {
  return saveGeneratedPost(post);
}

export async function updatePost(currentSlug: string, post: BlogPost): Promise<BlogPost> {
  const generatedPosts = await readGeneratedPosts();
  const samplePost = samplePosts.find((item) => item.slug === currentSlug);
  const existing = generatedPosts.find((item) => item.slug === currentSlug) ?? samplePost;

  const postId = existing?.id ?? post.id;
  const desiredSlug = post.slug;
  const usedSlugs = new Set([
    ...generatedPosts.filter((item) => item.slug !== currentSlug).map((item) => item.slug),
    ...samplePosts.filter((item) => item.slug !== currentSlug).map((item) => item.slug)
  ]);

  let slug = desiredSlug;
  let index = 2;
  while (usedSlugs.has(slug)) {
    slug = `${desiredSlug}-${index}`;
    index += 1;
  }

  const savedPost = normalizePost({ ...post, id: postId, slug });
  if (currentSlug !== savedPost.slug) {
    await query(`DELETE FROM generated_posts WHERE slug = $1`, [currentSlug]);
  }
  await upsertGeneratedPost(savedPost);
  return savedPost;
}

export async function deletePost(slug: string): Promise<boolean> {
  const deleted = await query<{ slug: string }>(
    `DELETE FROM generated_posts
     WHERE slug = $1
     RETURNING slug`,
    [slug]
  );

  return deleted.length > 0;
}

export function createPostFromMarkdown(markdown: string, topic: string): BlogPost {
  const title = cleanInline(extractField(markdown, "SEO Title") ?? extractHeading(markdown) ?? topic);
  const excerpt = cleanInline(extractField(markdown, "Meta Description") ?? firstParagraph(markdown));
  const primaryKeyword = cleanInline(extractField(markdown, "Primary Keyword") ?? topic);
  const secondaryKeywords = parseKeywords(extractField(markdown, "Secondary Keywords"));
  const explicitSlug = extractField(markdown, "SEO URL Slug") ?? extractField(markdown, "URL Slug");
  const slug = slugify(explicitSlug ?? title, { lower: true, strict: true });
  const articleMarkdown = extractArticleBody(markdown);

  return {
    id: randomUUID(),
    title,
    slug,
    excerpt,
    content: markdownToHtml(articleMarkdown),
    author: "Maria Iordanova",
    publishedAt: new Date().toISOString().slice(0, 10),
    readTimeMinutes: estimateReadTime(articleMarkdown),
    primaryKeyword,
    secondaryKeywords,
    category: "AI Research",
    rating: extractRating(markdown),
    status: "published"
  };
}

function normalizePost(post: BlogPost): BlogPost {
  return {
    ...post,
    content: sanitizeHtml(post.content),
    status: post.status ?? "published"
  };
}

function extractField(markdown: string, label: string): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?\\s*:?\\s*(.+)`, "i"));
  return match?.[1]?.trim();
}

function extractHeading(markdown: string): string | undefined {
  const heading = markdown.match(/^#{1,2}\s+(.+)$/m) ?? markdown.match(/^\*\*(.+?)\*\*\s*$/m);
  return heading?.[1]?.trim();
}

function firstParagraph(markdown: string): string {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((block) => cleanInline(block))
    .find((block) => block.length > 80);
  return paragraph?.slice(0, 160) ?? "A new HealthyStock research brief.";
}

function parseKeywords(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .replace(/^\[|\]$/g, "")
    .split(/,|;|\n/)
    .map((keyword) => cleanInline(keyword).replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .slice(0, 15);
}

function extractRating(markdown: string): BlogPost["rating"] {
  const match = markdown.match(/\b(A\+|A|B|C|D|F)\b/);
  return (match?.[1] as BlogPost["rating"] | undefined) ?? "B";
}

function extractArticleBody(markdown: string): string {
  const marker = markdown.search(/(^|\n)(#{1,3}\s+)?\*?Starter\*?\s*($|\n)/i);
  if (marker >= 0) {
    return markdown.slice(marker).trim();
  }

  const articleMarker = markdown.search(/(^|\n)(#{1,3}\s+)?\*?Article\*?:?\s*($|\n)/i);
  if (articleMarker >= 0) {
    return markdown.slice(articleMarker).replace(/^.*Article\*?:?\s*/i, "").trim();
  }

  const sectionMarker = markdown.search(
    /(^|\n)(#{1,3}\s+)?\*?(Why This Matters to Your Life|The Health Stock Analysis)\*?\s*($|\n)/i
  );
  if (sectionMarker >= 0) {
    return markdown.slice(sectionMarker).trim();
  }

  return markdown.trim();
}

function estimateReadTime(markdown: string): number {
  const words = cleanInline(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.ceil(words / 220));
}

function cleanInline(value: string): string {
  return value
    .replace(/[`*_#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let tableRows: string[][] = [];

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  }

  function flushTable() {
    if (tableRows.length === 0) {
      return;
    }

    closeList();
    const [head, ...body] = tableRows;
    html.push("<table>");
    html.push(`<thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`);
    html.push("<tbody>");
    body.forEach((row) => {
      html.push(`<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`);
    });
    html.push("</tbody></table>");
    tableRows = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      closeList();
      flushTable();
      continue;
    }

    if (/^[-=]{3,}$/.test(line)) {
      continue;
    }

    if (line.includes("|")) {
      const cells = line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cleanInline(cell));

      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }

      tableRows.push(
        cells
      );
      continue;
    }

    flushTable();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const boldHeading = line.match(/^\*\*(.+?)\*\*$/);
    if (heading || boldHeading) {
      closeList();
      const level = heading ? Math.min(heading[1].length + 1, 4) : 2;
      html.push(`<h${level}>${escapeHtml(cleanInline(heading?.[2] ?? boldHeading?.[1] ?? line))}</h${level}>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (ordered || unordered) {
      const nextListType = ordered ? "ol" : "ul";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${escapeHtml(cleanInline(ordered?.[1] ?? unordered?.[1] ?? ""))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${escapeHtml(cleanInline(line))}</p>`);
  }

  closeList();
  flushTable();
  return html.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mapGeneratedPost(row: GeneratedPostRow): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.cover_image ?? undefined,
    author: row.author,
    publishedAt: row.published_at,
    readTimeMinutes: row.read_time_minutes,
    primaryKeyword: row.primary_keyword,
    secondaryKeywords: row.secondary_keywords,
    category: row.category,
    rating: row.rating,
    status: row.status
  };
}
