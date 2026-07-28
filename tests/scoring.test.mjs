import assert from "node:assert/strict";
import test from "node:test";
import {
  DISTANCE_DECAY_KM,
  TIME_DECAY_BUCKETS,
  locationScore,
  timeScore,
} from "../lib/scoring.mjs";

test("keeps full location credit for the correct country", () => {
  assert.equal(locationScore(0, true), 5000);
  assert.equal(locationScore(9564, true), 5000);
});

test("makes long-distance border misses meaningfully costly", () => {
  assert.equal(DISTANCE_DECAY_KM, 5500);
  assert.equal(locationScore(250, false), 4778);
  assert.equal(locationScore(2000, false), 3476);
  assert.equal(locationScore(9564, false), 879);
  assert.ok(locationScore(15000, false) < 350);
});

test("tightens the 250-year bucket decay", () => {
  assert.equal(TIME_DECAY_BUCKETS, 4);
  assert.equal(timeScore(0), 5000);
  assert.equal(timeScore(1), 3894);
  assert.equal(timeScore(5), 1433);
  assert.equal(timeScore(15), 118);
});
