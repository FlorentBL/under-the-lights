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
  assert.match(app, /How it works/);
  assert.match(app, /The project/);
  assert.match(app, /function HowItWorksView/);
  assert.match(app, /Fifteen points are available/);
  assert.match(app, /function ProjectView/);
  assert.match(app, /How the Spotlight is chosen/);
  assert.match(app, /https:\/\/play\.soccerverse\.com\/match\/\$\{spotlight\.fixtureId\}/);
  assert.match(app, /league\/\$\{spotlight\.divisionLevel \+ 1\}/);
  assert.match(app, /Open in Soccerverse/);
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

test("uses a visual Soccerverse player picker", async () => {
  const [app, spotlightRoute] = await Promise.all([
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/spotlight/current/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /function PlayerPicker/);
  assert.match(app, /Search by player name/);
  assert.match(app, /role="listbox"/);
  assert.match(spotlightRoute, /player_webp/);
  assert.match(spotlightRoute, /competition_id/);
  assert.match(spotlightRoute, /division_level/);
  assert.doesNotMatch(app, /<select value=\{prediction\.firstScorer\}/);
});

test("uses live season data instead of demo standings and histories", async () => {
  const [app, seasonRoute, seasonData, schema] = await Promise.all([
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/season/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/season-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /ScoreBreakdown/);
  assert.match(app, /season\.leaderboard/);
  assert.doesNotMatch(app, /Marta_V|NorthBank|Ehime FC/);
  assert.match(seasonRoute, /loadSeason/);
  assert.match(seasonData, /prediction_scores/);
  assert.match(schema, /participantBadges/);
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

test("exposes the participant registry only to administrators", async () => {
  const [usersRoute, adminPanel, adminAuth, schema, migration] = await Promise.all([
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/admin-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0005_admin_roles.sql", import.meta.url), "utf8"),
  ]);

  assert.match(usersRoute, /requireAdmin/);
  assert.match(usersRoute, /COUNT\(DISTINCT p\.id\)/);
  assert.match(usersRoute, /MAX\(s\.updated_at\)/);
  assert.match(usersRoute, /export async function PATCH/);
  assert.match(usersRoute, /Configured administrators cannot be demoted here/);
  assert.match(usersRoute, /You cannot remove your own administrator access/);
  assert.doesNotMatch(usersRoute, /access_token|refresh_token|password/);
  assert.match(adminPanel, /Participant registry/);
  assert.match(adminPanel, /Search name, email or provider/);
  assert.match(adminPanel, /Make admin/);
  assert.match(adminPanel, /Remove admin/);
  assert.match(adminAuth, /getAdminRole/);
  assert.match(adminAuth, /admin_users/);
  assert.match(schema, /sqliteTable\("admin_users"/);
  assert.match(migration, /CREATE TABLE `admin_users`/);
});
