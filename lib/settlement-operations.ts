import { deriveSettlementState } from "@/lib/settlement-state";

type CockpitRow = Record<string, unknown>;

export async function loadSettlementCockpit(db: D1Database, now = Date.now()) {
  const row = await db.prepare(`
    SELECT
      c.fixture_id,
      c.kickoff,
      c.home_name,
      c.away_name,
      c.competition_name,
      mr.home_score,
      mr.away_score,
      mr.first_scorer,
      mr.first_goal_minute,
      mr.goal_window,
      mr.first_team,
      mr.settled_at,
      sp.player_name AS first_scorer_name,
      (SELECT COUNT(*) FROM spotlight_players players WHERE players.match_id = CAST(c.fixture_id AS TEXT)) AS player_count,
      (SELECT COUNT(*) FROM predictions p WHERE p.match_id = CAST(c.fixture_id AS TEXT)) AS prediction_count,
      (SELECT COUNT(*) FROM prediction_scores ps JOIN predictions p ON p.id = ps.prediction_id
        WHERE p.match_id = CAST(c.fixture_id AS TEXT)) AS score_count
    FROM spotlights s
    JOIN spotlight_candidates c ON c.id = s.candidate_id
    LEFT JOIN match_results mr ON mr.match_id = CAST(c.fixture_id AS TEXT)
    LEFT JOIN spotlight_players sp ON sp.match_id = CAST(c.fixture_id AS TEXT)
      AND CAST(sp.player_id AS TEXT) = mr.first_scorer
    WHERE s.status = 'published'
    ORDER BY s.published_at DESC
    LIMIT 1
  `).first<CockpitRow>();
  if (!row) return null;

  const matchId = String(row.fixture_id);
  const checks = await db.prepare(`
    SELECT id, source, status, result_found, predictions_total, predictions_scored, error, checked_at, completed_at
    FROM settlement_checks
    WHERE match_id = ?
    ORDER BY checked_at DESC
    LIMIT 8
  `).bind(matchId).all<CockpitRow>();
  const latest = checks.results?.[0];
  const predictions = Number(row.prediction_count || 0);
  const scores = Number(row.score_count || 0);
  const resultFound = row.home_score !== null && row.home_score !== undefined;
  const state = deriveSettlementState({
    kickoff: Number(row.kickoff),
    now,
    resultFound,
    predictions,
    scores,
    lastCheckStatus: latest ? String(latest.status) : null,
    lastCheckError: latest?.error ? String(latest.error) : null,
  });

  return {
    matchId,
    fixtureId: Number(row.fixture_id),
    kickoff: Number(row.kickoff),
    homeName: String(row.home_name),
    awayName: String(row.away_name),
    competitionName: String(row.competition_name),
    playerCount: Number(row.player_count || 0),
    predictionCount: predictions,
    scoreCount: scores,
    ...state,
    result: resultFound ? {
      homeScore: Number(row.home_score),
      awayScore: Number(row.away_score),
      firstScorer: String(row.first_scorer),
      firstScorerName: row.first_scorer_name ? String(row.first_scorer_name) : null,
      firstGoalMinute: row.first_goal_minute === null ? null : Number(row.first_goal_minute),
      goalWindow: String(row.goal_window),
      firstTeam: String(row.first_team),
      settledAt: Number(row.settled_at),
    } : null,
    checks: (checks.results || []).map((check) => ({
      id: String(check.id),
      source: String(check.source),
      status: String(check.status),
      resultFound: Boolean(check.result_found),
      predictionsTotal: Number(check.predictions_total || 0),
      predictionsScored: Number(check.predictions_scored || 0),
      error: check.error ? String(check.error) : null,
      checkedAt: Number(check.checked_at),
      completedAt: check.completed_at ? Number(check.completed_at) : null,
    })),
  };
}
