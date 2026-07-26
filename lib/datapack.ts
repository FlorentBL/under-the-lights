export const COMMUNITY_DATAPACK_URL = "https://elrincondeldt.com/sv/rincon_s4.json";
export const COMMUNITY_CLUB_LOGO_BASE_URL = "https://elrincondeldt.com/sv/photos/teams/";

export type DatapackMode = "default" | "community";

export function normalizeDatapackMode(value: unknown): DatapackMode {
  return value === "community" ? "community" : "default";
}

export function parseDatapackMode(value: unknown): DatapackMode {
  if (value === "default" || value === "community") return value;
  throw new Error("Datapack source must be Soccerverse standard or the community pack");
}

export function communityClubLogoUrl(clubId: unknown) {
  const id = Number(clubId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return `${COMMUNITY_CLUB_LOGO_BASE_URL}${id}.png`;
}
