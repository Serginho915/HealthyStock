const blockedTags = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option"
];

export function sanitizeHtml(html: string): string {
  let sanitized = html;

  for (const tag of blockedTags) {
    sanitized = sanitized.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    sanitized = sanitized.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  sanitized = sanitized.replace(/\s+(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, "");
  sanitized = sanitized.replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, "");
  sanitized = sanitized.replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return sanitized.trim();
}
