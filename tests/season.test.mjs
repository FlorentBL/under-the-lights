import assert from "node:assert/strict";
import test from "node:test";
import { calculateBadgeProgress } from "../lib/season.ts";

function historyItem(overrides = {}) {
  return {
    matchId: "1",
    weekKey: "2026-W01",
    kickoff: 1,
    countryCode: "ESP",
    competitionName: "League",
    homeName: "Home",
    awayName: "Away",
    homePosition: 8,
    awayPosition: 2,
    prediction: { homeScore: 1, awayScore: 0, firstScorer: "10", goalWindow: "1-15", firstTeam: "1" },
    result: { homeScore: 1, awayScore: 0, firstScorer: "10", firstGoalMinute: 8, goalWindow: "1-15", firstTeam: "1", settledAt: 2 },
    score: { outcomePoints: 3, exactScorePoints: 5, firstScorerPoints: 4, goalWindowPoints: 2, firstTeamPoints: 1, totalPoints: 15, scoredAt: 2 },
    ...overrides,
  };
}

test("derives achievement progress from settled prediction history", () => {
  const countries = ["ESP", "ENG", "FRA", "ITA", "BRA"];
  const history = countries.map((countryCode, index) => historyItem({ matchId: String(index), kickoff: index, countryCode }));
  const badges = Object.fromEntries(calculateBadgeProgress(history).map((badge) => [badge.key, badge]));

  assert.equal(badges.bullseye.unlocked, true);
  assert.equal(badges["perfect-timing"].unlocked, true);
  assert.equal(badges["on-fire"].progress, 5);
  assert.equal(badges["globe-trotter"].progress, 5);
  assert.equal(badges["against-the-odds"].unlocked, true);
});

test("only awards The Wall for an exact goalless prediction", () => {
  const goalless = historyItem({
    prediction: { homeScore: 0, awayScore: 0, firstScorer: "no-goal", goalWindow: "no-goal", firstTeam: "no-goal" },
    result: { homeScore: 0, awayScore: 0, firstScorer: "no-goal", firstGoalMinute: null, goalWindow: "no-goal", firstTeam: "no-goal", settledAt: 2 },
  });
  const wall = calculateBadgeProgress([goalless]).find((badge) => badge.key === "the-wall");
  assert.equal(wall?.unlocked, true);
});

test("a missed result breaks the On Fire streak and pending games do not", () => {
  const correct = Array.from({ length: 4 }, (_, index) => historyItem({ matchId: `c${index}`, kickoff: index }));
  const missed = historyItem({ matchId: "miss", kickoff: 5, score: { outcomePoints: 0, exactScorePoints: 0, firstScorerPoints: 0, goalWindowPoints: 0, firstTeamPoints: 0, totalPoints: 0, scoredAt: 5 } });
  const pending = historyItem({ matchId: "pending", kickoff: 6, result: null, score: null });
  const after = historyItem({ matchId: "after", kickoff: 7 });
  const fire = calculateBadgeProgress([...correct, missed, pending, after]).find((badge) => badge.key === "on-fire");
  assert.equal(fire?.progress, 4);
  assert.equal(fire?.unlocked, false);
});
