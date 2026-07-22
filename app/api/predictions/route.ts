import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = await request.json() as Record<string, unknown>;
  const matchId = String(payload.matchId || "").slice(0, 80);
  const homeScore = Number(payload.homeScore);
  const awayScore = Number(payload.awayScore);
  const firstScorer = String(payload.firstScorer || "").slice(0, 80);
  const goalWindow = String(payload.goalWindow || "").slice(0, 20);
  const firstTeam = String(payload.firstTeam || "").slice(0, 80);

  if (!matchId || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || homeScore > 9 || awayScore > 9) {
    return NextResponse.json({ error: "Invalid prediction" }, { status: 400 });
  }

  const db = (env as Cloudflare.Env).DB;
  if (!db) {
    return NextResponse.json({ ok: true, persisted: false, submittedAt: Date.now() });
  }

  const now = Date.now();
  const participantId = session.user.id;
  const predictionId = `${participantId}:${matchId}`;

  await db.batch([
    db.prepare(`INSERT INTO participants (id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`)
      .bind(participantId, session.user.name.slice(0, 32), now, now),
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
      .bind(predictionId, participantId, matchId, homeScore, awayScore, firstScorer, goalWindow, firstTeam, now),
  ]);

  return NextResponse.json({ ok: true, persisted: true, submittedAt: now });
}
