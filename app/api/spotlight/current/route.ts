import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET() {
  const db = (env as Cloudflare.Env).DB;
  const row = await db.prepare(`SELECT s.editorial_title, s.editorial_summary, s.week_key,
      c.fixture_id, c.kickoff, c.country_code, c.competition_name,
      c.home_club_id, c.away_club_id, c.home_name, c.away_name,
      c.home_position, c.away_position, c.home_points, c.away_points,
      c.home_record, c.away_record, c.home_manager, c.away_manager,
      c.home_strength, c.away_strength, c.reasons
    FROM spotlights s JOIN spotlight_candidates c ON c.id = s.candidate_id
    WHERE s.status = 'published' ORDER BY c.kickoff DESC LIMIT 1`).first<Record<string, unknown>>();
  if (!row) return NextResponse.json({ spotlight: null });
  return NextResponse.json({ spotlight: {
    fixtureId: row.fixture_id,
    kickoff: row.kickoff,
    countryCode: row.country_code,
    competitionName: row.competition_name,
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
    title: row.editorial_title,
    summary: row.editorial_summary,
    reasons: JSON.parse(String(row.reasons || "[]")),
  } });
}
