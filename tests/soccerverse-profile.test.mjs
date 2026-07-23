import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSoccerverseUsername,
  resolveSoccerverseUsername,
  soccerverseProfileUrl,
} from "../lib/soccerverse-profile.ts";

test("normalizes a Soccerverse username or profile URL", () => {
  assert.equal(normalizeSoccerverseUsername("  @klo  "), "klo");
  assert.equal(
    normalizeSoccerverseUsername("https://play.soccerverse.com/profile?user=KloV2"),
    "KloV2",
  );
  assert.equal(normalizeSoccerverseUsername("https://example.com/profile?user=klo"), null);
  assert.equal(normalizeSoccerverseUsername("bad/name"), null);
});

test("builds an encoded public Soccerverse profile URL", () => {
  assert.equal(
    soccerverseProfileUrl("KloV2"),
    "https://play.soccerverse.com/profile?user=KloV2",
  );
});

test("resolves the canonical Soccerverse username from the directory", async () => {
  const fetcher = async (url) => {
    assert.match(String(url), /names=klov2/);
    return new Response(JSON.stringify({ items: [{ name: "KloV2" }] }), { status: 200 });
  };
  assert.equal(await resolveSoccerverseUsername("klov2", fetcher), "KloV2");
});

test("rejects names missing from the Soccerverse directory", async () => {
  const fetcher = async () => new Response(JSON.stringify({ items: [] }), { status: 200 });
  await assert.rejects(
    resolveSoccerverseUsername("missing-player", fetcher),
    /Soccerverse account not found/,
  );
});
