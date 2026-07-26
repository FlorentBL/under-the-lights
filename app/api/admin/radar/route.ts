import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { jsonRequestErrorResponse, readJsonObject } from "@/lib/request-validation";
import { runAndPersistRadar } from "@/lib/soccerverse-radar";

function normalizeCandidate(row: Record<string, unknown>) {
  return {
    id: row.id,
    rank: row.rank,
    score: Number(row.score) / 100,
    fixtureId: row.fixture_id,
    competitionId: row.competition_id,
    seasonId: row.season_id,
    kickoff: row.kickoff,
    countryCode: row.country_code,
    competitionName: row.competition_name,
    divisionLevel: row.division_level,
    homeClubId: row.home_club_id,
    awayClubId: row.away_club_id,
    homeName: row.home_name,
    awayName: row.away_name,
    homePosition: row.home_position,
    awayPosition: row.away_position,
    homePoints: row.home_points,
    awayPoints: row.away_points,
    homeRecord: row.home_record,
    awayRecord: row.away_record,
    homeManager: row.home_manager,
    awayManager: row.away_manager,
    homeStrength: row.home_strength === null ? null : Number(row.home_strength) / 100,
    awayStrength: row.away_strength === null ? null : Number(row.away_strength) / 100,
    reasons: JSON.parse(String(row.reasons || "[]")),
  };
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = (env as Cloudflare.Env).DB;
  const latest = await db.prepare("SELECT * FROM radar_runs ORDER BY created_at DESC LIMIT 1").first<Record<string, unknown>>();
  const candidates = latest
    ? await db.prepare("SELECT * FROM spotlight_candidates WHERE run_id = ? ORDER BY rank ASC").bind(latest.id).all<Record<string, unknown>>()
    : { results: [] };
  const published = await db.prepare(`SELECT s.*, c.home_name, c.away_name, c.kickoff, c.competition_name
    FROM spotlights s JOIN spotlight_candidates c ON c.id = s.candidate_id
    WHERE s.status = 'published' ORDER BY c.kickoff DESC LIMIT 1`).first<Record<string, unknown>>();
  return NextResponse.json({
    admin: { name: access.session.user.name, email: access.session.user.email },
    run: latest ? {
      id: latest.id, weekKey: latest.week_key, windowStart: latest.window_start, windowEnd: latest.window_end,
      status: latest.status, fixturesScanned: latest.fixtures_scanned, countriesScanned: latest.countries_scanned,
      error: latest.error, createdAt: latest.created_at, completedAt: latest.completed_at,
    } : null,
    candidates: (candidates.results || []).map(normalizeCandidate),
    published: published ? {
      id: published.id, candidateId: published.candidate_id, weekKey: published.week_key, status: published.status,
      editorialTitle: published.editorial_title, editorialSummary: published.editorial_summary,
      homeName: published.home_name, awayName: published.away_name, kickoff: published.kickoff,
      competitionName: published.competition_name, publishedAt: published.published_at,
    } : null,
  });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: Record<string, unknown>;
  try {
    payload = await readJsonObject(request);
  } catch (error) {
    return jsonRequestErrorResponse(error);
  }
  if (payload.reference !== undefined
    && (typeof payload.reference !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.reference))) {
    return NextResponse.json({ error: "Reference must be an ISO date" }, { status: 400 });
  }
  const requestedDate = typeof payload.reference === "string" ? payload.reference : null;
  const reference = requestedDate ? new Date(`${requestedDate}T12:00:00Z`) : new Date();
  if (Number.isNaN(reference.getTime())
    || (requestedDate && reference.toISOString().slice(0, 10) !== requestedDate)) {
    return NextResponse.json({ error: "Reference must be a valid date" }, { status: 400 });
  }
  try {
    const result = await runAndPersistRadar((env as Cloudflare.Env).DB, access.session.user.id, reference);
    return NextResponse.json({ ok: true, runId: result.runId, weekKey: result.weekKey, candidates: result.candidates.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Radar calculation failed" }, { status: 502 });
  }
}
