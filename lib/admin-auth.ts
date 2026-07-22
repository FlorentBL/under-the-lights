import { auth } from "@/lib/auth";
import { env } from "cloudflare:workers";

type AdminEnvironment = Cloudflare.Env & { ADMIN_EMAILS?: string };

function configuredAdminEmails() {
  const value = (env as AdminEnvironment).ADMIN_EMAILS || "";
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false as const, status: 401, error: "Authentication required" };

  const admins = configuredAdminEmails();
  if (!admins.has(session.user.email.toLowerCase())) {
    return { ok: false as const, status: 403, error: "Administrator access required" };
  }

  return { ok: true as const, session };
}
