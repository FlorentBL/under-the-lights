import clubNamesSource from "@/data/club-mapping.json";
import leagueNamesSource from "@/data/league-names.json";
import { hasTwoActiveManagers } from "@/lib/manager-activity";
import { playersAvailableForClub, type SoccerverseSquadPlayer } from "@/lib/soccerverse-squad";

const GSP_URL = "https://services.soccerverse.com/gsp/";
const GAME_WORLD_ID = 1;
const clubNames = clubNamesSource as Record<string, { name?: string; n?: string }>;
const leagueNames = leagueNamesSource as Record<string, string>;

type RpcCall = { method: string; params: Record<string, unknown>; id: string };
type RpcResponse<T = unknown> = { id: string; result?: { data?: T }; error?: { message?: string } };
type Season = { season_id: number; finished: boolean };
type Competition = {
  id: number;
  type: number;
  country: string;
  level: number;
  seasonId: number;
  name: string;
};
type Turn = { comp_type: number; country_id: string; date: number; number: number; played: number; season_id: number; turn_id: number; compId: number };
type Fixture = {
  fixture_id: number;
  home_club: number;
  away_club: number;
  home_goals: number;
  away_goals: number;
  home_manager?: string;
  away_manager?: string;
  season_id: number;
  turn_id: number;
};
type Club = { club_id: number; manager_name?: string | null; fans_current?: number };
type Player = SoccerverseSquadPlayer & { rating: number };
type UserActivity = { name: string; last_active: number };
type TeamStanding = { clubId: number; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; position: number };

export type RadarCandidate = {
  fixtureId: number;
  competitionId: number;
  seasonId: number;
  kickoff: number;
  countryCode: string;
  competitionName: string;
  divisionLevel: number;
  homeClubId: number;
  awayClubId: number;
  homeName: string;
  awayName: string;
  homePosition: number | null;
  awayPosition: number | null;
  homePoints: number | null;
  awayPoints: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  homeManager: string | null;
  awayManager: string | null;
  homeStrength: number | null;
  awayStrength: number | null;
  score: number;
  reasons: string[];
};

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function rpcBatch<T>(calls: RpcCall[]): Promise<Map<string, T>> {
  const output = new Map<string, T>();
  for (const group of chunks(calls, 500)) {
    const response = await fetch(GSP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://play.soccerverse.com",
        Referer: "https://play.soccerverse.com/",
      },
      body: JSON.stringify(group.map((call) => ({ jsonrpc: "2.0", ...call }))),
    });
    if (!response.ok) throw new Error(`Soccerverse GSP returned ${response.status}`);
    const payload = await response.json() as RpcResponse<T>[];
    for (const item of payload) {
      if (item.error) throw new Error(item.error.message || `Soccerverse call ${item.id} failed`);
      output.set(String(item.id), item.result?.data as T);
    }
  }
  return output;
}

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const id = `${method}:single`;
  const result = await rpcBatch<T>([{ method, params, id }]);
  return result.get(id) as T;
}

function weekendWindow(reference = new Date()) {
  const cursor = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const daysToSaturday = (6 - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + daysToSaturday);
  const saturday = cursor.getTime();
  const start = saturday - 24 * 60 * 60 * 1000;
  const end = saturday + 2 * 24 * 60 * 60 * 1000;
  return { weekKey: new Date(saturday).toISOString().slice(0, 10), start: Math.floor(start / 1000), end: Math.floor(end / 1000) };
}

function competitionLabel(country: string, level: number, type: number) {
  if (type !== 0) return `${country} Cup`;
  return leagueNames[`${country}${level + 1}`] || `${country} Division ${level + 1}`;
}

function buildStandings(fixtures: Fixture[]) {
  const rows = new Map<number, Omit<TeamStanding, "position">>();
  const row = (clubId: number) => {
    if (!rows.has(clubId)) rows.set(clubId, { clubId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
    return rows.get(clubId)!;
  };
  for (const fixture of fixtures) {
    const home = row(fixture.home_club);
    const away = row(fixture.away_club);
    home.played += 1;
    away.played += 1;
    home.gf += fixture.home_goals;
    home.ga += fixture.away_goals;
    away.gf += fixture.away_goals;
    away.ga += fixture.home_goals;
    if (fixture.home_goals > fixture.away_goals) {
      home.won += 1; home.points += 3; away.lost += 1;
    } else if (fixture.home_goals < fixture.away_goals) {
      away.won += 1; away.points += 3; home.lost += 1;
    } else {
      home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
    }
  }
  return new Map([...rows.values()]
    .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.clubId - b.clubId)
    .map((entry, index) => [entry.clubId, { ...entry, position: index + 1 }]));
}

function squadStrength(players: Player[] | undefined, clubId: number) {
  const eligible = playersAvailableForClub(players, clubId)
    .filter((player) => Number.isFinite(player.rating))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 18);
  if (!eligible.length) return null;
  return eligible.reduce((sum, player) => sum + player.rating, 0) / eligible.length;
}

function record(row: TeamStanding | undefined) {
  return row ? `${row.won}-${row.drawn}-${row.lost}` : null;
}

function normalizedManagerName(club: Club | undefined) {
  const name = club?.manager_name?.trim();
  return name || null;
}

function baseScore(home: TeamStanding | undefined, away: TeamStanding | undefined, competition: Competition) {
  let score = competition.type === 0 ? 18 : 38;
  const reasons: string[] = competition.type === 0 ? [] : ["Knockout football"];
  if (home && away) {
    const high = Math.max(home.position, away.position);
    if (high <= 2) { score += 25; reasons.push("Top-two clash"); }
    else if (high <= 4) { score += 17; reasons.push("Both teams in the top four"); }
    else if (Math.min(home.position, away.position) <= 4 && high <= 8) { score += 9; reasons.push("Two teams in the leading pack"); }
    const pointsGap = Math.abs(home.points - away.points);
    score += pointsGap === 0 ? 10 : pointsGap === 1 ? 8 : pointsGap === 2 ? 6 : pointsGap === 3 ? 4 : 0;
    if (pointsGap === 0) reasons.push("Level on points");
    if (home.lost === 0 && away.lost === 0) { score += 10; reasons.push("Unbeaten teams"); }
    if (home.won > 0 && away.won > 0) { score += 6; reasons.push("Both arrive with a win"); }
  }
  if (competition.type === 0) {
    if (competition.level === 0) score += 3;
    else if (competition.level === 1) { score += 8; reasons.push("Discovery pick"); }
    else { score += 11; reasons.push("Lower-division spotlight"); }
  }
  return { score, reasons };
}

export async function inspectManagerEligibility(
  homeClubId: number,
  awayClubId: number,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const clubs = await rpcBatch<Club>([homeClubId, awayClubId].map((clubId) => ({
    id: `club:${clubId}`, method: "get_club", params: { club_id: clubId },
  })));
  const homeManager = normalizedManagerName(clubs.get(`club:${homeClubId}`));
  const awayManager = normalizedManagerName(clubs.get(`club:${awayClubId}`));
  if (!homeManager || !awayManager) return { eligible: false, homeManager, awayManager };

  const activities = await rpc<UserActivity[]>("get_users_last_active", { names: [homeManager, awayManager] });
  const activityByManager = new Map((activities || [])
    .map((activity) => [String(activity.name).toLowerCase(), Number(activity.last_active)]));
  return {
    eligible: hasTwoActiveManagers(homeManager, awayManager, activityByManager, nowSeconds),
    homeManager,
    awayManager,
  };
}

export async function calculateRadar(reference = new Date()) {
  const window = weekendWindow(reference);
  const seasons = await rpc<Season[]>("get_seasons", { game_world_id: GAME_WORLD_ID });
  const season = seasons.find((item) => !item.finished) || seasons[0];
  if (!season) throw new Error("No active Soccerverse season found");

  const competitionData = await rpcBatch<Record<string, unknown>[]>([
    { id: "leagues", method: "get_leagues", params: { season_id: season.season_id } },
    { id: "cups", method: "get_cups", params: { season_id: season.season_id } },
  ]);
  const leagues = competitionData.get("leagues") || [];
  const cups = competitionData.get("cups") || [];
  const competitions: Competition[] = [
    ...leagues.map((item) => ({
      id: Number(item.league_id), type: Number(item.comp_type), country: String(item.country_id), level: Number(item.level || 0),
      seasonId: Number(item.season_id), name: competitionLabel(String(item.country_id), Number(item.level || 0), Number(item.comp_type)),
    })),
    ...cups.map((item) => ({
      id: Number(item.cup_id), type: Number(item.comp_type), country: String(item.country_id), level: 0,
      seasonId: Number(item.season_id), name: competitionLabel(String(item.country_id), 0, Number(item.comp_type)),
    })),
  ].filter((item) => Number.isFinite(item.id));
  const competitionById = new Map(competitions.map((item) => [item.id, item]));

  const turnsResponse = await rpcBatch<Turn[]>(competitions.map((competition) => ({
    id: `turns:${competition.id}`, method: "get_all_turns", params: { comp_id: competition.id },
  })));
  const allTurns: Turn[] = competitions.flatMap((competition) =>
    (turnsResponse.get(`turns:${competition.id}`) || []).map((turn) => ({ ...turn, compId: competition.id })),
  );
  const weekendTurns = allTurns.filter((turn) => !turn.played && turn.date >= window.start && turn.date < window.end);
  if (!weekendTurns.length) throw new Error("No Soccerverse fixtures found for the selected weekend");

  const weekendFixturesResponse = await rpcBatch<Fixture[]>(weekendTurns.map((turn) => ({
    id: `fixtures:${turn.turn_id}`, method: "get_turn_fixtures", params: { turn_id: turn.turn_id },
  })));
  const weekendFixtures = weekendTurns.flatMap((turn) =>
    (weekendFixturesResponse.get(`fixtures:${turn.turn_id}`) || []).map((fixture) => ({ fixture, turn })),
  );

  const activeCompetitionIds = new Set(weekendTurns.filter((turn) => turn.comp_type === 0).map((turn) => turn.compId));
  const playedTurns = allTurns.filter((turn) => turn.played && turn.date < window.start && activeCompetitionIds.has(turn.compId));
  const playedFixturesResponse = await rpcBatch<Fixture[]>(playedTurns.map((turn) => ({
    id: `played:${turn.turn_id}`, method: "get_turn_fixtures", params: { turn_id: turn.turn_id },
  })));
  const playedByCompetition = new Map<number, Fixture[]>();
  for (const turn of playedTurns) {
    const current = playedByCompetition.get(turn.compId) || [];
    current.push(...(playedFixturesResponse.get(`played:${turn.turn_id}`) || []));
    playedByCompetition.set(turn.compId, current);
  }
  const standings = new Map([...playedByCompetition].map(([competitionId, fixtures]) => [competitionId, buildStandings(fixtures)]));

  const preliminary = weekendFixtures.map(({ fixture, turn }) => {
    const competition = competitionById.get(turn.compId)!;
    const table = standings.get(turn.compId);
    const home = table?.get(fixture.home_club);
    const away = table?.get(fixture.away_club);
    const scored = baseScore(home, away, competition);
    return { fixture, turn, competition, home, away, ...scored };
  }).sort((a, b) => b.score - a.score).slice(0, 240);

  const clubIds = [...new Set(preliminary.flatMap((item) => [item.fixture.home_club, item.fixture.away_club]))];
  const clubs = await rpcBatch<Club>(clubIds.map((clubId) => ({
    id: `club:${clubId}`, method: "get_club", params: { club_id: clubId },
  })));
  const managerNames = [...new Set([...clubs.values()]
    .map((club) => normalizedManagerName(club))
    .filter((name): name is string => Boolean(name)))];
  const activityResponses = await rpcBatch<UserActivity[]>(chunks(managerNames, 200).map((names, index) => ({
    id: `activity:${index}`, method: "get_users_last_active", params: { names },
  })));
  const activityByManager = new Map([...activityResponses.values()].flat()
    .map((activity) => [String(activity.name).toLowerCase(), Number(activity.last_active)]));
  const activityNow = Math.floor(Date.now() / 1000);
  const eligible = preliminary.filter((item) => {
    const homeManager = normalizedManagerName(clubs.get(`club:${item.fixture.home_club}`));
    const awayManager = normalizedManagerName(clubs.get(`club:${item.fixture.away_club}`));
    return hasTwoActiveManagers(homeManager, awayManager, activityByManager, activityNow);
  }).slice(0, 60);
  const eligibleClubIds = [...new Set(eligible.flatMap((item) => [item.fixture.home_club, item.fixture.away_club]))];
  const squads = await rpcBatch<Player[]>(eligibleClubIds.map((clubId) => ({
    id: `squad:${clubId}`, method: "get_squad", params: { club_id: clubId, game_world_id: GAME_WORLD_ID },
  })));

  const candidates: RadarCandidate[] = eligible.map((item) => {
    const homeClub = clubs.get(`club:${item.fixture.home_club}`);
    const awayClub = clubs.get(`club:${item.fixture.away_club}`);
    const homeManager = normalizedManagerName(homeClub)!;
    const awayManager = normalizedManagerName(awayClub)!;
    const homeStrength = squadStrength(squads.get(`squad:${item.fixture.home_club}`), item.fixture.home_club);
    const awayStrength = squadStrength(squads.get(`squad:${item.fixture.away_club}`), item.fixture.away_club);
    const reasons = [...item.reasons];
    let score = item.score + 12;
    reasons.push("Both managers active in the last 14 days");
    if (homeStrength !== null && awayStrength !== null) {
      const gap = Math.abs(homeStrength - awayStrength);
      score += Math.max(0, 10 - gap * 1.7);
      score += Math.max(0, Math.min(7, ((homeStrength + awayStrength) / 2 - 53) / 3));
      if (gap < 1) reasons.push("Almost perfectly matched squads");
      else if (gap < 3) reasons.push("Closely matched squads");
    }
    if (item.competition.level >= 7) score -= 5;
    else if (item.competition.level >= 5) score -= 2;
    const homeFans = Number(homeClub?.fans_current || 0);
    const awayFans = Number(awayClub?.fans_current || 0);
    if (homeFans && awayFans) score += Math.max(0, 4 - Math.abs(homeFans - awayFans) / Math.max(homeFans, awayFans) * 4);
    return {
      fixtureId: item.fixture.fixture_id,
      competitionId: item.turn.compId,
      seasonId: item.fixture.season_id,
      kickoff: item.turn.date,
      countryCode: item.competition.country,
      competitionName: item.competition.name,
      divisionLevel: item.competition.level,
      homeClubId: item.fixture.home_club,
      awayClubId: item.fixture.away_club,
      homeName: clubNames[String(item.fixture.home_club)]?.name || clubNames[String(item.fixture.home_club)]?.n || `Club ${item.fixture.home_club}`,
      awayName: clubNames[String(item.fixture.away_club)]?.name || clubNames[String(item.fixture.away_club)]?.n || `Club ${item.fixture.away_club}`,
      homePosition: item.home?.position || null,
      awayPosition: item.away?.position || null,
      homePoints: item.home?.points ?? null,
      awayPoints: item.away?.points ?? null,
      homeRecord: record(item.home), awayRecord: record(item.away),
      homeManager, awayManager,
      homeStrength, awayStrength,
      score: Math.round(score * 100) / 100,
      reasons: [...new Set(reasons)],
    };
  }).sort((a, b) => b.score - a.score).slice(0, 20);

  return {
    ...window,
    seasonId: season.season_id,
    fixturesScanned: weekendFixtures.length,
    countriesScanned: new Set(weekendTurns.map((turn) => turn.country_id)).size,
    candidates,
  };
}

export async function runAndPersistRadar(db: D1Database, adminId: string, reference = new Date()) {
  const runId = crypto.randomUUID();
  const window = weekendWindow(reference);
  const now = Date.now();
  await db.prepare(`INSERT INTO radar_runs (id, week_key, window_start, window_end, status, created_by, created_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?)`).bind(runId, window.weekKey, window.start, window.end, adminId, now).run();
  try {
    const result = await calculateRadar(reference);
    const statements = result.candidates.map((candidate, index) => db.prepare(`INSERT INTO spotlight_candidates
      (id, run_id, rank, score, fixture_id, competition_id, season_id, kickoff, country_code, competition_name, division_level,
       home_club_id, away_club_id, home_name, away_name, home_position, away_position, home_points, away_points, home_record,
       away_record, home_manager, away_manager, home_strength, away_strength, reasons, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), runId, index + 1, Math.round(candidate.score * 100), candidate.fixtureId, candidate.competitionId,
        candidate.seasonId, candidate.kickoff, candidate.countryCode, candidate.competitionName, candidate.divisionLevel,
        candidate.homeClubId, candidate.awayClubId, candidate.homeName, candidate.awayName, candidate.homePosition, candidate.awayPosition,
        candidate.homePoints, candidate.awayPoints, candidate.homeRecord, candidate.awayRecord, candidate.homeManager, candidate.awayManager,
        candidate.homeStrength === null ? null : Math.round(candidate.homeStrength * 100),
        candidate.awayStrength === null ? null : Math.round(candidate.awayStrength * 100), JSON.stringify(candidate.reasons), Date.now()));
    for (const group of chunks(statements, 50)) await db.batch(group);
    await db.prepare(`UPDATE radar_runs SET status = 'completed', fixtures_scanned = ?, countries_scanned = ?, completed_at = ? WHERE id = ?`)
      .bind(result.fixturesScanned, result.countriesScanned, Date.now(), runId).run();
    return { runId, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Radar calculation failed";
    await db.prepare(`UPDATE radar_runs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?`).bind(message.slice(0, 500), Date.now(), runId).run();
    throw error;
  }
}
