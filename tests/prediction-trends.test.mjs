import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionTrends, MINIMUM_TREND_SAMPLE_SIZE } from "../lib/prediction-trends.ts";

test("hides community picks until the anonymous sample is large enough", () => {
  const trends = buildPredictionTrends(
    MINIMUM_TREND_SAMPLE_SIZE - 1,
    [{ key: "home", label: "Home win", count: 2 }],
    [{ key: "2-1", label: "2 - 1", count: 2 }],
    [{ key: "9", label: "A player", count: 2 }],
  );

  assert.equal(trends.available, false);
  assert.equal(trends.total, 2);
  assert.deepEqual(trends.outcomes, []);
  assert.deepEqual(trends.topScores, []);
  assert.deepEqual(trends.topScorers, []);
});

test("publishes anonymous counts and percentages once the threshold is met", () => {
  const trends = buildPredictionTrends(
    5,
    [
      { key: "home", label: "Home win", count: 3 },
      { key: "draw", label: "Draw", count: 1 },
      { key: "away", label: "Away win", count: 1 },
    ],
    [{ key: "2-1", label: "2 - 1", count: 2 }],
    [{ key: "9", label: "A player", count: 2 }],
  );

  assert.equal(trends.available, true);
  assert.deepEqual(trends.outcomes.map((item) => item.percentage), [60, 20, 20]);
  assert.equal(trends.topScores[0].percentage, 40);
  assert.equal(trends.topScorers[0].percentage, 40);
});
