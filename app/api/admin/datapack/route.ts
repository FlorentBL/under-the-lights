import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import {
  DEFAULT_SOCCERVERSE_DATAPACK_URL,
  getSoccerverseDatapackUrl,
  saveSoccerverseDatapackUrl,
  validateSoccerverseDatapack,
} from "@/lib/soccerverse-datapack";
import { jsonRequestErrorResponse, readJsonObject } from "@/lib/request-validation";
import { syncSpotlightPlayers } from "@/lib/soccerverse-match";

async function currentSpotlight(db: D1Database) {
  return db.prepare(`SELECT c.id AS candidate_id, c.fixture_id, c.kickoff, c.home_club_id, c.away_club_id, c.home_name, c.away_name,
      COUNT(sp.player_id) AS player_count,
      COALESCE(SUM(CASE WHEN sp.player_name LIKE 'Player #%'
        OR TRIM(sp.player_name) = '' THEN 1 ELSE 0 END), 0) AS unnamed_players
    FROM spotlights s
    JOIN spotlight_candidates c ON c.id = s.candidate_id
    LEFT JOIN spotlight_players sp ON sp.match_id = CAST(c.fixture_id AS TEXT)
    WHERE s.status = 'published'
    GROUP BY c.id, c.fixture_id, c.kickoff, c.home_club_id, c.away_club_id, c.home_name, c.away_name
    ORDER BY s.published_at DESC
    LIMIT 1`).first<Record<string, unknown>>();
}

function spotlightSummary(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    fixtureId: Number(row.fixture_id),
    homeName: String(row.home_name),
    awayName: String(row.away_name),
    playerCount: Number(row.player_count || 0),
    unnamedPlayers: Number(row.unnamed_players || 0),
  };
}

async function settingMetadata(db: D1Database) {
  return db.prepare("SELECT updated_by, updated_at FROM app_settings WHERE key = 'soccerverse_datapack_url'")
    .first<{ updated_by: string; updated_at: number }>();
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = (env as Cloudflare.Env).DB;
  const [url, metadata, spotlight] = await Promise.all([
    getSoccerverseDatapackUrl(db),
    settingMetadata(db),
    currentSpotlight(db),
  ]);
  try {
    const { validation } = await validateSoccerverseDatapack(url);
    return NextResponse.json({
      url,
      defaultUrl: DEFAULT_SOCCERVERSE_DATAPACK_URL,
      updatedAt: metadata?.updated_at || null,
      validation,
      currentSpotlight: spotlightSummary(spotlight),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      url,
      defaultUrl: DEFAULT_SOCCERVERSE_DATAPACK_URL,
      updatedAt: metadata?.updated_at || null,
      validation: null,
      validationError: error instanceof Error ? error.message : "Datapack validation failed",
      currentSpotlight: spotlightSummary(spotlight),
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
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
  try {
    const parsed = await validateSoccerverseDatapack(String(payload.url || ""));
    const { validation } = parsed;
    return NextResponse.json({ validation });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Datapack validation failed",
    }, { status: 422 });
  }
}

export async function PUT(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: Record<string, unknown>;
  try {
    payload = await readJsonObject(request);
  } catch (error) {
    return jsonRequestErrorResponse(error);
  }
  const db = (env as Cloudflare.Env).DB;

  try {
    const parsed = await validateSoccerverseDatapack(String(payload.url || ""));
    const { validation } = parsed;
    const saved = await saveSoccerverseDatapackUrl(
      db,
      validation.url,
      access.session.user.id,
    );
    const spotlight = await currentSpotlight(db);
    let syncError: string | null = null;
    if (spotlight) {
      try {
        const homeClub = parsed.clubs.get(Number(spotlight.home_club_id));
        const awayClub = parsed.clubs.get(Number(spotlight.away_club_id));
        await db.prepare(`UPDATE spotlight_candidates
          SET home_name = COALESCE(?, home_name), away_name = COALESCE(?, away_name),
              home_logo_url = ?, away_logo_url = ?, home_color = ?, away_color = ?
          WHERE id = ?`)
          .bind(
            homeClub?.name || null,
            awayClub?.name || null,
            homeClub?.logoUrl || null,
            awayClub?.logoUrl || null,
            homeClub?.color || null,
            awayClub?.color || null,
            spotlight.candidate_id,
          )
          .run();
        await syncSpotlightPlayers(db, {
          fixtureId: Number(spotlight.fixture_id),
          matchId: String(spotlight.fixture_id),
          kickoff: Number(spotlight.kickoff),
          homeClubId: Number(spotlight.home_club_id),
          awayClubId: Number(spotlight.away_club_id),
        });
      } catch (error) {
        syncError = error instanceof Error ? error.message : "Spotlight synchronization failed";
      }
    }
    const refreshedSpotlight = await currentSpotlight(db);
    return NextResponse.json({
      saved,
      validation,
      syncError,
      currentSpotlight: spotlightSummary(refreshedSpotlight),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Datapack could not be saved",
    }, { status: 422 });
  }
}
