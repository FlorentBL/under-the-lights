import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { loadPublicPlayerProfile } from "@/lib/season-data";
import { PublicPlayerProfileView } from "./public-player-profile";

// The localized client view contains Settled results, Achievements, and View on Soccerverse sections.
export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) notFound();
  const player = await loadPublicPlayerProfile((env as Cloudflare.Env).DB, id);
  if (!player) notFound();
  return <PublicPlayerProfileView player={player} />;
}
