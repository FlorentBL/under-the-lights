import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

async function ensureTables() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY NOT NULL,
      participant_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      first_scorer TEXT NOT NULL,
      goal_window TEXT NOT NULL,
      first_team TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS prediction_participant_match_idx ON predictions (participant_id, match_id)"),
  ]);
}

export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  const deviceId = String(payload.deviceId || "").slice(0, 80);
  const displayName = String(payload.displayName || "NightOwl").slice(0, 32);
  const matchId = String(payload.matchId || "").slice(0, 80);
  const homeScore = Number(payload.homeScore);
  const awayScore = Number(payload.awayScore);
  const firstScorer = String(payload.firstScorer || "").slice(0, 80);
  const goalWindow = String(payload.goalWindow || "").slice(0, 20);
  const firstTeam = String(payload.firstTeam || "").slice(0, 80);

  if (!deviceId || !matchId || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || homeScore > 9 || awayScore > 9) {
    return NextResponse.json({ error: "Invalid prediction" }, { status: 400 });
  }

  await ensureTables();
  const now = Date.now();
  const predictionId = `${deviceId}:${matchId}`;
  const db = env.DB;

  await db.batch([
    db.prepare(`INSERT INTO participants (id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`)
      .bind(deviceId, displayName, now, now),
    db.prepare(`INSERT INTO predictions
      (id, participant_id, match_id, home_score, away_score, first_scorer, goal_window, first_team, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(participant_id, match_id) DO UPDATE SET
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        first_scorer = excluded.first_scorer,
        goal_window = excluded.goal_window,
        first_team = excluded.first_team,
        submitted_at = excluded.submitted_at`)
      .bind(predictionId, deviceId, matchId, homeScore, awayScore, firstScorer, goalWindow, firstTeam, now),
  ]);

  return NextResponse.json({ ok: true, submittedAt: now });
}
