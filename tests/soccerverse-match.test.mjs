import assert from "node:assert/strict";
import test from "node:test";
import { validGoals } from "../lib/soccerverse-events.ts";
import { resultMayBeAvailable } from "../lib/soccerverse-timing.ts";
import {
  activePlayerClubId,
  playersAvailableForClub,
  shouldRefreshSpotlightSquad,
} from "../lib/soccerverse-squad.ts";

test("checks Soccerverse results from kick-off instead of waiting 90 minutes", () => {
  const kickoff = 1_785_002_400;

  assert.equal(resultMayBeAvailable(kickoff, kickoff * 1000 - 1), false);
  assert.equal(resultMayBeAvailable(kickoff, kickoff * 1000), true);
  assert.equal(resultMayBeAvailable(kickoff, kickoff * 1000 + 5 * 60 * 1000), true);
});

test("removes a goal overturned by the match engine", () => {
  const events = [
    { match_event_id: 3, event_type: "GOAL", player_id: 1100, club_id: 50, time: 53, goal_type: "OPEN_PLAY" },
    { match_event_id: 1, event_type: "GOAL", player_id: 1469, club_id: 1346, time: 10, goal_type: "OPEN_PLAY" },
    { match_event_id: 2, event_type: "GOALCANCELLED", player_id: 1469, club_id: 1346, time: 10, goal_type: null },
  ];

  assert.deepEqual(validGoals(events).map((goal) => goal.player_id), [1100]);
});

test("uses event order to break two goals logged in the same minute", () => {
  const events = [
    { match_event_id: 8, event_type: "GOAL", player_id: 20, club_id: 2, time: 45, goal_type: "OPEN_PLAY" },
    { match_event_id: 7, event_type: "GOAL", player_id: 10, club_id: 1, time: 45, goal_type: "OPEN_PLAY" },
  ];

  assert.equal(validGoals(events)[0]?.player_id, 10);
});

test("assigns incoming loans to the borrowing club and removes outgoing loans", () => {
  const linaresClubId = 9398;
  const squad = [
    { player_id: 1, club_id: linaresClubId, loaned_to_club: null },
    { player_id: 355409, club_id: 1025, loaned_to_club: linaresClubId },
    { player_id: 3, club_id: linaresClubId, loaned_to_club: 1025 },
    { player_id: 4, club_id: linaresClubId, loaned_to_club: null, retired: true },
  ];

  assert.deepEqual(playersAvailableForClub(squad, linaresClubId).map((player) => player.player_id), [1, 355409]);
  assert.equal(activePlayerClubId(squad[1]), linaresClubId);
  assert.equal(activePlayerClubId(squad[2]), 1025);
});

test("refreshes future Spotlight squads when the stored snapshot is stale", () => {
  const now = 2_000_000_000_000;
  const futureKickoff = now / 1000 + 86_400;

  assert.equal(shouldRefreshSpotlightSquad(0, null, futureKickoff, now), true);
  assert.equal(shouldRefreshSpotlightSquad(30, now - 7 * 60 * 60 * 1000, futureKickoff, now), true);
  assert.equal(shouldRefreshSpotlightSquad(30, now - 60 * 60 * 1000, futureKickoff, now), false);
});
