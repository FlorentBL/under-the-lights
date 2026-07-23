export const MAX_AVATAR_DATA_URL_LENGTH = 240_000;

type ParsedAvatar = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
};

function hasSignature(bytes: Uint8Array, mimeType: ParsedAvatar["mimeType"]) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export function parseAvatarDataUrl(value: unknown): ParsedAvatar | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw new Error("Profile photo is too large");
  }

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error("Profile photo must be a JPEG, PNG or WebP image");

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Profile photo data is invalid");
  }
  const mimeType = match[1] as ParsedAvatar["mimeType"];
  if (!bytes.length || !hasSignature(bytes, mimeType)) throw new Error("Profile photo data is invalid");
  return { mimeType, bytes };
}

export function publicAvatarUrl(participantId: string, updatedAt: number) {
  return `/api/players/${encodeURIComponent(participantId)}/avatar?v=${updatedAt}`;
}
