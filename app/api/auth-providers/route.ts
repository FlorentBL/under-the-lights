import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { emailDeliveryConfigured, type AuthEmailEnvironment } from "@/lib/auth-email";

export async function GET() {
  const runtimeEnv = env as Cloudflare.Env & AuthEmailEnvironment & {
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
  };

  return NextResponse.json({
    discord: Boolean(runtimeEnv.DISCORD_CLIENT_ID && runtimeEnv.DISCORD_CLIENT_SECRET),
    emailVerification: emailDeliveryConfigured(runtimeEnv),
    passwordReset: emailDeliveryConfigured(runtimeEnv),
  });
}
