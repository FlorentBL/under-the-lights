import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { isAdminEmail, requireAdmin } from "@/lib/admin-auth";

type UserRow = {
  id: string;
  name: string;
  email: string;
  email_verified: number;
  created_at: number;
  updated_at: number;
  providers: string | null;
  last_session_at: number | null;
  prediction_count: number;
  last_prediction_at: number | null;
};

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const db = (env as Cloudflare.Env).DB;
  const users = await db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.email_verified,
      u.created_at,
      u.updated_at,
      GROUP_CONCAT(DISTINCT a.provider_id) AS providers,
      MAX(s.updated_at) AS last_session_at,
      COUNT(DISTINCT p.id) AS prediction_count,
      MAX(p.submitted_at) AS last_prediction_at
    FROM user u
    LEFT JOIN account a ON a.user_id = u.id
    LEFT JOIN session s ON s.user_id = u.id
    LEFT JOIN predictions p ON p.participant_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 500
  `).all<UserRow>();

  const normalized = (users.results || []).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    providers: String(user.providers || "credential").split(",").filter(Boolean),
    createdAt: Number(user.created_at) * 1000,
    updatedAt: Number(user.updated_at) * 1000,
    lastActiveAt: Math.max(
      Number(user.updated_at) * 1000,
      Number(user.last_session_at || 0) * 1000,
      Number(user.last_prediction_at || 0),
    ),
    predictionCount: Number(user.prediction_count || 0),
    role: isAdminEmail(user.email) ? "admin" : "player",
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return NextResponse.json({
    users: normalized,
    summary: {
      total: normalized.length,
      joinedThisWeek: normalized.filter((user) => user.createdAt >= weekAgo).length,
      verified: normalized.filter((user) => user.emailVerified).length,
      predictors: normalized.filter((user) => user.predictionCount > 0).length,
    },
  });
}
