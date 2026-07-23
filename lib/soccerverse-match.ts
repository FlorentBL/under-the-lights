import { GOAL_WINDOWS, NO_GOAL, goalWindowForMinute, scorePrediction, type GoalWindow } from "@/lib/scoring";
import { resultMayBeAvailable } from "@/lib/soccerverse-timing";
import { validGoals, type MatchEvent } from "@/lib/soccerverse-events";
import { awardParticipantBadges } from "@/lib/season-data";

const GSP_URL = "https://services.soccerverse.com/gsp/";
const REST_URL = "https://services.soccerverse.com/api";
const DATAPACK_URL = "https://downloads.soccerverse.com/svpack/packv2/default.json";
const GAME_WORLD_ID = 1;

type GspResponse<T> = { result?: { data?: T }; error?: { message?: string } };
type SquadPlayer = {
  player_id: number;
  club_id: number;
  position?: number | null;
  rating?: number | null;
  retired?: boolean;
  loaned_to_club?: number | null;
};
type PlayerName = { id: string; f?: string; s?: string };
type FixtureResult = {
  home_club: number;
  away_club: number;
  home_goals: number;
  away_goals: number;
};
export type PublishedFixture = {
  fixtureId: number;
  matchId: string;
  kickoff: number;
  homeClubId: number;
  awayClubId: number;
};

export type SettlementAttempt = {
  matchId: string;
  status: "waiting" | "settled" | "failed";
  resultFound: boolean;
  predictionsTotal: number;
  predictionsScored: number;
  error: string | null;
};

async function gsp<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(GSP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://play.soccerverse.com",
      Referer: "https://play.soccerverse.com/",
      "User-Agent": "Under-the-Lights/1.0",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: `${method}:${Date.now()}` }),
  });
  if (!response.ok) throw new Error(`Soccerverse GSP returned ${response.status}`);
  const payload = await response.json() as GspResponse<T>;
  if (payload.error) throw new Error(payload.error.message || `Soccerverse ${method} failed`);
  return payload.result?.data as T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "Under-the-Lights/1.0" } });
  if (!response.ok) throw new Error(`Soccerverse REST returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function playerNames() {
  const payload = await fetchJson<{ PackData?: { PlayerData?: { P?: PlayerName[] } } }>(DATAPACK_URL);
  return new Map((payload.PackData?.PlayerData?.P || []).map((player) => [
    Number(player.id),
    `${player.f || ""} ${player.s || ""}`.replace(/\s+/g, " ").trim() || `Player #${player.id}`,
  ]));
}

export async function syncSpotlightPlayers(db: D1Database, fixture: PublishedFixture) {
  const [homeSquad, awaySquad, names] = await Promise.all([
    gsp<SquadPlayer[]>("get_squad", { club_id: fixture.homeClubId, game_world_id: GAME_WORLD_ID }),
    gsp<SquadPlayer[]>("get_squad", { club_id: fixture.awayClubId, game_world_id: GAME_WORLD_ID }),
    playerNames(),
  ]);
  const players = [...(homeSquad || []), ...(awaySquad || [])]
    .filter((player) => !player.retired && !player.loaned_to_club)
    .map((player) => ({
      playerId: player.player_id,
      clubId: player.club_id,
      name: names.get(player.player_id) || `Player #${player.player_id}`,
      position: player.position ?? null,
      rating: player.rating ?? null,
    }))
    .sort((a, b) => a.clubId - b.clubId || (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
  const now = Date.now();
  const statements = [db.prepare("DELETE FROM spotlight_players WHERE match_id = ?").bind(fixture.matchId)];
  statements.push(...players.map((player) => db.prepare(`INSERT INTO spotlight_players
    (id, match_id, player_id, club_id, player_name, position, rating, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(`${fixture.matchId}:${player.playerId}`, fixture.matchId, player.playerId, player.clubId, player.name, player.position, player.rating, now)));
  await db.batch(statements);
  return players;
}

async function fetchFinalResult(fixture: PublishedFixture) {
  const [fixtureRows, events, playerHistory] = await Promise.all([
    gsp<FixtureResult[]>("get_fixture", { fixture_id: fixture.fixtureId }),
    fetchJson<MatchEvent[]>(`${REST_URL}/commentary/match_events/${fixture.fixtureId}`),
    fetchJson<unknown[]>(`${REST_URL}/fixture_history/players/${fixture.fixtureId}`),
  ]);
  const match = fixtureRows?.[0];
  if (!match || !playerHistory.length) return null;
  const goals = validGoals(events || []);
  const firstGoal = goals[0] || null;
  if (match.home_goals + match.away_goals > 0 && !firstGoal) return null;
  const firstTeamId = firstGoal?.goal_type === "OWN_GOAL"
    ? firstGoal.club_id === fixture.homeClubId ? fixture.awayClubId : fixture.homeClubId
    : firstGoal?.club_id;

  return {
    homeScore: match.home_goals,
    awayScore: match.away_goals,
    firstScorer: firstGoal ? String(firstGoal.player_id) : NO_GOAL,
    firstGoalMinute: firstGoal?.time ?? null,
    goalWindow: firstGoal ? goalWindowForMinute(firstGoal.time) : NO_GOAL,
    firstTeam: firstTeamId ? String(firstTeamId) : NO_GOAL,
  };
}

export async function settlePublishedSpotlights(db: D1Database, now = Date.now(), source = "cron") {
  const published = await db.prepare(`SELECT c.fixture_id, c.kickoff, c.home_club_id, c.away_club_id
    FROM spotlights s
    JOIN spotlight_candidates c ON c.id = s.candidate_id
    LEFT JOIN match_results mr ON mr.match_id = CAST(c.fixture_id AS TEXT)
    WHERE s.status = 'published'
      AND (mr.match_id IS NULL OR EXISTS (
        SELECT 1 FROM predictions p
        LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
        WHERE p.match_id = CAST(c.fixture_id AS TEXT) AND ps.prediction_id IS NULL
      ) OR EXISTS (
        SELECT 1 FROM settlement_checks sc
        WHERE sc.match_id = CAST(c.fixture_id AS TEXT)
          AND sc.status = 'failed'
          AND sc.checked_at = (SELECT MAX(last_sc.checked_at) FROM settlement_checks last_sc
            WHERE last_sc.match_id = CAST(c.fixture_id AS TEXT))
      ))`).all<Record<string, unknown>>();
  let playersSynced = 0;
  let matchesSettled = 0;
  let predictionsScored = 0;
  let badgesAwarded = 0;
  const attempts: SettlementAttempt[] = [];

  for (const row of published.results || []) {
    const fixture: PublishedFixture = {
      fixtureId: Number(row.fixture_id),
      matchId: String(row.fixture_id),
      kickoff: Number(row.kickoff),
      homeClubId: Number(row.home_club_id),
      awayClubId: Number(row.away_club_id),
    };
    const playerCount = await db.prepare("SELECT COUNT(*) AS count FROM spotlight_players WHERE match_id = ?")
      .bind(fixture.matchId).first<{ count: number }>();
    if (!Number(playerCount?.count || 0)) playersSynced += (await syncSpotlightPlayers(db, fixture)).length;
    if (!resultMayBeAvailable(fixture.kickoff, now)) continue;

    const checkId = crypto.randomUUID();
    const checkedAt = Date.now();
    await db.prepare(`INSERT INTO settlement_checks
      (id, match_id, source, status, checked_at)
      VALUES (?, ?, ?, 'checking', ?)`).bind(checkId, fixture.matchId, source.slice(0, 120), checkedAt).run();

    try {
      const result = await fetchFinalResult(fixture);
      if (!result) {
        const completedAt = Date.now();
        await db.prepare(`UPDATE settlement_checks
          SET status = 'waiting', completed_at = ?
          WHERE id = ?`).bind(completedAt, checkId).run();
        attempts.push({
          matchId: fixture.matchId, status: "waiting", resultFound: false,
          predictionsTotal: 0, predictionsScored: 0, error: null,
        });
        continue;
      }

      const predictions = await db.prepare(`SELECT id, participant_id, home_score, away_score, first_scorer, goal_window, first_team
        FROM predictions WHERE match_id = ?`).bind(fixture.matchId).all<Record<string, unknown>>();
      const scoredAt = Date.now();
      const statements = [db.prepare(`INSERT INTO match_results
        (match_id, fixture_id, home_score, away_score, first_scorer, first_goal_minute, goal_window, first_team, source_updated_at, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id) DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score,
          first_scorer = excluded.first_scorer, first_goal_minute = excluded.first_goal_minute,
          goal_window = excluded.goal_window, first_team = excluded.first_team, source_updated_at = excluded.source_updated_at`)
        .bind(fixture.matchId, fixture.fixtureId, result.homeScore, result.awayScore, result.firstScorer,
          result.firstGoalMinute, result.goalWindow, result.firstTeam, scoredAt, scoredAt)];
      let scoredPredictions = 0;
      for (const prediction of predictions.results || []) {
        const goalWindow = String(prediction.goal_window) as GoalWindow;
        if (!GOAL_WINDOWS.includes(goalWindow)) continue;
        const score = scorePrediction({
          homeScore: Number(prediction.home_score),
          awayScore: Number(prediction.away_score),
          firstScorer: String(prediction.first_scorer),
          goalWindow,
          firstTeam: String(prediction.first_team),
        }, result);
        statements.push(db.prepare(`INSERT INTO prediction_scores
          (prediction_id, outcome_points, exact_score_points, first_scorer_points, goal_window_points, first_team_points, total_points, scored_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(prediction_id) DO UPDATE SET outcome_points = excluded.outcome_points,
            exact_score_points = excluded.exact_score_points, first_scorer_points = excluded.first_scorer_points,
            goal_window_points = excluded.goal_window_points, first_team_points = excluded.first_team_points,
            total_points = excluded.total_points, scored_at = excluded.scored_at`)
          .bind(prediction.id, score.outcomePoints, score.exactScorePoints, score.firstScorerPoints,
            score.goalWindowPoints, score.firstTeamPoints, score.totalPoints, scoredAt));
        scoredPredictions += 1;
      }
      await db.batch(statements);
      badgesAwarded += await awardParticipantBadges(db, (predictions.results || []).map((prediction) => String(prediction.participant_id)), scoredAt);
      await db.prepare(`UPDATE settlement_checks
        SET status = 'settled', result_found = 1, predictions_total = ?, predictions_scored = ?, completed_at = ?
        WHERE id = ?`).bind(predictions.results?.length || 0, scoredPredictions, Date.now(), checkId).run();
      matchesSettled += 1;
      predictionsScored += scoredPredictions;
      attempts.push({
        matchId: fixture.matchId, status: "settled", resultFound: true,
        predictionsTotal: predictions.results?.length || 0, predictionsScored: scoredPredictions, error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Settlement failed";
      await db.prepare(`UPDATE settlement_checks
        SET status = 'failed', error = ?, completed_at = ?
        WHERE id = ?`).bind(message.slice(0, 500), Date.now(), checkId).run();
      attempts.push({
        matchId: fixture.matchId, status: "failed", resultFound: false,
        predictionsTotal: 0, predictionsScored: 0, error: message,
      });
    }
  }
  return { playersSynced, matchesSettled, predictionsScored, badgesAwarded, attempts };
}
