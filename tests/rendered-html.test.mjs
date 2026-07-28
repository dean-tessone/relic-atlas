import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Relic Atlas product shell and metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Relic Atlas — Unlimited Museum Guessing Game<\/title>/i,
  );
  assert.match(html, /Begin an expedition/i);
  assert.match(html, /Ten objects\. One world\. Any time\./i);
  assert.match(html, /property="og:image"/i);
  assert.match(html, /\/og\.png/i);
  assert.doesNotMatch(html, /codex-preview|Starter Project|loading skeleton/i);
});

test("keeps every expedition at ten rounds with repeat avoidance", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const ROUND_COUNT = 10;/);
  assert.match(page, /MAX_ROUND_SCORE = 10_000/);
  assert.match(page, /relic-atlas-seen/);
  assert.match(page, /new Set\(ids\)/);
  assert.match(page, /usedCountryTimeSlots/);
  assert.match(page, /countryTimeSlotsForArtifact/);
  assert.match(page, /const MAX_SELECTION_PASSES = 3;/);
  assert.match(page, /secureShuffle\(found\.flat\(\)\)/);
  assert.match(page, /Play another 10/);
});

test("uses country-aware placement, 250-year buckets, and image galleries", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /const TIME_BUCKET_SIZE = 250;/);
  assert.match(page, /const placeScore = correctCountry\s*\?\s*5000/);
  assert.match(page, /Math\.exp\(-distanceKm \/ 10000\)/);
  assert.match(page, /step=\{TIME_BUCKET_SIZE\}/);
  assert.match(page, /additionalImages/);
  assert.match(page, /className="image-viewer"/);
  assert.match(page, /className="world-map-shell"/);
  assert.match(page, /World_Light_Gray_Base/);
  assert.match(page, /World_Light_Gray_Reference/);
  assert.doesNotMatch(page, /L\.geoJSON\(COUNTRY_FEATURES/);
  assert.match(page, /const \[hasInteracted, setHasInteracted\]/);
  assert.match(page, /map\.on\("zoomstart dragstart"/);
  assert.match(page, /!hasInteracted && !guess && !revealed/);
  assert.match(page, /zoomSnap:\s*1/);
  assert.match(page, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/);
  assert.match(page, /map\.fitBounds\(revealBounds,\s*\{[\s\S]*animate: false/);
  assert.doesNotMatch(styles, /cursor:\s*zoom-in/);
  assert.match(
    styles,
    /\.image-viewer-canvas img\s*\{[^}]*cursor:\s*default/s,
  );
  assert.match(styles, /\.image-viewer\s*\{[^}]*z-index:\s*10000/s);
  assert.match(styles, /\.world-map-shell\s*\{[^}]*isolation:\s*isolate/s);
  assert.match(
    styles,
    /\.world-map img\.leaflet-tile\s*\{[^}]*max-width:\s*none !important/s,
  );
});
