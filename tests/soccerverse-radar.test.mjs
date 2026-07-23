import assert from "node:assert/strict";
import test from "node:test";
import {
  hasTwoActiveManagers,
  isManagerActive,
  MANAGER_ACTIVE_WINDOW_SECONDS,
} from "../lib/manager-activity.ts";

test("uses Soccerverse's fourteen-day manager activity window", () => {
  const now = 2_000_000_000;
  assert.equal(isManagerActive(now - MANAGER_ACTIVE_WINDOW_SECONDS + 1, now), true);
  assert.equal(isManagerActive(now - MANAGER_ACTIVE_WINDOW_SECONDS, now), false);
  assert.equal(isManagerActive(null, now), false);
  assert.equal(isManagerActive(0, now), false);
});

test("requires a named and recently active manager for both clubs", () => {
  const now = 2_000_000_000;
  const activity = new Map([
    ["homeboss", now - 60],
    ["awayboss", now - 120],
    ["inactiveboss", now - MANAGER_ACTIVE_WINDOW_SECONDS],
  ]);

  assert.equal(hasTwoActiveManagers("HomeBoss", "AwayBoss", activity, now), true);
  assert.equal(hasTwoActiveManagers("HomeBoss", null, activity, now), false);
  assert.equal(hasTwoActiveManagers("HomeBoss", "MissingBoss", activity, now), false);
  assert.equal(hasTwoActiveManagers("HomeBoss", "InactiveBoss", activity, now), false);
});
