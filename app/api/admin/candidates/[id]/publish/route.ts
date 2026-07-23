import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { syncSpotlightPlayers } from "@/lib/soccerverse-match";
import { inspectManagerEligibility } from "@/lib/soccerverse-radar";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await context.params;
  const payload = await request.json().catch(() => ({})) as { title?: string; summary?: string };
  const db = (env as Cloudflare.Env).DB;
  const candidate = await db.prepare(`SELECT c.*, r.week_key FROM spotlight_candidates c
    JOIN radar_runs r ON r.id = c.run_id WHERE c.id = ?`).bind(id).first<Record<string, unknown>>();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  try {
    const managers = await inspectManagerEligibility(Number(candidate.home_club_id), Number(candidate.away_club_id));
    if (!managers.eligible) {
      return NextResponse.json({
        error: "This fixture no longer has two active managers. Run the radar again before publishing.",
      }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Soccerverse manager activity could not be verified" }, { status: 502 });
  }
  const title = String(payload.title || `${candidate.home_name} vs ${candidate.away_name}`).trim().slice(0, 120);
  const summary = String(payload.summary || "Two teams step into the spotlight. One match carries the week.").trim().slice(0, 360);
  const now = Date.now();
  await db.prepare(`INSERT INTO spotlights
      (id, week_key, candidate_id, status, editorial_title, editorial_summary, published_by, published_at, updated_at)
    VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?)
    ON CONFLICT(week_key) DO UPDATE SET candidate_id = excluded.candidate_id, status = 'published',
      editorial_title = excluded.editorial_title, editorial_summary = excluded.editorial_summary,
      published_by = excluded.published_by, published_at = excluded.published_at, updated_at = excluded.updated_at`)
    .bind(crypto.randomUUID(), candidate.week_key, id, title, summary, access.session.user.id, now, now).run();
  let playersSynced = 0;
  try {
    playersSynced = (await syncSpotlightPlayers(db, {
      fixtureId: Number(candidate.fixture_id),
      matchId: String(candidate.fixture_id),
      kickoff: Number(candidate.kickoff),
      homeClubId: Number(candidate.home_club_id),
      awayClubId: Number(candidate.away_club_id),
    })).length;
  } catch {
    // The settlement cron retries squad synchronization before kick-off.
  }
  return NextResponse.json({ ok: true, weekKey: candidate.week_key, candidateId: id, playersSynced });
}
