export const DATAPACK_SETTING_KEY = "soccerverse_datapack_url";
export const DEFAULT_SOCCERVERSE_DATAPACK_URL = "https://elrincondeldt.com/sv/rincon_s4.json";
export const DEFAULT_SOCCERVERSE_CLUB_IMAGE_URL = "https://elrincondeldt.com/sv/photos/teams/";

type DatapackPlayer = {
  id: string | number;
  f?: string | null;
  s?: string | null;
};

type DatapackClub = {
  id: string | number;
  n?: string | null;
  rgb?: string | null;
};

type DatapackPayload = {
  PackData?: {
    PlayerData?: {
      P?: DatapackPlayer[];
    };
    ClubData?: {
      C?: DatapackClub[];
      baseImageUrl?: string | null;
    };
  };
};

export type SoccerverseClubMetadata = {
  id: number;
  name: string;
  logoUrl: string | null;
  color: string | null;
};

export type DatapackValidation = {
  url: string;
  totalPlayers: number;
  namedPlayers: number;
  unnamedPlayers: number;
  coveragePercent: number;
  checkedAt: number;
};

function normalizeClubColor(value: string | null | undefined) {
  if (!value || !/^\d{1,3},\d{1,3},\d{1,3}$/.test(value)) return null;
  const channels = value.split(",").map(Number);
  return channels.every((channel) => channel >= 0 && channel <= 255)
    ? `rgb(${channels.join(", ")})`
    : null;
}

export function soccerverseClubLogoUrl(baseImageUrl: string | null | undefined, clubId: number) {
  if (!baseImageUrl) return null;
  try {
    const base = new URL(baseImageUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    return new URL(`${clubId}.png`, base).toString();
  } catch {
    return null;
  }
}

function privateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") return true;
  const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function normalizeDatapackUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) throw new Error("Enter a valid datapack URL");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid datapack URL");
  }
  if (url.protocol !== "https:") throw new Error("The datapack URL must use HTTPS");
  if (url.username || url.password || privateHostname(url.hostname)) {
    throw new Error("This datapack host is not allowed");
  }
  url.hash = "";
  return url.toString();
}

export function parseSoccerverseDatapack(payload: DatapackPayload, url: string, checkedAt = Date.now()) {
  const players = payload.PackData?.PlayerData?.P;
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("The file does not contain Soccerverse player data");
  }

  const names = new Map<number, string>();
  let namedPlayers = 0;
  for (const player of players) {
    const playerId = Number(player.id);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) continue;
    const name = `${player.f || ""} ${player.s || ""}`.replace(/\s+/g, " ").trim();
    if (name) {
      names.set(playerId, name);
      namedPlayers += 1;
    }
  }

  const totalPlayers = players.length;
  const clubs = new Map<number, SoccerverseClubMetadata>();
  const clubRows = payload.PackData?.ClubData?.C;
  const clubBaseImageUrl = payload.PackData?.ClubData?.baseImageUrl;
  if (Array.isArray(clubRows)) {
    for (const club of clubRows) {
      const clubId = Number(club.id);
      if (!Number.isSafeInteger(clubId) || clubId <= 0) continue;
      const name = String(club.n || "").trim();
      clubs.set(clubId, {
        id: clubId,
        name: name || `Club ${clubId}`,
        logoUrl: soccerverseClubLogoUrl(clubBaseImageUrl, clubId),
        color: normalizeClubColor(club.rgb),
      });
    }
  }

  return {
    names,
    clubs,
    validation: {
      url,
      totalPlayers,
      namedPlayers,
      unnamedPlayers: totalPlayers - namedPlayers,
      coveragePercent: Math.round(namedPlayers / totalPlayers * 1000) / 10,
      checkedAt,
    } satisfies DatapackValidation,
  };
}

export async function validateSoccerverseDatapack(value: string) {
  const url = normalizeDatapackUrl(value);
  const response = await fetch(url, {
    headers: { "User-Agent": "Under-the-Lights/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`The datapack returned HTTP ${response.status}`);
  const payload = await response.json() as DatapackPayload;
  return parseSoccerverseDatapack(payload, url);
}

export async function getSoccerverseDatapackUrl(db: D1Database) {
  const setting = await db.prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(DATAPACK_SETTING_KEY)
    .first<{ value: string }>();
  return setting?.value ? normalizeDatapackUrl(setting.value) : DEFAULT_SOCCERVERSE_DATAPACK_URL;
}

export async function saveSoccerverseDatapackUrl(
  db: D1Database,
  value: string,
  updatedBy: string,
  updatedAt = Date.now(),
) {
  const url = normalizeDatapackUrl(value);
  await db.prepare(`INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(DATAPACK_SETTING_KEY, url, updatedBy, updatedAt)
    .run();
  return { url, updatedBy, updatedAt };
}

export async function loadSoccerversePlayerNames(db: D1Database) {
  const url = await getSoccerverseDatapackUrl(db);
  return validateSoccerverseDatapack(url);
}

export const loadSoccerverseDatapack = loadSoccerversePlayerNames;
