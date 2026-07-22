import assert from "node:assert/strict";
import test from "node:test";
import {
  GOAL_WINDOWS,
  MAX_PREDICTION_POINTS,
  NO_GOAL,
  goalWindowForMinute,
  scorePrediction,
  validatePredictionConsistency,
} from "../lib/scoring.ts";

const result = {
  homeScore: 2,
  awayScore: 1,
  firstScorer: "47120",
  goalWindow: "16-30",
  firstTeam: "9380",
};

test("awards the full 15 points for a perfect prediction", () => {
  const score = scorePrediction(result, result);

  assert.equal(MAX_PREDICTION_POINTS, 15);
  assert.deepEqual(score, {
    outcomePoints: 3,
    exactScorePoints: 5,
    firstScorerPoints: 4,
    goalWindowPoints: 2,
    firstTeamPoints: 1,
    totalPoints: 15,
  });
});

test("separates the correct outcome from the exact-score bonus", () => {
  const score = scorePrediction({ ...result, homeScore: 3, awayScore: 1 }, result);

  assert.equal(score.outcomePoints, 3);
  assert.equal(score.exactScorePoints, 0);
  assert.equal(score.totalPoints, 10);
});

test("allows detail points even when the result prediction is wrong", () => {
  const score = scorePrediction({ ...result, homeScore: 0, awayScore: 2 }, result);

  assert.equal(score.outcomePoints, 0);
  assert.equal(score.exactScorePoints, 0);
  assert.equal(score.totalPoints, 7);
});

test("keeps a goalless prediction worth the same maximum", () => {
  const goalless = {
    homeScore: 0,
    awayScore: 0,
    firstScorer: NO_GOAL,
    goalWindow: NO_GOAL,
    firstTeam: NO_GOAL,
  };

  assert.equal(scorePrediction(goalless, goalless).totalPoints, 15);
  assert.equal(validatePredictionConsistency(goalless), null);
});

test("maps every goal-minute boundary to one supported window", () => {
  assert.deepEqual([1, 15, 16, 30, 31, 45, 46, 60, 61, 75, 76, 90, 105].map(goalWindowForMinute), [
    "1-15", "1-15", "16-30", "16-30", "31-45+", "31-45+", "46-60", "46-60", "61-75", "61-75", "76-90+", "76-90+", "76-90+",
  ]);
  assert.deepEqual(GOAL_WINDOWS.at(-1), NO_GOAL);
});

test("rejects contradictory goal details", () => {
  assert.match(validatePredictionConsistency({ ...result, homeScore: 0, awayScore: 0 }) || "", /0-0/);
  assert.match(validatePredictionConsistency({ ...result, firstScorer: NO_GOAL }) || "", /with goals/);
});
