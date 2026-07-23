import assert from "node:assert/strict";
import test from "node:test";
import { deriveSettlementState } from "../lib/settlement-state.ts";

const kickoff = 1_785_002_400;

test("keeps the cockpit open before kick-off", () => {
  assert.deepEqual(deriveSettlementState({
    kickoff,
    now: kickoff * 1000 - 1,
    resultFound: false,
    predictions: 3,
    scores: 0,
  }), {
    status: "open",
    alert: null,
    nextCheckAt: kickoff * 1000,
  });
});

test("warns when Soccerverse exceeds its expected result window", () => {
  const state = deriveSettlementState({
    kickoff,
    now: (kickoff + 8 * 60) * 1000,
    resultFound: false,
    predictions: 3,
    scores: 0,
    lastCheckStatus: "waiting",
  });

  assert.equal(state.status, "waiting");
  assert.match(state.alert, /No Soccerverse result/);
});

test("distinguishes a received result from complete scoring", () => {
  const partial = deriveSettlementState({
    kickoff,
    now: (kickoff + 5 * 60) * 1000,
    resultFound: true,
    predictions: 3,
    scores: 2,
  });
  const complete = deriveSettlementState({
    kickoff,
    now: (kickoff + 5 * 60) * 1000,
    resultFound: true,
    predictions: 3,
    scores: 3,
  });

  assert.equal(partial.status, "result_received");
  assert.match(partial.alert, /1 prediction still/);
  assert.equal(complete.status, "scored");
  assert.equal(complete.alert, null);
  assert.equal(complete.nextCheckAt, null);
});

test("surfaces the latest failed check before delay alerts", () => {
  const state = deriveSettlementState({
    kickoff,
    now: (kickoff + 8 * 60) * 1000,
    resultFound: false,
    predictions: 1,
    scores: 0,
    lastCheckStatus: "failed",
    lastCheckError: "Soccerverse REST returned 503",
  });

  assert.equal(state.alert, "Soccerverse REST returned 503");
});
