// Exercises the REAL adapter code against a LOCAL stand-in for Kindwise. This is NOT a live-service test.
import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
import { createServer } from "../server/server.js";
const PNG = "data:image/png;base64," + Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]).toString("base64");
const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(s.address().port)));
let mode = "ok", seenKey = null;
const upstream = http.createServer((req, res) => {
  seenKey = req.headers["api-key"];
  if (mode === "401") { res.writeHead(401); return res.end("{}"); }
  if (mode === "bad") { res.writeHead(200); return res.end('{"nope":1}'); }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ result: { is_mushroom: { probability: 0.98 }, classification: { suggestions: [{ id: "1", name: "Boletus edulis", probability: 0.91, details: { common_names: ["Porcini"] } }] } } }));
});
const up = await listen(upstream);
const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/identify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("not configured -> health false and identify 503 (no fabricated result)", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise" }); const p = await listen(s);
  assert.equal((await (await fetch(`http://127.0.0.1:${p}/api/health`)).json()).configured, false);
  const r = await post(p, { image: PNG }); assert.equal(r.status, 503); assert.equal((await r.json()).error, "not_configured"); s.close();
});
test("configured: normalises upstream, key stays server-side, validates input", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "secret-123", KINDWISE_BASE_URL: `http://127.0.0.1:${up}` }); const p = await listen(s);
  const h = await (await fetch(`http://127.0.0.1:${p}/api/health`)).json();
  assert.equal(h.configured, true); assert.ok(!JSON.stringify(h).includes("secret"));
  mode = "ok"; const r = await post(p, { image: PNG }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(seenKey, "secret-123"); assert.equal(j.suggestions[0].name, "Boletus edulis"); assert.equal(j.isMushroom.probability, 0.98);
  assert.equal((await post(p, { image: "data:text/plain;base64,AAAA" })).status, 400);
  assert.equal((await post(p, { image: "data:image/png;base64," + Buffer.from("not an image at all").toString("base64") })).status, 415);
  s.close();
});
test("upstream failures map to safe errors", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "k", KINDWISE_BASE_URL: `http://127.0.0.1:${up}` }); const p = await listen(s);
  mode = "401"; assert.equal((await post(p, { image: PNG })).status, 502);
  mode = "bad"; assert.equal((await post(p, { image: PNG })).status, 502);
  s.close();
});
test("rate limiting and size limit", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "k", KINDWISE_BASE_URL: `http://127.0.0.1:${up}`, RATE_LIMIT_PER_MIN: "2", MAX_IMAGE_BYTES: "50" }); const p = await listen(s);
  mode = "ok"; const big = "data:image/png;base64," + Buffer.alloc(200, 1).toString("base64");
  assert.equal((await post(p, { image: big })).status, 413);
  assert.equal((await post(p, { image: PNG })).status, 200);
  assert.equal((await post(p, { image: PNG })).status, 429); s.close();
});
test.after(() => upstream.close());
