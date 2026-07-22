import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("ships the Under the Lights product surface", async () => {
  const [page, layout, app, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /UnderTheLightsApp/);
  assert.match(layout, /Under the Lights \| Soccerverse Prediction Game/);
  assert.match(layout, /\/og\.png/);
  assert.match(app, /Make your prediction/);
  assert.match(app, /Leaderboard/);
  assert.match(app, /Achievements/);
  assert.match(app, /Prediction history/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(app, /[—–]/);
});

test("includes durable prediction storage and brand assets", async () => {
  const [route, hosting, schema] = await Promise.all([
    readFile(new URL("../app/api/predictions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /ON CONFLICT\(participant_id, match_id\)/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /prediction_participant_match_idx/);
  await access(new URL("../public/logo.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_glorious_killmonger.sql", import.meta.url));
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});

test("protects predictions with Better Auth", async () => {
  const [predictionRoute, authRoute, providersRoute, authConfig, schema] = await Promise.all([
    readFile(new URL("../app/api/predictions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/[...all]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth-providers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(predictionRoute, /auth\.api\.getSession/);
  assert.match(predictionRoute, /Authentication required/);
  assert.match(authRoute, /toNextJsHandler/);
  assert.match(providersRoute, /DISCORD_CLIENT_ID/);
  assert.match(authConfig, /emailAndPassword/);
  assert.match(authConfig, /discord/);
  assert.match(schema, /sqliteTable\("session"/);
  assert.match(schema, /sqliteTable\("account"/);
});
