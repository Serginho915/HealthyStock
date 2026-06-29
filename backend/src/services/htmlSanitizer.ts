import sanitizeHtmlLib from "sanitize-html";

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "h2", "h3", "h4", "h5", "h6",
      "p", "br", "strong", "em", "blockquote",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td",
      "a"
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    enforceHtmlBoundary: true,
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", {
        rel: "nofollow noopener noreferrer",
        target: "_blank"
      })
    }
  }).trim();
}
