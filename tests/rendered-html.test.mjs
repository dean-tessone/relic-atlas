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
  assert.match(page, /Play another 10/);
});
