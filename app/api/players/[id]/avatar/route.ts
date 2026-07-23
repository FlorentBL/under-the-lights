import { env } from "cloudflare:workers";
import { parseAvatarDataUrl } from "@/lib/profile-avatar";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) return new Response("Not found", { status: 404 });

  const profile = await (env as Cloudflare.Env).DB.prepare(
    "SELECT avatar_data_url FROM user_profiles WHERE user_id = ?",
  ).bind(id).first<{ avatar_data_url: string | null }>();
  if (!profile?.avatar_data_url) return new Response("Not found", { status: 404 });

  try {
    const avatar = parseAvatarDataUrl(profile.avatar_data_url);
    if (!avatar) return new Response("Not found", { status: 404 });
    return new Response(Uint8Array.from(avatar.bytes).buffer, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": avatar.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
