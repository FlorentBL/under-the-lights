import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { loadSettlementCockpit } from "@/lib/settlement-operations";
import { settlePublishedSpotlights } from "@/lib/soccerverse-match";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const cockpit = await loadSettlementCockpit((env as Cloudflare.Env).DB);
  return NextResponse.json({ cockpit });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const db = (env as Cloudflare.Env).DB;
  const before = await loadSettlementCockpit(db);
  if (!before) return NextResponse.json({ error: "No published spotlight" }, { status: 404 });
  if (Date.now() < before.kickoff * 1000) {
    return NextResponse.json({ error: "Result checks begin at kick-off", cockpit: before }, { status: 409 });
  }

  const result = await settlePublishedSpotlights(db, Date.now(), `admin:${access.session.user.id}`);
  const cockpit = await loadSettlementCockpit(db);
  const failed = result.attempts.find((attempt) => attempt.status === "failed");
  return NextResponse.json(
    { cockpit, attempts: result.attempts, error: failed?.error },
    { status: failed ? 502 : 200 },
  );
}
