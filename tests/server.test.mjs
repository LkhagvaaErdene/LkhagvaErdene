// Exercises the REAL adapter code against a LOCAL stand-in for Kindwise. This is NOT a live-service test.
import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
import { createServer, parseDotEnv } from "../server/server.js";
import fs from "node:fs";
const PNG = "data:image/png;base64," + Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]).toString("base64");
const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(s.address().port)));
let mode = "ok", seenKey = null, seenBody = "";
const upstream = http.createServer(async (req, res) => {
  seenKey = req.headers["api-key"];
  const bc = []; for await (const c of req) bc.push(c); seenBody = Buffer.concat(bc).toString();
  if (mode === "401") { res.writeHead(401); return res.end("{}"); }
  if (mode === "429") { res.writeHead(429); return res.end("{}"); }
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
  assert.ok(!seenBody.includes("similar_images"), "similar_images must be omitted"); assert.ok(JSON.parse(seenBody).images[0].startsWith("data:image/"));
  assert.equal((await post(p, { image: "data:text/plain;base64,AAAA" })).status, 400);
  assert.equal((await post(p, { image: "data:image/png;base64," + Buffer.from("not an image at all").toString("base64") })).status, 415);
  s.close();
});
test("upstream failures map to safe errors", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "test-key-123", KINDWISE_BASE_URL: `http://127.0.0.1:${up}` }); const p = await listen(s);
  mode = "401"; assert.equal((await post(p, { image: PNG })).status, 502);
  mode = "bad"; assert.equal((await post(p, { image: PNG })).status, 502);
  s.close();
});
test("rate limiting and size limit", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "test-key-123", KINDWISE_BASE_URL: `http://127.0.0.1:${up}`, RATE_LIMIT_PER_MIN: "2", MAX_IMAGE_BYTES: "50" }); const p = await listen(s);
  mode = "ok"; const big = "data:image/png;base64," + Buffer.alloc(200, 1).toString("base64");
  assert.equal((await post(p, { image: big })).status, 413);
  assert.equal((await post(p, { image: PNG })).status, 200);
  assert.equal((await post(p, { image: PNG })).status, 429); s.close();
});
test(".env parsing: inline comments never become values (regression: copied .env.example)", () => {
  const e = parseDotEnv(fs.readFileSync(new URL("../server/.env.example", import.meta.url), "utf8"));
  assert.equal(e.MUSHROOM_PROVIDER, "kindwise"); assert.equal(e.KINDWISE_API_KEY, ""); assert.equal(e.PORT, "8787");
  const o = parseDotEnv('A=1   # note\nB="x # y"\nC=\'z\'  # c\nD=http://h/#frag\n# E=1');
  assert.deepEqual(o, { A: "1", B: "x # y", C: "z", D: "http://h/#frag" });
});
test("serves the SPA by default (src or docs) and reports why identification is unavailable", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise" }); const p = await listen(s);
  const h = await (await fetch(`http://127.0.0.1:${p}/api/health`)).json();
  assert.equal(h.configured, false); assert.equal(h.reason, "missing_key"); assert.equal(h.serving, true);
  const r = await fetch(`http://127.0.0.1:${p}/`); assert.equal(r.status, 200); assert.match(await r.text(), /<div id="app">/);
  assert.equal((await fetch(`http://127.0.0.1:${p}/`, { method: "HEAD" })).status, 200);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(`http://127.0.0.1:${p}/..%2f..%2fetc/passwd`)).status === 200, false);
  s.close();
  const bad = createServer({ MUSHROOM_PROVIDER: "nonsense" }); const q = await listen(bad);
  assert.equal((await (await fetch(`http://127.0.0.1:${q}/api/health`)).json()).reason, "unknown_provider"); bad.close();
});
test("CORS: localhost pages allowed in dev, configured origins allowed, others and production-localhost refused", async () => {
  const get = async (env, origin) => { const s = createServer(env); const p = await listen(s); const r = await fetch(`http://127.0.0.1:${p}/api/health`, { headers: { Origin: origin } }); s.close(); return r.headers.get("access-control-allow-origin"); };
  assert.equal(await get({}, "http://localhost:5500"), "http://localhost:5500");
  assert.equal(await get({}, "http://evil.example"), null);
  assert.equal(await get({ ALLOWED_ORIGINS: "https://me.github.io" }, "https://me.github.io"), "https://me.github.io");
  assert.equal(await get({ NODE_ENV: "production" }, "http://localhost:5500"), null);
});
test("a note or placeholder in the key line is not a key (reason: invalid_key); upstream 401 and 429 get clear codes", async () => {
  const s = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "хэргээр нууцлав" }); const p = await listen(s);
  const h = await (await fetch(`http://127.0.0.1:${p}/api/health`)).json();
  assert.equal(h.configured, false); assert.equal(h.reason, "invalid_key"); s.close();
  const s2 = createServer({ MUSHROOM_PROVIDER: "kindwise", KINDWISE_API_KEY: "test-key-123", KINDWISE_BASE_URL: `http://127.0.0.1:${up}` }); const p2 = await listen(s2);
  mode = "401"; assert.equal((await (await post(p2, { image: PNG })).json()).error, "upstream_auth");
  mode = "429"; const r = await post(p2, { image: PNG }); assert.equal(r.status, 429); assert.equal((await r.json()).error, "upstream_rate"); s2.close();
});
test.after(() => upstream.close());
