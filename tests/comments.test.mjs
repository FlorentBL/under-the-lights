import assert from "node:assert/strict";
import test from "node:test";
import {
  CommentValidationError,
  MAX_COMMENT_LENGTH,
  parseCommentBody,
} from "../lib/comments.ts";

test("parseCommentBody trims and keeps line breaks", () => {
  assert.equal(
    parseCommentBody("  I was there in 2009.\r\nWhat a night.  "),
    "I was there in 2009.\nWhat a night.",
  );
});

test("parseCommentBody rejects empty and non-string bodies", () => {
  for (const value of ["", "   ", "\n\n", null, undefined, 7, ["text"]]) {
    assert.throws(() => parseCommentBody(value), CommentValidationError);
  }
});

test("parseCommentBody strips control characters", () => {
  assert.equal(parseCommentBody("What\u0000 a\u0007 match"), "What a match");
});

test("parseCommentBody enforces the length limit", () => {
  assert.equal(parseCommentBody("x".repeat(MAX_COMMENT_LENGTH)).length, MAX_COMMENT_LENGTH);
  assert.throws(() => parseCommentBody("x".repeat(MAX_COMMENT_LENGTH + 1)), CommentValidationError);
});
