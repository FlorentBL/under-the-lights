import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { auth } from "@/lib/auth";
import { resolveSoccerverseUsername } from "@/lib/soccerverse-profile";

async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user || null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const profile = await (env as Cloudflare.Env).DB
    .prepare("SELECT soccerverse_username FROM user_profiles WHERE user_id = ?")
    .bind(user.id)
    .first<{ soccerverse_username: string }>();

  return NextResponse.json(
    { soccerverseUsername: profile?.soccerverse_username || null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { soccerverseUsername?: unknown } | null;
  if (!body || !("soccerverseUsername" in body)) {
    return NextResponse.json({ error: "Soccerverse username required" }, { status: 400 });
  }

  let soccerverseUsername: string;
  try {
    soccerverseUsername = await resolveSoccerverseUsername(body.soccerverseUsername);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Soccerverse account could not be verified" },
      { status: 400 },
    );
  }

  const db = (env as Cloudflare.Env).DB;
  if (!soccerverseUsername) {
    await db.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(user.id).run();
    return NextResponse.json({ soccerverseUsername: null });
  }

  const now = Date.now();
  await db.prepare(`
    INSERT INTO user_profiles (user_id, soccerverse_username, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      soccerverse_username = excluded.soccerverse_username,
      updated_at = excluded.updated_at
  `).bind(user.id, soccerverseUsername, now, now).run();

  return NextResponse.json({ soccerverseUsername });
}
