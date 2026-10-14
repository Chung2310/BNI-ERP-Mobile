const DEFAULT_MESSAGE = "Có sự cố xảy ra. Vui lòng thử lại.";

const technicalDetail = /(?:https?:\/\/|file:\/\/|[A-Za-z]:\\|\b(?:java\.|net\.|Exception|TypeError|ReferenceError|SyntaxError|fetch failed|Failed to fetch|Network request failed|HTTP\s*\d{3}|ECONN\w*|ETIMEDOUT|ENOTFOUND|EACCES|ENOENT|DNS|CORS|JSON|Mongo(?:DB|ose)?|SQL|stack trace|undefined|null|localhost)\b|(?:[a-z0-9-]+\.)+[a-z]{2,})/i;

export function friendlyErrorMessage(error: unknown, fallback = DEFAULT_MESSAGE, preserveLineBreaks = false): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = raw.trim().replace(/\r\n?/g, "\n");
  const message = preserveLineBreaks
    ? normalized.replace(/[^\S\n]+/g, " ")
    : normalized.replace(/\s+/g, " ");
  if (!message || message.length > 500 || !/[À-ỹ]/u.test(message) || technicalDetail.test(message)) return fallback;
  return message;
}
