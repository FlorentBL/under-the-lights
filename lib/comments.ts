export const MAX_COMMENT_LENGTH = 1000;
export const COMMENT_COOLDOWN_MS = 30_000;
export const COMMENT_DAILY_LIMIT = 20;
export const COMMENT_DAILY_WINDOW_MS = 86_400_000;

export class CommentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentValidationError";
  }
}

export function parseCommentBody(value: unknown): string {
  if (typeof value !== "string") throw new CommentValidationError("Comment text required");
  const body = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim();
  if (!body) throw new CommentValidationError("Comment text required");
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new CommentValidationError(`Comments are limited to ${MAX_COMMENT_LENGTH} characters`);
  }
  return body;
}
