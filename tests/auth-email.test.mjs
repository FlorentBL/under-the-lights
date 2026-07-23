import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthEmail, emailDeliveryConfigured, sendAuthEmail } from "../lib/auth-email.ts";

test("requires both the Resend key and a verified sender", () => {
  assert.equal(emailDeliveryConfigured({}), false);
  assert.equal(emailDeliveryConfigured({ RESEND_API_KEY: "key" }), false);
  assert.equal(emailDeliveryConfigured({ RESEND_API_KEY: "key", AUTH_EMAIL_FROM: "Under the Lights <auth@example.com>" }), true);
});

test("builds branded verification and reset messages without unsafe HTML", () => {
  const verification = buildAuthEmail({
    kind: "verify-email",
    to: "player@example.com",
    name: "<Player>",
    url: "https://example.com/verify?token=a&callback=b",
  });
  const reset = buildAuthEmail({
    kind: "reset-password",
    to: "player@example.com",
    name: "Player",
    url: "https://example.com/reset",
  });

  assert.match(verification.subject, /Verify/);
  assert.match(verification.html, /Soccerverse/);
  assert.match(verification.html, /&lt;Player&gt;/);
  assert.doesNotMatch(verification.html, /Hello <Player>/);
  assert.match(reset.subject, /Reset/);
  assert.match(reset.text, /expires in 60 minutes/);
});

test("sends authentication email through the Resend API", async () => {
  let request;
  const fetcher = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
  };

  await sendAuthEmail({
    RESEND_API_KEY: "secret-key",
    AUTH_EMAIL_FROM: "Under the Lights <auth@example.com>",
    AUTH_EMAIL_REPLY_TO: "support@example.com",
  }, {
    kind: "reset-password",
    to: "player@example.com",
    name: "Player",
    url: "https://example.com/reset",
  }, fetcher);

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers.Authorization, "Bearer secret-key");
  const payload = JSON.parse(request.init.body);
  assert.deepEqual(payload.to, ["player@example.com"]);
  assert.equal(payload.reply_to, "support@example.com");
  assert.match(payload.html, /Reset my password/);
});

test("surfaces email provider failures", async () => {
  await assert.rejects(
    sendAuthEmail({
      RESEND_API_KEY: "secret-key",
      AUTH_EMAIL_FROM: "Under the Lights <auth@example.com>",
    }, {
      kind: "verify-email",
      to: "player@example.com",
      name: "Player",
      url: "https://example.com/verify",
    }, async () => new Response("invalid sender", { status: 422 })),
    /Resend rejected/,
  );
});
