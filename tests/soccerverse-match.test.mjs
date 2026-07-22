import assert from "node:assert/strict";
import test from "node:test";
import { validGoals } from "../lib/soccerverse-events.ts";

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
