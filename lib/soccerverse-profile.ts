const SOCCERVERSE_USERS_URL = "https://services.soccerverse.com/api/users";
const SOCCERVERSE_PROFILE_URL = "https://play.soccerverse.com/profile";
const MAX_USERNAME_LENGTH = 48;

type SoccerverseDirectoryResponse = {
  items?: Array<{ name?: unknown }>;
};

export function normalizeSoccerverseUsername(value: unknown) {
  if (typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate) return "";

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.hostname !== "play.soccerverse.com" || url.pathname !== "/profile") return null;
      candidate = url.searchParams.get("user")?.trim() || "";
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/^@/, "").trim();
  if (candidate.length < 2 || candidate.length > MAX_USERNAME_LENGTH) return null;
  if (/[\u0000-\u001f\u007f/?#&=]/.test(candidate)) return null;
  return candidate;
}

export function soccerverseProfileUrl(username: string) {
  return `${SOCCERVERSE_PROFILE_URL}?user=${encodeURIComponent(username)}`;
}

export async function resolveSoccerverseUsername(value: unknown, fetcher: typeof fetch = fetch) {
  const candidate = normalizeSoccerverseUsername(value);
  if (candidate === null) throw new Error("Enter a valid Soccerverse username");
  if (!candidate) return "";

  const url = new URL(SOCCERVERSE_USERS_URL);
  url.searchParams.set("names", candidate);
  url.searchParams.set("per_page", "5");
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Soccerverse account verification is unavailable");

  const payload = await response.json() as SoccerverseDirectoryResponse;
  const match = payload.items?.find((item) =>
    typeof item.name === "string" && item.name.toLowerCase() === candidate.toLowerCase(),
  );
  if (!match || typeof match.name !== "string") throw new Error("Soccerverse account not found");
  return match.name;
}
