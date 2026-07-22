import assert from "node:assert/strict";
import test from "node:test";
import { buildEditorialDraft } from "../lib/editorial-story.ts";

const topTwoCandidate = {
  homeName: "Amorebieta",
  awayName: "Linares Deportivo",
  competitionName: "Segunda Division RFEF",
  homePosition: 2,
  awayPosition: 1,
  homePoints: 6,
  awayPoints: 6,
  homeRecord: "2-0-0",
  awayRecord: "2-0-0",
  homeManager: "Snow",
  awayManager: "NachoAlmirante",
  homeStrength: 64.4,
  awayStrength: 64.4,
  reasons: ["Top-two clash", "Level on points", "Lower-division spotlight"],
};

test("builds a factual dramatic story from the radar data", () => {
  const draft = buildEditorialDraft(topTwoCandidate, "dramatic");

  assert.match(draft.title, /Perfect starts/);
  assert.match(draft.summary, /Six points from six/);
  assert.match(draft.summary, /64\.4/);
  assert.match(draft.summary, /Second-placed Amorebieta host leaders Linares Deportivo/);
  assert.ok(draft.title.length <= 120);
  assert.ok(draft.summary.length <= 360);
  assert.doesNotMatch(`${draft.title}${draft.summary}`, /[—–]/);
});

test("offers three distinct editorial directions", () => {
  const drafts = ["dramatic", "analytical", "discovery"].map((tone) => buildEditorialDraft(topTwoCandidate, tone));

  assert.equal(new Set(drafts.map((draft) => draft.title)).size, 3);
  assert.match(drafts[1].summary, /level on 6 points/);
  assert.match(drafts[2].summary, /Segunda Division RFEF/);
});

test("regenerates the voice without changing the underlying facts", () => {
  const first = buildEditorialDraft(topTwoCandidate, "dramatic", 0);
  const second = buildEditorialDraft(topTwoCandidate, "dramatic", 1);

  assert.notEqual(first.summary, second.summary);
  assert.match(second.summary, /Six points from six/);
  assert.match(second.summary, /64\.4/);
});

test("handles sparse candidates without inventing missing data", () => {
  const draft = buildEditorialDraft({
    ...topTwoCandidate,
    homePosition: null,
    awayPosition: null,
    homePoints: null,
    awayPoints: null,
    homeRecord: null,
    awayRecord: null,
    homeManager: null,
    awayManager: null,
    homeStrength: null,
    awayStrength: null,
    reasons: [],
  }, "analytical");

  assert.doesNotMatch(draft.summary, /null|undefined|points|rating|manager/i);
  assert.match(draft.summary, /Amorebieta meet Linares Deportivo/);
});
