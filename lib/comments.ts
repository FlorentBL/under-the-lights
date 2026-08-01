export const MAX_COMMENT_LENGTH = 1000;
export const COMMENT_COOLDOWN_MS = 30_000;
export const COMMENT_DAILY_LIMIT = 20;
export const COMMENT_DAILY_WINDOW_MS = 86_400_000;

export const COMMENT_ERROR_MESSAGES = {
  authenticationRequired: "Authentication required",
  invalidMatch: "Invalid match",
  currentMatchNotFound: "Current Spotlight match not found",
  textRequired: "Comment text required",
  textTooLong: `Comments are limited to ${MAX_COMMENT_LENGTH} characters`,
  muted: "An administrator has muted this account from commenting",
  dailyLimit: "Daily comment limit reached. Try again tomorrow.",
  cooldown: "You are commenting too quickly. Please wait a moment.",
  idRequired: "Comment ID required",
  notFound: "Comment not found",
  authorOnly: "You can only edit your own comments",
} as const;

export type CommentErrorCode = keyof typeof COMMENT_ERROR_MESSAGES;

export class CommentValidationError extends Error {
  readonly code: Extract<CommentErrorCode, "textRequired" | "textTooLong">;

  constructor(code: Extract<CommentErrorCode, "textRequired" | "textTooLong">) {
    super(COMMENT_ERROR_MESSAGES[code]);
    this.name = "CommentValidationError";
    this.code = code;
  }
}

export function parseCommentBody(value: unknown): string {
  if (typeof value !== "string") throw new CommentValidationError("textRequired");
  const body = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim();
  if (!body) throw new CommentValidationError("textRequired");
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new CommentValidationError("textTooLong");
  }
  return body;
}
