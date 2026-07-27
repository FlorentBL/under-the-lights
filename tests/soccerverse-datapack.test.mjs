import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDatapackUrl,
  parseSoccerverseDatapack,
} from "../lib/soccerverse-datapack.ts";

test("reads accented player names from a Soccerverse datapack", () => {
  const parsed = parseSoccerverseDatapack({
    PackData: {
      PlayerData: {
        P: [
          { id: "286564", f: "Alejandro", s: "Suárez Cardero" },
          { id: "99", f: null, s: null },
        ],
      },
    },
  }, "https://example.com/world.json", 1234);

  assert.equal(parsed.names.get(286564), "Alejandro Suárez Cardero");
  assert.deepEqual(parsed.validation, {
    url: "https://example.com/world.json",
    totalPlayers: 2,
    namedPlayers: 1,
    unnamedPlayers: 1,
    coveragePercent: 50,
    checkedAt: 1234,
  });
});

test("reads club names, colors and logos from the same datapack", () => {
  const parsed = parseSoccerverseDatapack({
    PackData: {
      PlayerData: {
        P: [{ id: "1", f: "Test", s: "Player" }],
      },
      ClubData: {
        baseImageUrl: "https://elrincondeldt.com/sv/photos/teams/",
        C: [
          { id: "4755", n: "Juventude Évora", rgb: "0,0,255" },
          { id: "4864", n: "União Lamas", rgb: "255,0,0" },
        ],
      },
    },
  }, "https://elrincondeldt.com/sv/rincon_s4.json");

  assert.deepEqual(parsed.clubs.get(4755), {
    id: 4755,
    name: "Juventude Évora",
    logoUrl: "https://elrincondeldt.com/sv/photos/teams/4755.png",
    color: "rgb(0, 0, 255)",
  });
  assert.equal(parsed.clubs.get(4864)?.logoUrl, "https://elrincondeldt.com/sv/photos/teams/4864.png");
});

test("only accepts public HTTPS datapack URLs", () => {
  assert.equal(normalizeDatapackUrl(" https://example.com/world.json#players "), "https://example.com/world.json");
  assert.throws(() => normalizeDatapackUrl("http://example.com/world.json"), /HTTPS/);
  assert.throws(() => normalizeDatapackUrl("https://127.0.0.1/world.json"), /not allowed/);
  assert.throws(() => normalizeDatapackUrl("not a url"), /valid datapack URL/);
});

test("rejects JSON without Soccerverse player data", () => {
  assert.throws(
    () => parseSoccerverseDatapack({}, "https://example.com/world.json"),
    /does not contain Soccerverse player data/,
  );
});
