import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadSeason } from "@/lib/season-data";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const payload = await loadSeason((env as Cloudflare.Env).DB, session?.user.id);
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
