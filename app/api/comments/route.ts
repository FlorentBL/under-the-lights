import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAdminRole } from "@/lib/admin-auth";
import { auth } from "@/lib/auth";
import { COMMENT_COOLDOWN_MS, CommentValidationError, parseCommentBody } from "@/lib/comments";
import { publicAvatarUrl } from "@/lib/profile-avatar";
import { jsonRequestErrorResponse, readJsonObject } from "@/lib/request-validation";

const COMMENT_PAGE_SIZE = 100;

type StoredComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: number;
  author_name: string;
  display_name: string | null;
  auth_image: string | null;
  avatar_data_url: string | null;
  profile_updated_at: number | null;
};

const COMMENT_SELECT = `SELECT c.id, c.user_id, c.body, c.created_at,
    u.name AS author_name, u.image AS auth_image,
    pt.display_name, up.avatar_data_url, up.updated_at AS profile_updated_at
  FROM match_comments c
  JOIN user u ON u.id = c.user_id
  LEFT JOIN participants pt ON pt.id = c.user_id
  LEFT JOIN user_profiles up ON up.user_id = c.user_id`;

function commentPayload(row: StoredComment) {
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: row.display_name || row.author_name,
    avatarUrl: row.avatar_data_url
      ? publicAvatarUrl(row.user_id, Number(row.profile_updated_at))
      : row.auth_image || null,
    body: row.body,
    createdAt: Number(row.created_at),
  };
}

async function publishedMatch(db: D1Database, matchId: string) {
  return db.prepare(`SELECT c.fixture_id
    FROM spotlights s JOIN spotlight_candidates c ON c.id = s.candidate_id
    WHERE s.status = 'published' AND CAST(c.fixture_id AS TEXT) = ?`)
    .bind(matchId).first<Record<string, unknown>>();
}

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get("matchId")?.slice(0, 80) || "";
  if (!matchId) return NextResponse.json({ error: "Match ID required" }, { status: 400 });
  const db = (env as Cloudflare.Env).DB;
  const rows = await db.prepare(`${COMMENT_SELECT}
    WHERE c.match_id = ? ORDER BY c.created_at DESC, c.id DESC LIMIT ${COMMENT_PAGE_SIZE}`)
    .bind(matchId).all<StoredComment>();
  return NextResponse.json(
    { comments: (rows.results || []).map(commentPayload) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonObject(request);
  } catch (error) {
    return jsonRequestErrorResponse(error);
  }

  const matchId = typeof payload.matchId === "string" ? payload.matchId : "";
  if (!/^\d{1,20}$/.test(matchId)) return NextResponse.json({ error: "Invalid match" }, { status: 400 });

  let body: string;
  try {
    body = parseCommentBody(payload.body);
  } catch (error) {
    if (error instanceof CommentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const db = (env as Cloudflare.Env).DB;
  const match = await publishedMatch(db, matchId);
  if (!match) return NextResponse.json({ error: "Published match not found" }, { status: 404 });

  const now = Date.now();
  const latest = await db.prepare(
    "SELECT created_at FROM match_comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(session.user.id).first<{ created_at: number }>();
  if (latest && now - Number(latest.created_at) < COMMENT_COOLDOWN_MS) {
    return NextResponse.json({ error: "You are commenting too quickly. Please wait a moment." }, { status: 429 });
  }

  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO match_comments (id, match_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, matchId, session.user.id, body, now).run();

  const saved = await db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).bind(id).first<StoredComment>();
  return NextResponse.json({ comment: saved ? commentPayload(saved) : null }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 80) || "";
  if (!id) return NextResponse.json({ error: "Comment ID required" }, { status: 400 });

  const db = (env as Cloudflare.Env).DB;
  const comment = await db.prepare("SELECT id, user_id FROM match_comments WHERE id = ?")
    .bind(id).first<{ id: string; user_id: string }>();
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  if (comment.user_id !== session.user.id) {
    const role = await getAdminRole(session.user);
    if (!role) return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
  }

  await db.prepare("DELETE FROM match_comments WHERE id = ?").bind(id).run();
  return NextResponse.json({ deleted: true });
}
