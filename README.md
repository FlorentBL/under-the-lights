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

## Local development

```bash
npm install
npm run dev
```

The application runs as a full-stack Cloudflare Worker and uses a D1 binding named `DB` for persistent data.

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
