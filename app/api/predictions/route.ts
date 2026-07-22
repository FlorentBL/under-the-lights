import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "cloudflare:workers";
import { GOAL_WINDOWS, NO_GOAL, validatePredictionConsistency, type GoalWindow } from "@/lib/scoring";

async function publishedMatch(db: D1Database, matchId: string) {
  return db.prepare(`SELECT c.kickoff, c.home_club_id, c.away_club_id
    FROM spotlights s JOIN spotlight_candidates c ON c.id = s.candidate_id
    WHERE s.status = 'published' AND CAST(c.fixture_id AS TEXT) = ?`)
    .bind(matchId).first<Record<string, unknown>>();
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const matchId = new URL(request.url).searchParams.get("matchId")?.slice(0, 80) || "";
  if (!matchId) return NextResponse.json({ error: "Match ID required" }, { status: 400 });
  const db = (env as Cloudflare.Env).DB;
  const prediction = await db.prepare(`SELECT p.home_score, p.away_score, p.first_scorer, p.goal_window, p.first_team, p.submitted_at,
      ps.outcome_points, ps.exact_score_points, ps.first_scorer_points, ps.goal_window_points, ps.first_team_points, ps.total_points, ps.scored_at
    FROM predictions p LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
    WHERE p.participant_id = ? AND p.match_id = ?`)
    .bind(session.user.id, matchId).first<Record<string, unknown>>();
  return NextResponse.json({ prediction: prediction ? {
    homeScore: prediction.home_score,
    awayScore: prediction.away_score,
    firstScorer: prediction.first_scorer,
    goalWindow: prediction.goal_window,
    firstTeam: prediction.first_team,
    submittedAt: prediction.submitted_at,
    score: prediction.total_points === null || prediction.total_points === undefined ? null : {
      outcomePoints: prediction.outcome_points,
      exactScorePoints: prediction.exact_score_points,
      firstScorerPoints: prediction.first_scorer_points,
      goalWindowPoints: prediction.goal_window_points,
      firstTeamPoints: prediction.first_team_points,
      totalPoints: prediction.total_points,
      scoredAt: prediction.scored_at,
    },
  } : null });
}

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

  if (!matchId || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || homeScore > 9 || awayScore > 9
    || !GOAL_WINDOWS.includes(goalWindow as GoalWindow)) {
    return NextResponse.json({ error: "Invalid prediction" }, { status: 400 });
  }

  const db = (env as Cloudflare.Env).DB;
  if (!db) {
    return NextResponse.json({ ok: true, persisted: false, submittedAt: Date.now() });
  }

  const match = await publishedMatch(db, matchId);
  if (!match) return NextResponse.json({ error: "Published match not found" }, { status: 404 });
  const now = Date.now();
  if (now >= Number(match.kickoff) * 1000) {
    return NextResponse.json({ error: "Predictions closed at kick-off" }, { status: 409 });
  }
  const allowedTeams = [String(match.home_club_id), String(match.away_club_id), NO_GOAL];
  if (!allowedTeams.includes(firstTeam)) return NextResponse.json({ error: "Invalid first team" }, { status: 400 });
  if (firstScorer !== NO_GOAL) {
    const player = await db.prepare("SELECT 1 FROM spotlight_players WHERE match_id = ? AND CAST(player_id AS TEXT) = ?")
      .bind(matchId, firstScorer).first();
    if (!player) return NextResponse.json({ error: "Select a player from the published squads" }, { status: 400 });
  }
  const consistencyError = validatePredictionConsistency({
    homeScore,
    awayScore,
    firstScorer,
    goalWindow: goalWindow as GoalWindow,
    firstTeam,
  });
  if (consistencyError) return NextResponse.json({ error: consistencyError }, { status: 400 });
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
