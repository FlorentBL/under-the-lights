import { calculateBadgeProgress, type BadgeKey, type LeaderboardEntry, type SeasonHistoryItem, type SeasonPayload } from "@/lib/season";
import type { GoalWindow } from "@/lib/scoring";

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export async function loadParticipantHistory(db: D1Database, participantId: string): Promise<SeasonHistoryItem[]> {
  const rows = await db.prepare(`SELECT p.match_id, p.home_score AS prediction_home_score, p.away_score AS prediction_away_score,
      p.first_scorer AS prediction_first_scorer, p.goal_window AS prediction_goal_window, p.first_team AS prediction_first_team,
      s.week_key, c.kickoff, c.country_code, c.competition_name, c.home_name, c.away_name, c.home_position, c.away_position,
      mr.home_score AS result_home_score, mr.away_score AS result_away_score, mr.first_scorer AS result_first_scorer,
      mr.first_goal_minute, mr.goal_window AS result_goal_window, mr.first_team AS result_first_team, mr.settled_at,
      ps.outcome_points, ps.exact_score_points, ps.first_scorer_points, ps.goal_window_points,
      ps.first_team_points, ps.total_points, ps.scored_at
    FROM predictions p
    JOIN spotlight_candidates c ON CAST(c.fixture_id AS TEXT) = p.match_id
    JOIN spotlights s ON s.candidate_id = c.id
    LEFT JOIN match_results mr ON mr.match_id = p.match_id
    LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
    WHERE p.participant_id = ?
    ORDER BY c.kickoff DESC`).bind(participantId).all<Record<string, unknown>>();

  return (rows.results || []).map((row) => ({
    matchId: String(row.match_id),
    weekKey: String(row.week_key),
    kickoff: Number(row.kickoff),
    countryCode: String(row.country_code),
    competitionName: String(row.competition_name),
    homeName: String(row.home_name),
    awayName: String(row.away_name),
    homePosition: nullableNumber(row.home_position),
    awayPosition: nullableNumber(row.away_position),
    prediction: {
      homeScore: Number(row.prediction_home_score),
      awayScore: Number(row.prediction_away_score),
      firstScorer: String(row.prediction_first_scorer),
      goalWindow: String(row.prediction_goal_window) as GoalWindow,
      firstTeam: String(row.prediction_first_team),
    },
    result: row.result_home_score === null || row.result_home_score === undefined ? null : {
      homeScore: Number(row.result_home_score),
      awayScore: Number(row.result_away_score),
      firstScorer: String(row.result_first_scorer),
      firstGoalMinute: nullableNumber(row.first_goal_minute),
      goalWindow: String(row.result_goal_window) as GoalWindow,
      firstTeam: String(row.result_first_team),
      settledAt: Number(row.settled_at),
    },
    score: row.total_points === null || row.total_points === undefined ? null : {
      outcomePoints: Number(row.outcome_points),
      exactScorePoints: Number(row.exact_score_points),
      firstScorerPoints: Number(row.first_scorer_points),
      goalWindowPoints: Number(row.goal_window_points),
      firstTeamPoints: Number(row.first_team_points),
      totalPoints: Number(row.total_points),
      scoredAt: Number(row.scored_at),
    },
  }));
}

export async function awardParticipantBadges(db: D1Database, participantIds: string[], earnedAt = Date.now()) {
  const uniqueParticipantIds = [...new Set(participantIds)];
  let awarded = 0;
  for (const participantId of uniqueParticipantIds) {
    const history = await loadParticipantHistory(db, participantId);
    const unlocked = calculateBadgeProgress(history).filter((badge) => badge.unlocked);
    if (!unlocked.length) continue;
    const results = await db.batch(unlocked.map((badge) => db.prepare(`INSERT OR IGNORE INTO participant_badges
      (id, participant_id, badge_key, earned_at) VALUES (?, ?, ?, ?)`)
      .bind(`${participantId}:${badge.key}`, participantId, badge.key, earnedAt)));
    awarded += results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
  }
  return awarded;
}

async function loadLeaderboard(db: D1Database, viewerId?: string): Promise<LeaderboardEntry[]> {
  const rows = await db.prepare(`SELECT pt.id AS participant_id, pt.display_name,
      COUNT(DISTINCT p.id) AS predictions,
      COUNT(DISTINCT ps.prediction_id) AS played,
      COALESCE(SUM(ps.total_points), 0) AS points,
      COALESCE(SUM(CASE WHEN ps.exact_score_points > 0 THEN 1 ELSE 0 END), 0) AS exact_scores,
      COALESCE(SUM(CASE WHEN ps.outcome_points > 0 THEN 1 ELSE 0 END), 0) AS correct_outcomes,
      (SELECT COUNT(*) FROM participant_badges pb WHERE pb.participant_id = pt.id) AS badges
    FROM participants pt
    JOIN predictions p ON p.participant_id = pt.id
    LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
    GROUP BY pt.id, pt.display_name
    ORDER BY points DESC, exact_scores DESC, correct_outcomes DESC, pt.updated_at ASC, pt.id ASC
    LIMIT 100`).all<Record<string, unknown>>();

  return (rows.results || []).map((row, index) => ({
    rank: index + 1,
    displayName: String(row.display_name),
    points: Number(row.points),
    exactScores: Number(row.exact_scores),
    correctOutcomes: Number(row.correct_outcomes),
    played: Number(row.played),
    predictions: Number(row.predictions),
    badges: Number(row.badges),
    isViewer: String(row.participant_id) === viewerId,
  }));
}

export async function loadSeason(db: D1Database, participantId?: string): Promise<SeasonPayload> {
  const leaderboard = await loadLeaderboard(db, participantId);
  if (!participantId) return { leaderboard, viewer: null };

  const [history, earnedRows] = await Promise.all([
    loadParticipantHistory(db, participantId),
    db.prepare("SELECT badge_key, earned_at FROM participant_badges WHERE participant_id = ?")
      .bind(participantId).all<Record<string, unknown>>(),
  ]);
  const earnedAt = Object.fromEntries((earnedRows.results || []).map((row) => [String(row.badge_key) as BadgeKey, Number(row.earned_at)]));
  const badges = calculateBadgeProgress(history, earnedAt);
  const scored = history.filter((item) => item.score);
  const points = scored.reduce((total, item) => total + item.score!.totalPoints, 0);
  const exactScores = scored.filter((item) => item.score!.exactScorePoints > 0).length;
  const correctOutcomes = scored.filter((item) => item.score!.outcomePoints > 0).length;

  return {
    leaderboard,
    viewer: {
      rank: leaderboard.find((entry) => entry.isViewer)?.rank || null,
      stats: {
        points,
        exactScores,
        correctOutcomes,
        played: scored.length,
        predictions: history.length,
        accuracy: scored.length ? Math.round(correctOutcomes / scored.length * 100) : 0,
        countries: new Set(history.map((item) => item.countryCode)).size,
      },
      history,
      badges,
    },
  };
}
