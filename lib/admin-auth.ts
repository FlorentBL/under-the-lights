import { auth } from "@/lib/auth";
import { env } from "cloudflare:workers";
import {
  isVerifiedConfiguredAdmin,
  parseAdminEmailAllowlist,
  type AdminIdentity,
} from "@/lib/admin-role";

type AdminEnvironment = Cloudflare.Env & { ADMIN_EMAILS?: string };

function configuredAdminEmails() {
  const value = (env as AdminEnvironment).ADMIN_EMAILS || "";
  return parseAdminEmailAllowlist(value);
}

export function isConfiguredAdmin(user: Pick<AdminIdentity, "email" | "emailVerified">) {
  return isVerifiedConfiguredAdmin(user, configuredAdminEmails());
}

export async function getAdminRole(user: AdminIdentity) {
  if (!user.emailVerified) return null;
  if (isConfiguredAdmin(user)) return "configured" as const;

  const delegated = await (env as Cloudflare.Env).DB
    .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first<{ user_id: string }>();

  return delegated ? "delegated" as const : null;
}

export async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false as const, status: 401, error: "Authentication required" };

  const roleSource = await getAdminRole(session.user);
  if (!roleSource) {
    return { ok: false as const, status: 403, error: "Administrator access required" };
  }

  return { ok: true as const, session, roleSource };
}
