import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

type AuthEnvironment = Cloudflare.Env & {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
};

const authEnv = env as AuthEnvironment;
const baseURL = authEnv.BETTER_AUTH_URL || "http://localhost:3000";
const discordEnabled = Boolean(authEnv.DISCORD_CLIENT_ID && authEnv.DISCORD_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "Under the Lights",
  baseURL,
  secret: authEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(drizzle(authEnv.DB, { schema }), {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  socialProviders: discordEnabled
    ? {
        discord: {
          clientId: authEnv.DISCORD_CLIENT_ID!,
          clientSecret: authEnv.DISCORD_CLIENT_SECRET!,
        },
      }
    : {},
  trustedOrigins: [
    baseURL,
    "http://localhost:3000",
    "http://localhost:5173",
    "https://svutl.vercel.app",
  ],
});
