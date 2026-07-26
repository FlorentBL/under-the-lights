import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUNITY_CLUB_LOGO_BASE_URL,
  communityClubLogoUrl,
  normalizeDatapackMode,
  parseDatapackMode,
} from "../lib/datapack.ts";

test("builds only fixed community club crest URLs", () => {
  assert.equal(
    communityClubLogoUrl(338),
    `${COMMUNITY_CLUB_LOGO_BASE_URL}338.png`,
  );
  assert.equal(communityClubLogoUrl("344"), `${COMMUNITY_CLUB_LOGO_BASE_URL}344.png`);
  assert.equal(communityClubLogoUrl(0), null);
  assert.equal(communityClubLogoUrl("../private"), null);
});

test("normalizes stored datapack preferences and rejects invalid writes", () => {
  assert.equal(normalizeDatapackMode("community"), "community");
  assert.equal(normalizeDatapackMode("unexpected"), "default");
  assert.equal(parseDatapackMode("default"), "default");
  assert.throws(() => parseDatapackMode("custom"), /Soccerverse standard or the community pack/);
});
