import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET() {
  const runtimeEnv = env as Cloudflare.Env & {
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
  };

  return NextResponse.json({
    discord: Boolean(runtimeEnv.DISCORD_CLIENT_ID && runtimeEnv.DISCORD_CLIENT_SECRET),
  });
}
