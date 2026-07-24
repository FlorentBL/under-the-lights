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
  assert.match(app, /utl-pending-prediction/);
  assert.match(app, /Signed in\. Locking your prediction/);
  assert.match(app, /void savePrediction\(pending, true\)/);
  assert.match(app, /callbackURL: window\.location\.origin/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(app, /[—–]/);
});

test("includes durable prediction storage and brand assets", async () => {
  const [route, wrangler, schema] = await Promise.all([
    readFile(new URL("../app/api/predictions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /ON CONFLICT\(participant_id, match_id\)/);
  assert.match(wrangler, /"binding": "DB"/);
  assert.match(wrangler, /https:\/\/under-the-lights\.flobl\.workers\.dev/);
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

test("ships private-safe public competitor pages", async () => {
  const [page, app, seasonData] = await Promise.all([
    readFile(new URL("../app/players/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/season-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Settled results/);
  assert.match(page, /Achievements/);
  assert.match(page, /View on Soccerverse/);
  assert.match(page, /loadPublicPlayerProfile/);
  assert.match(app, /View public profile/);
  assert.match(app, /\/players\/\$\{encodeURIComponent\(entry\.participantId\)\}/);
  assert.match(seasonData, /publicCompletedHistory\(history\)/);
  assert.doesNotMatch(page, /email/i);
  assert.doesNotMatch(page, /[—–]/);
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

test("ships verified email and password recovery flows", async () => {
  const [app, auth, email] = await Promise.all([
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth-email.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Forgot your password/);
  assert.match(app, /requestPasswordReset/);
  assert.match(app, /resetPassword/);
  assert.match(app, /sendVerificationEmail/);
  assert.match(auth, /requireEmailVerification/);
  assert.match(auth, /revokeSessionsOnPasswordReset/);
  assert.match(email, /api\.resend\.com/);
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
  assert.match(adminPanel, /Search name, Soccerverse or email/);
  assert.match(adminPanel, /Make admin/);
  assert.match(adminPanel, /Remove admin/);
  assert.match(adminAuth, /getAdminRole/);
  assert.match(adminAuth, /admin_users/);
  assert.match(schema, /sqliteTable\("admin_users"/);
  assert.match(migration, /CREATE TABLE `admin_users`/);
});

test("ships an administrator settlement cockpit", async () => {
  const [route, panel, schema, migration, worker] = await Promise.all([
    readFile(new URL("../app/api/admin/settlement/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/admin-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_settlement_checks.sql", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);

  assert.match(route, /requireAdmin/);
  assert.match(route, /settlePublishedSpotlights/);
  assert.match(route, /Result checks begin at kick-off/);
  assert.match(panel, /Match operations/);
  assert.match(panel, /Check result now/);
  assert.match(panel, /Result checks/);
  assert.match(schema, /sqliteTable\("settlement_checks"/);
  assert.match(migration, /CREATE TABLE `settlement_checks`/);
  assert.match(worker, /"\* \* \* \* \*"/);
});

test("requires two recently active Soccerverse managers in the radar", async () => {
  const [radar, managerActivity, publishRoute, admin, app] = await Promise.all([
    readFile(new URL("../lib/soccerverse-radar.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/manager-activity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/candidates/[id]/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/admin-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(radar, /get_users_last_active/);
  assert.match(radar, /hasTwoActiveManagers/);
  assert.match(managerActivity, /14 \* 24 \* 60 \* 60/);
  assert.match(publishRoute, /inspectManagerEligibility/);
  assert.match(publishRoute, /no longer has two active managers/);
  assert.match(admin, /Only fixtures with two active managers/);
  assert.match(app, /made a Soccerverse move within the last 14 days/);
});

test("links Under the Lights players to their Soccerverse profiles", async () => {
  const [app, profileRoute, seasonData, adminUsers, schema, migration] = await Promise.all([
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/season-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0007_soccerverse_profiles.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Your Soccerverse account/);
  assert.match(app, /SoccerverseAccountLink/);
  assert.match(profileRoute, /auth\.api\.getSession/);
  assert.match(profileRoute, /resolveSoccerverseUsername/);
  assert.match(seasonData, /LEFT JOIN user_profiles/);
  assert.match(adminUsers, /soccerverse_username/);
  assert.match(schema, /sqliteTable\("user_profiles"/);
  assert.match(migration, /CREATE TABLE `user_profiles`/);
});

test("lets participants upload a safe custom profile photo", async () => {
  const [app, profileRoute, avatarRoute, seasonData, schema, migration] = await Promise.all([
    readFile(new URL("../app/under-the-lights-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/players/[id]/avatar/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/season-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0008_profile_avatars.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Change photo/);
  assert.match(app, /prepareAvatar/);
  assert.match(app, /image\/jpeg,image\/png,image\/webp/);
  assert.match(profileRoute, /parseAvatarDataUrl/);
  assert.match(avatarRoute, /X-Content-Type-Options/);
  assert.match(seasonData, /publicAvatarUrl/);
  assert.match(schema, /avatarDataUrl/);
  assert.match(migration, /ADD COLUMN `avatar_data_url`/);
});
