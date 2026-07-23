# Under the Lights

![Under the Lights logo](assets/logo.png)

**Under the Lights** is a season-long Soccerverse prediction game. Every week, one meaningful fixture from an overlooked league takes centre stage.

Players predict the score, first goalscorer, scoring window, and match events. Correct calls earn points, build streaks, and unlock collectible achievements throughout the season.

## Product surfaces

- Weekly Spotlight match and editorial context
- Multi-part prediction form with durable storage
- Season leaderboard
- Achievement and badge collection
- Player profile and prediction history
- Admin control room for the Monday fixture radar and editorial publication

## Admin control room

The private control room lives at `/admin`. Access is restricted to authenticated accounts whose email appears in the comma-separated `ADMIN_EMAILS` Worker variable.

```bash
ADMIN_EMAILS=first@example.com,second@example.com
```

Email verification and password recovery use Resend. Set `RESEND_API_KEY` and a verified
sender such as `AUTH_EMAIL_FROM=Under the Lights <auth@example.com>` as Worker secrets.
`AUTH_EMAIL_REPLY_TO` is optional. Until both required values exist, existing email/password
authentication remains available without verification and password recovery stays hidden.

From the control room, an administrator can scan the next Soccerverse weekend, inspect the ranked shortlist, edit the match story and publish the selected fixture. The public spotlight updates from the published D1 record.

Cloudflare launches the radar every Monday at 07:00 UTC. The control-room action can safely generate a fresh run whenever the editorial team wants to recalculate the shortlist.

The radar evaluates league position, points, unbeaten form, winning starts, division discovery value, active managers, squad strength and competitive balance. The complete score explanation is stored with every shortlisted fixture.

## Local development

```bash
npm install
npm run dev
```

The application runs as a full-stack Cloudflare Worker and uses a D1 binding named `DB` for persistent data.

Authentication is provided by Better Auth. Email/password accounts work out of the box. Discord OAuth is enabled when `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are configured as Worker secrets.

## Cloudflare development

```bash
npm run db:migrate:local
npm run dev
```

Preview the production Worker locally:

```bash
npm run preview
```

Apply migrations and deploy to Cloudflare:

```bash
npm run db:migrate:remote
npm run deploy
```

## Discord OAuth

Create an application in the Discord Developer Portal and register these redirects:

- `http://localhost:3000/api/auth/callback/discord`
- `https://under-the-lights.flobl.workers.dev/api/auth/callback/discord`

Then add the credentials without committing them:

```bash
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npm run deploy
```
