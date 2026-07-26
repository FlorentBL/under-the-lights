import assert from "node:assert/strict";
import test from "node:test";
import {
  JsonRequestError,
  readJsonObject,
} from "../lib/request-validation.ts";

function jsonRequest(body, headers = {}) {
  return new Request("https://app.example/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("readJsonObject accepts a JSON object", async () => {
  const payload = await readJsonObject(jsonRequest('{"score":2}'));
  assert.deepEqual(payload, { score: 2 });
});

test("readJsonObject rejects non-JSON media types", async () => {
  await assert.rejects(
    readJsonObject(jsonRequest("{}", { "content-type": "text/plain" })),
    (error) => error instanceof JsonRequestError && error.status === 415,
  );
});

test("readJsonObject rejects malformed and non-object JSON", async () => {
  await assert.rejects(
    readJsonObject(jsonRequest("{")),
    (error) => error instanceof JsonRequestError && error.status === 400,
  );
  await assert.rejects(
    readJsonObject(jsonRequest("[]")),
    (error) => error instanceof JsonRequestError && error.status === 400,
  );
});

test("readJsonObject enforces declared and streamed size limits", async () => {
  await assert.rejects(
    readJsonObject(jsonRequest("{}", { "content-length": "100" }), 10),
    (error) => error instanceof JsonRequestError && error.status === 413,
  );
  await assert.rejects(
    readJsonObject(jsonRequest('{"value":"too long"}'), 10),
    (error) => error instanceof JsonRequestError && error.status === 413,
  );
});
