// Dependency-free Node (>=18) backend: keeps API keys off the browser and (optionally) serves the SPA.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kindwise } from "./providers/kindwise.js";
import { anthropic } from "./providers/anthropic.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const PROVIDERS = { kindwise, anthropic };
const MAGIC = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
];
function sniff(buf) {
  for (const [type, sig] of MAGIC) if (sig.every((b, i) => buf[i] === b)) return type;
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export function createServer(env = process.env) {
  const maxBytes = Number(env.MAX_IMAGE_BYTES || 6 * 1024 * 1024);
  const limit = Number(env.RATE_LIMIT_PER_MIN || 10);
  const origins = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const staticDir = env.STATIC_DIR ? path.resolve(here, env.STATIC_DIR) : null;
  const hits = new Map();
  const provider = PROVIDERS[env.MUSHROOM_PROVIDER || "kindwise"];
  const configured = Boolean(provider && provider.isConfigured(env));

  const send = (res, code, obj, extra = {}) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
    res.end(JSON.stringify(obj));
  };
  const cors = (req) => {
    const o = req.headers.origin;
    return o && origins.includes(o) ? { "Access-Control-Allow-Origin": o, Vary: "Origin", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } : {};
  };
  const rateOk = (ip) => {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length <= limit;
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const c = cors(req);
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, c); return res.end(); }
      if (url.pathname === "/api/health" && req.method === "GET")
        return send(res, 200, { ok: true, configured, provider: provider?.name || null, calibrated: provider?.calibrated ?? null }, c);
      if (url.pathname === "/api/identify" && req.method === "POST") {
        if (!configured) return send(res, 503, { error: "not_configured" }, c);
        if (!rateOk(req.socket.remoteAddress || "?")) return send(res, 429, { error: "rate_limited" }, c);
        const chunks = [];
        let size = 0;
        for await (const ch of req) {
          size += ch.length;
          if (size > maxBytes * 1.4 + 1024) return send(res, 413, { error: "too_large" }, c);
          chunks.push(ch);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return send(res, 400, { error: "bad_image" }, c); }
        const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body?.image || "");
        if (!m) return send(res, 400, { error: "bad_image" }, c);
        const buf = Buffer.from(m[1], "base64");
        if (buf.length > maxBytes) return send(res, 413, { error: "too_large" }, c);
        if (!sniff(buf)) return send(res, 415, { error: "bad_image" }, c);
        try {
          const out = await provider.identify(body.image, env);
          return send(res, 200, out, c);
        } catch (e) {
          console.error("[identify]", e.code || "", e.message);
          const code = e.code === "rate_limited" ? 429 : e.code === "bad_image" ? 400 : 502;
          return send(res, code, { error: e.code === "rate_limited" ? "rate_limited" : e.code === "bad_image" ? "bad_image" : "upstream" }, c);
        }
      }
      if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not_found" }, c);
      if (staticDir && req.method === "GET") {
        let rel = decodeURIComponent(url.pathname);
        if (rel.endsWith("/")) rel += "index.html";
        const file = path.join(staticDir, rel);
        if (!file.startsWith(staticDir + path.sep)) { res.writeHead(403); return res.end(); }
        fs.readFile(file, (err, buf) => {
          if (err) { res.writeHead(404); return res.end("Not found"); }
          const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf" };
          res.writeHead(200, { "Content-Type": (types[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
          res.end(buf);
        });
        return;
      }
      res.writeHead(404); res.end();
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: "server_error" }, c);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadDotEnv(path.join(here, ".env"));
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => {
    const p = PROVIDERS[process.env.MUSHROOM_PROVIDER || "kindwise"];
    console.log(`Mushroom API on http://localhost:${port}  provider=${p?.name || "unknown"} configured=${Boolean(p && p.isConfigured(process.env))}`);
  });
}
