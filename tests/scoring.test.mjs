import assert from "node:assert/strict";
import test from "node:test";
import {
  DISTANCE_DECAY_KM,
  TIME_DECAY_YEARS,
  locationScore,
  timeScore,
  yearErrorForRange,
} from "../lib/scoring.mjs";

test("matches the canonical exponential geography curve", () => {
  assert.equal(DISTANCE_DECAY_KM, 2000);
  assert.equal(locationScore(0), 5000);
  assert.equal(locationScore(240), 4435);
  assert.equal(locationScore(524), 3848);
  assert.equal(locationScore(730), 3471);
  assert.equal(locationScore(2420), 1491);
  assert.equal(locationScore(9591), 41);
  assert.equal(locationScore(13098), 7);
});

test("measures the nearest year gap between the selected and accepted ranges", () => {
  assert.equal(yearErrorForRange(500, 500, 749), 0);
  assert.equal(yearErrorForRange(500, 750, 900), 0);
  assert.equal(yearErrorForRange(500, 850, 900), 100);
  assert.equal(yearErrorForRange(1000, 700, 950), 50);
  assert.equal(yearErrorForRange(-1000, -1200, -900), 0);
  assert.equal(yearErrorForRange(-1500, -1100, -900), 150);
  assert.equal(yearErrorForRange(500, 900, 850), 100);
});

test("matches the canonical exponential time curve", () => {
  assert.equal(TIME_DECAY_YEARS, 1000);
  assert.equal(timeScore(0), 5000);
  assert.equal(timeScore(50), 4756);
  assert.equal(timeScore(100), 4524);
  assert.equal(timeScore(701), 2480);
  assert.equal(timeScore(1100), 1664);
  assert.equal(timeScore(1725), 891);
  assert.equal(timeScore(2675), 345);
});
