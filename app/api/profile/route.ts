import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { auth } from "@/lib/auth";
import { parseAvatarDataUrl, publicAvatarUrl } from "@/lib/profile-avatar";
import { resolveSoccerverseUsername } from "@/lib/soccerverse-profile";
import { normalizeDatapackMode, parseDatapackMode, type DatapackMode } from "@/lib/datapack";

type StoredProfile = {
  soccerverse_username: string;
  avatar_data_url: string | null;
  datapack_mode: string;
  updated_at: number;
};

async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user || null;
}

function profilePayload(user: { id: string; image?: string | null }, profile: StoredProfile | null) {
  return {
    soccerverseUsername: profile?.soccerverse_username || null,
    avatarUrl: profile?.avatar_data_url
      ? publicAvatarUrl(user.id, Number(profile.updated_at))
      : user.image || null,
    hasCustomAvatar: Boolean(profile?.avatar_data_url),
    datapackMode: normalizeDatapackMode(profile?.datapack_mode),
  };
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const profile = await (env as Cloudflare.Env).DB
    .prepare("SELECT soccerverse_username, avatar_data_url, datapack_mode, updated_at FROM user_profiles WHERE user_id = ?")
    .bind(user.id)
    .first<StoredProfile>();

  return NextResponse.json(profilePayload(user, profile), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 260_000) {
    return NextResponse.json({ error: "Profile photo is too large" }, { status: 413 });
  }

  const body = await request.json().catch(() => null) as {
    soccerverseUsername?: unknown;
    avatarDataUrl?: unknown;
    datapackMode?: unknown;
  } | null;
  const updatesSoccerverse = Boolean(body && Object.hasOwn(body, "soccerverseUsername"));
  const updatesAvatar = Boolean(body && Object.hasOwn(body, "avatarDataUrl"));
  const updatesDatapack = Boolean(body && Object.hasOwn(body, "datapackMode"));
  if (!body || (!updatesSoccerverse && !updatesAvatar && !updatesDatapack)) {
    return NextResponse.json({ error: "No profile change supplied" }, { status: 400 });
  }

  const db = (env as Cloudflare.Env).DB;
  const existing = await db.prepare(
    "SELECT soccerverse_username, avatar_data_url, datapack_mode, updated_at FROM user_profiles WHERE user_id = ?",
  ).bind(user.id).first<StoredProfile>();
  let soccerverseUsername = existing?.soccerverse_username || "";
  let avatarDataUrl = existing?.avatar_data_url || null;
  let datapackMode: DatapackMode = normalizeDatapackMode(existing?.datapack_mode);

  if (updatesSoccerverse) {
    try {
      soccerverseUsername = await resolveSoccerverseUsername(body.soccerverseUsername);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Soccerverse account could not be verified" },
        { status: 400 },
      );
    }
  }

  if (updatesAvatar) {
    try {
      const parsed = parseAvatarDataUrl(body.avatarDataUrl);
      avatarDataUrl = parsed ? String(body.avatarDataUrl) : null;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Profile photo could not be saved" },
        { status: 400 },
      );
    }
  }

  if (updatesDatapack) {
    try {
      datapackMode = parseDatapackMode(body.datapackMode);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Datapack source is invalid" },
        { status: 400 },
      );
    }
  }

  const now = Date.now();
  await db.prepare(`
    INSERT INTO user_profiles (user_id, soccerverse_username, avatar_data_url, datapack_mode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      soccerverse_username = CASE WHEN ? THEN excluded.soccerverse_username ELSE user_profiles.soccerverse_username END,
      avatar_data_url = CASE WHEN ? THEN excluded.avatar_data_url ELSE user_profiles.avatar_data_url END,
      datapack_mode = CASE WHEN ? THEN excluded.datapack_mode ELSE user_profiles.datapack_mode END,
      updated_at = excluded.updated_at
  `).bind(
    user.id,
    soccerverseUsername,
    avatarDataUrl,
    datapackMode,
    now,
    now,
    updatesSoccerverse ? 1 : 0,
    updatesAvatar ? 1 : 0,
    updatesDatapack ? 1 : 0,
  ).run();

  await db.prepare(`DELETE FROM user_profiles
    WHERE user_id = ? AND soccerverse_username = '' AND avatar_data_url IS NULL AND datapack_mode = 'default'`)
    .bind(user.id)
    .run();
  const saved = await db.prepare(
    "SELECT soccerverse_username, avatar_data_url, datapack_mode, updated_at FROM user_profiles WHERE user_id = ?",
  ).bind(user.id).first<StoredProfile>();

  return NextResponse.json(profilePayload(user, saved));
}
