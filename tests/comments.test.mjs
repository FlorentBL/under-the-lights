import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMMENT_ERROR_MESSAGES,
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
    assert.throws(
      () => parseCommentBody(value),
      (error) => error instanceof CommentValidationError && error.code === "textRequired",
    );
  }
});

test("parseCommentBody strips control characters", () => {
  assert.equal(parseCommentBody("What\u0000 a\u0007 match"), "What a match");
});

test("parseCommentBody enforces the length limit", () => {
  assert.equal(parseCommentBody("x".repeat(MAX_COMMENT_LENGTH)).length, MAX_COMMENT_LENGTH);
  assert.throws(
    () => parseCommentBody("x".repeat(MAX_COMMENT_LENGTH + 1)),
    (error) => error instanceof CommentValidationError && error.code === "textTooLong",
  );
});

test("comment posting enforces limits in the same atomic insert", async () => {
  const route = await readFile(new URL("../app/api/comments/route.ts", import.meta.url), "utf8");
  assert.match(route, /INSERT INTO match_comments[\s\S]*SELECT \?, \?, \?, \?, \?[\s\S]*COUNT\(\*\)[\s\S]*NOT EXISTS/);
  assert.doesNotMatch(route, /INSERT INTO match_comments \(id, match_id, user_id, body, created_at\) VALUES/);
});

test("comment posting only accepts the latest published Spotlight", async () => {
  const route = await readFile(new URL("../app/api/comments/route.ts", import.meta.url), "utf8");
  assert.match(route, /WHERE s\.status = 'published'[\s\S]*ORDER BY c\.kickoff DESC LIMIT 1/);
  assert.match(route, /String\(current\.fixture_id\) === matchId/);
});

test("comment API errors use stable codes that the client translates", async () => {
  const component = await readFile(new URL("../app/match-comments.tsx", import.meta.url), "utf8");
  assert.match(component, /COMMENT_ERROR_MESSAGES\[payload\.code\]/);
  assert.equal(COMMENT_ERROR_MESSAGES.cooldown, "You are commenting too quickly. Please wait a moment.");
});
