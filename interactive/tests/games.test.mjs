import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GAMES, MusicGame, coordinates, distanceKm, prepareGameData } from "../src/games.js";
import { createProjection } from "../src/map.js";

const dashboard = JSON.parse(await readFile(new URL("../public/data/dashboard.json", import.meta.url), "utf8"));
const outline = JSON.parse(await readFile(new URL("../public/data/uk-outline.geojson", import.meta.url), "utf8"));
const data = prepareGameData(dashboard);
const random = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

test("geography games exclude contested, regional, missing and wider-area origins", () => {
  assert.equal(GAMES.length, 3);
  assert.ok(data.bands.length > 500);
  assert.equal(data.allBands.length, 1000);
  for (const name of ["Chumbawamba", "Asking Alexandria", "Radiohead", "Joy Division"]) {
    assert.ok(!data.bands.some((band) => band.name === name), name);
  }
  assert.ok(data.bands.some((band) => band.name === "Pulp"));
  const spoiled = prepareGameData({ ...dashboard, bands: [
    { ...data.bands[0], locationStatus: "outside_uk" },
    { ...data.bands[0], placeType: "region" },
    { ...data.bands[0], latitude: null },
    { ...data.bands[0], gameEligible: false },
  ] });
  assert.equal(spoiled.bands.length, 0);
});

test("question generation, hints and scoring survive varied full ten-round games", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    for (const mode of ["pin", "odd"]) {
      const game = new MusicGame(mode, data, { random: random(seed) });
      let expected = 0;
      for (let i = 0; i < 10; i += 1) {
        const r = game.round;
        assert.equal(r.answered, false);
        assert.equal(game.next(), false);
        if (mode === "odd") {
          assert.equal(r.city, r.commonPlace);
          assert.equal(new Set(r.options.map((band) => band.id)).size, 4);
          assert.equal(r.options.filter((band) => band.originCluster === r.commonPlace).length, 3);
        } else if (i % 2 === 0) {
          assert.equal(game.hint(), true);
          const originalHint = r.hint;
          assert.equal(game.hint(), false);
          assert.equal(r.hint, originalHint);
        }
        const answer = mode === "pin" ? coordinates(r.band) : r.band.id;
        assert.equal(game.submit(answer), true);
        if (mode === "odd") assert.equal(r.choice, r.band.id);
        expected += r.hinted ? 60 : 100;
        assert.equal(game.score, expected);
        assert.equal(game.submit(answer), false);
        assert.equal(game.hint(), false);
        assert.equal(game.score, expected);
        assert.equal(game.over, i === 9);
        assert.equal(game.next(), i < 9);
      }
    }
  }
});

test("streak games advance the previous band, avoid ties and stop after a wrong answer", () => {
  for (const mode of ["north"]) {
    const game = new MusicGame(mode, data, { random: random(18) });
    const seen = new Set([game.round.reference.id]);
    for (let i = 0; i < 60; i += 1) {
      const r = game.round;
      assert.ok(!seen.has(r.band.id));
      seen.add(r.band.id);
      assert.ok(Math.abs(r.reference.latitude - r.band.latitude) > 0.05);
      assert.equal(game.submit("sideways"), false);
      game.submit(r.answer);
      assert.equal(game.streak, i + 1);
      assert.equal(game.score, (i + 1) * 100);
      assert.equal(game.next(), true);
      assert.equal(game.round.reference.id, r.band.id);
    }
    const score = game.score;
    const wrong = ["north", "south"].find((answer) => answer !== game.round.answer);
    game.submit(wrong);
    assert.equal(game.over, true);
    assert.equal(game.next(), false);
    assert.equal(game.score, score);
    assert.equal(game.bestStreak, 60);
  }
});

test("pin scoring uses geographical distance and the shared map round-trips UK coordinates", () => {
  assert.equal(distanceKm([-1, 52], [-1, 52]), 0);
  const londonToEdinburgh = distanceKm([-0.1276, 51.5072], [-3.1883, 55.9533]);
  assert.ok(londonToEdinburgh > 530 && londonToEdinburgh < 535);
  const project = createProjection(outline);
  for (const place of data.places) {
    assert.ok(distanceKm(coordinates(place), project.invert(project(coordinates(place)))) < 0.000001);
  }
  const game = new MusicGame("pin", data, { random: random(3) });
  assert.equal(game.submit([NaN, 30]), false);
  assert.equal(game.submit([0, 91]), false);
  assert.equal(game.round.answered, false);
  game.submit([140, -30]);
  assert.equal(game.score, 0);
  assert.ok(game.round.distance > 500);
});

test("competitive players receive the same questions even when one uses hints", () => {
  const a = new MusicGame("odd", data, { competitive: true, date: "2026-09-05" });
  const b = new MusicGame("odd", data, { competitive: true, date: "2026-09-05" });
  for (let i = 0; i < 10; i += 1) {
    assert.equal(a.round.band.id, b.round.band.id);
    assert.deepEqual(a.round.options.map((band) => band.id), b.round.options.map((band) => band.id));
    a.hint();
    a.submit(a.round.band.id);
    b.submit(b.round.band.id);
    a.next(); b.next();
  }
  for (const mode of GAMES.map((definition) => definition.id)) {
    const game = new MusicGame(mode, data, { competitive: true });
    assert.equal(game.timeout(), true);
    assert.equal(game.round.answered, true);
    assert.equal(game.score, 0);
    assert.equal(game.timeout(), false);
  }
});
