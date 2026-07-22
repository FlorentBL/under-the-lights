import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYER_POSITIONS,
  positionCategories,
  positionSummary,
  positionsForMask,
  primaryPositionCategory,
} from "../lib/player-positions.ts";

test("maps every Soccerverse position bit to its official abbreviation", () => {
  assert.equal(PLAYER_POSITIONS.length, 16);
  assert.deepEqual(PLAYER_POSITIONS.map((position) => position.bit), Array.from({ length: 16 }, (_, index) => 2 ** index));
  assert.equal(positionSummary(1), "GK");
  assert.equal(positionSummary(4096), "AMR");
  assert.equal(positionSummary(16384), "FC");
  assert.equal(positionSummary(32768), "FR");
});

test("decodes multi-position bitmasks and their categories", () => {
  const mask = 4 | 32 | 16384;
  assert.deepEqual(positionsForMask(mask).map((position) => position.code), ["CB", "DMC", "FC"]);
  assert.equal(positionSummary(mask), "CB / DMC / FC");
  assert.deepEqual(positionCategories(mask), ["DEF", "FWD"]);
  assert.equal(primaryPositionCategory(mask), "DEF");
});

test("handles a missing position without inventing one", () => {
  assert.equal(positionSummary(null), "N/A");
  assert.deepEqual(positionCategories(0), []);
  assert.equal(primaryPositionCategory(null), null);
});
