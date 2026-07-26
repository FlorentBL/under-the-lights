import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { isConfiguredAdmin, requireAdmin } from "@/lib/admin-auth";
import { jsonRequestErrorResponse, readJsonObject } from "@/lib/request-validation";

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
  delegated_admin_id: string | null;
  soccerverse_username: string | null;
};

type RoleUpdate = { userId?: unknown; role?: unknown };

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
      MAX(p.submitted_at) AS last_prediction_at,
      MAX(au.user_id) AS delegated_admin_id,
      MAX(up.soccerverse_username) AS soccerverse_username
    FROM user u
    LEFT JOIN account a ON a.user_id = u.id
    LEFT JOIN session s ON s.user_id = u.id
    LEFT JOIN predictions p ON p.participant_id = u.id
    LEFT JOIN admin_users au ON au.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 500
  `).all<UserRow>();

  const normalized = (users.results || []).map((user) => {
    const roleSource = isConfiguredAdmin({
      email: user.email,
      emailVerified: Boolean(user.email_verified),
    }) ? "configured" : user.delegated_admin_id && user.email_verified ? "delegated" : null;
    return {
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
      role: roleSource ? "admin" : "player",
      roleSource,
      isCurrentUser: user.id === access.session.user.id,
      soccerverseUsername: user.soccerverse_username || null,
    };
  });

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

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let body: RoleUpdate;
  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonRequestErrorResponse(error);
  }
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const role = body?.role;
  if (!userId || (role !== "admin" && role !== "player")) {
    return NextResponse.json({ error: "A valid user and role are required" }, { status: 400 });
  }

  const db = (env as Cloudflare.Env).DB;
  const target = await db.prepare("SELECT id, email, email_verified FROM user WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ id: string; email: string; email_verified: number }>();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const targetIsConfiguredAdmin = isConfiguredAdmin({
    email: target.email,
    emailVerified: Boolean(target.email_verified),
  });

  if (role === "admin" && !target.email_verified) {
    return NextResponse.json({ error: "Verify the user's email before granting administrator access" }, { status: 400 });
  }
  if (role === "player" && targetIsConfiguredAdmin) {
    return NextResponse.json({ error: "Configured administrators cannot be demoted here" }, { status: 400 });
  }
  if (role === "player" && target.id === access.session.user.id) {
    return NextResponse.json({ error: "You cannot remove your own administrator access" }, { status: 400 });
  }

  if (role === "admin") {
    await db.prepare(`
      INSERT INTO admin_users (user_id, granted_by, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO NOTHING
    `).bind(target.id, access.session.user.id, Date.now()).run();
  } else {
    await db.prepare("DELETE FROM admin_users WHERE user_id = ?").bind(target.id).run();
  }

  return NextResponse.json({
    userId: target.id,
    role,
    roleSource: role === "admin" ? (targetIsConfiguredAdmin ? "configured" : "delegated") : null,
  });
}
