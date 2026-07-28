import assert from "node:assert/strict";
import test from "node:test";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json" with { type: "json" };
import {
  distanceToFeatureBorderKm,
  greatCircleDistanceKm,
  nearestPointOnFeatureBorder,
} from "../lib/geography.mjs";

const squareCountry = {
  type: "Feature",
  properties: { name: "Testland" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-10, -10],
        [-10, 10],
        [10, 10],
        [10, -10],
        [-10, -10],
      ],
    ],
  },
};

test("finds the nearest country border instead of the country center", () => {
  const nearest = nearestPointOnFeatureBorder([11, 0], squareCountry);
  assert.ok(nearest);
  assert.ok(Math.abs(nearest.distanceKm - 111.2) < 1);
  assert.ok(Math.abs(nearest.point[0] - 10) < 0.01);
  assert.ok(Math.abs(nearest.point[1]) < 0.01);

  const distanceToCenter = greatCircleDistanceKm([11, 0], [0, 0]);
  assert.ok(distanceToCenter > nearest.distanceKm * 10);
});

test("keeps any point inside a large answer country eligible for full credit", () => {
  assert.equal(geoContains(squareCountry, [-9, 0]), true);
  assert.equal(geoContains(squareCountry, [9, 0]), true);
});

test("uses the nearest real French border rather than Paris", () => {
  const countries = feature(
    countriesAtlas,
    countriesAtlas.objects.countries,
  );
  const france = countries.features.find(
    (country) => country.properties.name === "France",
  );
  assert.ok(france);

  const london = [-0.1276, 51.5072];
  const borderDistance = distanceToFeatureBorderKm(london, france);
  const parisDistance = greatCircleDistanceKm(london, [2.3522, 48.8566]);

  assert.ok(borderDistance > 100 && borderDistance < 200);
  assert.ok(parisDistance > 300);
  assert.ok(borderDistance < parisDistance / 2);
});
