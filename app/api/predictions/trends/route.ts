import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { NO_GOAL } from "@/lib/scoring";
import { buildPredictionTrends, MINIMUM_TREND_SAMPLE_SIZE, type TrendCount } from "@/lib/prediction-trends";

function trendRows(rows: Record<string, unknown>[] | undefined): TrendCount[] {
  return (rows || []).map((row) => ({
    key: String(row.key),
    label: String(row.label),
    count: Number(row.count),
  }));
}

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get("matchId")?.slice(0, 80) || "";
  if (!matchId) return NextResponse.json({ error: "Match ID required" }, { status: 400 });

  const db = (env as Cloudflare.Env).DB;
  const published = await db.prepare(`SELECT 1
    FROM spotlights s JOIN spotlight_candidates c ON c.id = s.candidate_id
    WHERE s.status = 'published' AND CAST(c.fixture_id AS TEXT) = ?`)
    .bind(matchId).first();
  if (!published) return NextResponse.json({ error: "Published match not found" }, { status: 404 });

  const totalRow = await db.prepare("SELECT COUNT(*) AS total FROM predictions WHERE match_id = ?")
    .bind(matchId).first<Record<string, unknown>>();
  const total = Number(totalRow?.total || 0);

  if (total < MINIMUM_TREND_SAMPLE_SIZE) {
    return NextResponse.json(
      { trends: buildPredictionTrends(total, [], [], []) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [outcomeRows, scoreRows, scorerRows] = await Promise.all([
    db.prepare(`SELECT
        CASE WHEN home_score > away_score THEN 'home'
          WHEN home_score = away_score THEN 'draw'
          ELSE 'away' END AS key,
        CASE WHEN home_score > away_score THEN 'Home win'
          WHEN home_score = away_score THEN 'Draw'
          ELSE 'Away win' END AS label,
        COUNT(*) AS count
      FROM predictions WHERE match_id = ?
      GROUP BY 1, 2
      ORDER BY CASE WHEN home_score > away_score THEN 1
        WHEN home_score = away_score THEN 2 ELSE 3 END`)
      .bind(matchId).all<Record<string, unknown>>(),
    db.prepare(`SELECT
        CAST(home_score AS TEXT) || '-' || CAST(away_score AS TEXT) AS key,
        CAST(home_score AS TEXT) || ' - ' || CAST(away_score AS TEXT) AS label,
        COUNT(*) AS count
      FROM predictions WHERE match_id = ?
      GROUP BY home_score, away_score
      ORDER BY count DESC, home_score DESC, away_score ASC
      LIMIT 3`)
      .bind(matchId).all<Record<string, unknown>>(),
    db.prepare(`SELECT
        p.first_scorer AS key,
        CASE WHEN p.first_scorer = ? THEN 'No goalscorer'
          ELSE COALESCE(MAX(sp.player_name), 'Unknown player') END AS label,
        COUNT(*) AS count
      FROM predictions p
      LEFT JOIN spotlight_players sp
        ON sp.match_id = p.match_id AND CAST(sp.player_id AS TEXT) = p.first_scorer
      WHERE p.match_id = ?
      GROUP BY p.first_scorer
      ORDER BY count DESC, label ASC
      LIMIT 3`)
      .bind(NO_GOAL, matchId).all<Record<string, unknown>>(),
  ]);
  const outcomeCounts = new Map(trendRows(outcomeRows.results).map((item) => [item.key, item.count]));
  const outcomes = [
    { key: "home", label: "Home win", count: outcomeCounts.get("home") || 0 },
    { key: "draw", label: "Draw", count: outcomeCounts.get("draw") || 0 },
    { key: "away", label: "Away win", count: outcomeCounts.get("away") || 0 },
  ];

  return NextResponse.json(
    {
      trends: buildPredictionTrends(
        total,
        outcomes,
        trendRows(scoreRows.results),
        trendRows(scorerRows.results),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
