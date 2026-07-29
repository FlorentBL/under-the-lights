import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { env, waitUntil } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { emailDeliveryConfigured, sendAuthEmail, type AuthEmailEnvironment } from "@/lib/auth-email";

type AuthEnvironment = Cloudflare.Env & AuthEmailEnvironment & {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
};

const authEnv = env as AuthEnvironment;
const baseURL = authEnv.BETTER_AUTH_URL || "http://localhost:3000";
const discordEnabled = Boolean(authEnv.DISCORD_CLIENT_ID && authEnv.DISCORD_CLIENT_SECRET);
const transactionalEmailEnabled = emailDeliveryConfigured(authEnv);

export const auth = betterAuth({
  appName: "Under the Lights",
  baseURL,
  secret: authEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(drizzle(authEnv.DB, { schema }), {
    provider: "sqlite",
    schema,
  }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const banned = await authEnv.DB
            .prepare("SELECT user_id FROM banned_users WHERE user_id = ? LIMIT 1")
            .bind(session.userId)
            .first<{ user_id: string }>();
          return !banned;
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: transactionalEmailEnabled,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: transactionalEmailEnabled
      ? async ({ user, url }) => {
          waitUntil(sendAuthEmail(authEnv, {
            kind: "reset-password",
            to: user.email,
            name: user.name,
            url,
          }));
        }
      : undefined,
  },
  emailVerification: transactionalEmailEnabled
    ? {
        expiresIn: 60 * 60,
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          waitUntil(sendAuthEmail(authEnv, {
            kind: "verify-email",
            to: user.email,
            name: user.name,
            url,
          }));
        },
      }
    : undefined,
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
