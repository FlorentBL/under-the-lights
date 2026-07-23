import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_AVATAR_DATA_URL_LENGTH,
  parseAvatarDataUrl,
  publicAvatarUrl,
} from "../lib/profile-avatar.ts";

function dataUrl(mimeType, bytes) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

test("accepts supported avatar data with a matching image signature", () => {
  const jpeg = parseAvatarDataUrl(dataUrl("image/jpeg", [0xff, 0xd8, 0xff, 0x01]));
  const png = parseAvatarDataUrl(dataUrl("image/png", [0x89, 0x50, 0x4e, 0x47, 0x01]));
  const webp = parseAvatarDataUrl(dataUrl("image/webp", [
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]));

  assert.equal(jpeg?.mimeType, "image/jpeg");
  assert.equal(png?.mimeType, "image/png");
  assert.equal(webp?.mimeType, "image/webp");
});

test("rejects forged, unsupported and oversized avatar data", () => {
  assert.throws(() => parseAvatarDataUrl(dataUrl("image/png", [0xff, 0xd8, 0xff])), /invalid/);
  assert.throws(() => parseAvatarDataUrl("data:image/gif;base64,R0lGODlh"), /JPEG, PNG or WebP/);
  assert.throws(() => parseAvatarDataUrl(`data:image/png;base64,${"A".repeat(MAX_AVATAR_DATA_URL_LENGTH)}`), /too large/);
});

test("builds a versioned public avatar URL", () => {
  assert.equal(
    publicAvatarUrl("player/id", 1234),
    "/api/players/player%2Fid/avatar?v=1234",
  );
});
