// Dependency-free Node (>=18) backend: keeps API keys off the browser and (optionally) serves the SPA.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kindwise } from "./providers/kindwise.js";
import { anthropic } from "./providers/anthropic.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Parses KEY=value lines. Inline "# comments" after an unquoted value are stripped, so copying
// .env.example verbatim cannot turn a comment into the value (e.g. an API key or a path).
export function parseDotEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    const q = /^(["'])(.*?)\1(?:\s+#.*)?$/.exec(v);
    if (q) v = q[2];
    else v = v.replace(/(^|\s)#.*$/, "").trim();
    out[m[1]] = v;
  }
  return out;
}

function loadDotEnv(file) {
  try {
    const vars = parseDotEnv(fs.readFileSync(file, "utf8"));
    for (const [k, v] of Object.entries(vars)) if (!(k in process.env)) process.env[k] = v;
  } catch {}
}

// Serve the SPA from STATIC_DIR, otherwise from ../docs or ../src, whichever exists.
function pickStaticDir(env) {
  if (env.STATIC_DIR) return path.resolve(here, env.STATIC_DIR);
  for (const d of ["../docs", "../src"]) {
    const dir = path.resolve(here, d);
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
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
  const staticDir = pickStaticDir(env);
  const hits = new Map();
  const providerName = String(env.MUSHROOM_PROVIDER || "kindwise").trim().toLowerCase();
  const provider = PROVIDERS[providerName];
  const configured = Boolean(provider && provider.isConfigured(env));
  const reason = !provider ? "unknown_provider" : configured ? null : (env[provider.keyVar] || "").trim() ? "invalid_key" : "missing_key";
  const trustProxy = env.TRUST_PROXY === "1";

  const send = (res, code, obj, extra = {}) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY, ...extra });
    res.end(JSON.stringify(obj));
  };
  // Browsers on another origin need CORS: configured origins, plus localhost pages (dev) unless NODE_ENV=production.
  const allowLocal = env.NODE_ENV !== "production" && env.ALLOW_LOCALHOST_ORIGINS !== "0";
  const originOk = (o) => origins.includes(o) || (allowLocal && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(o));
  const cors = (req) => {
    const o = req.headers.origin;
    return o && originOk(o) ? { "Access-Control-Allow-Origin": o, Vary: "Origin", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Max-Age": "600" } : {};
  };
  const clientIp = (req) =>
    (trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
  const rateOk = (ip) => {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60000)) hits.delete(k);
    return arr.length <= limit;
  };
  const SECURITY = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), geolocation=(), microphone=()",
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const c = cors(req);
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, c); return res.end(); }
      if (url.pathname === "/api/health" && req.method === "GET")
        return send(res, 200, { ok: true, configured, reason, provider: provider?.name || null, calibrated: provider?.calibrated ?? null, serving: Boolean(staticDir) }, c);
      if (url.pathname === "/api/identify" && req.method === "POST") {
        if (!configured) return send(res, 503, { error: "not_configured" }, c);
        if (!rateOk(clientIp(req))) return send(res, 429, { error: "rate_limited" }, c);
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
          const code = ["rate_limited", "upstream_rate"].includes(e.code) ? 429 : e.code === "bad_image" ? 400 : 502;
          return send(res, code, { error: ["rate_limited", "upstream_rate", "bad_image", "upstream_auth"].includes(e.code) ? e.code : "upstream" }, c);
        }
      }
      if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not_found" }, c);
      if (staticDir && (req.method === "GET" || req.method === "HEAD")) {
        let rel;
        try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
        if (rel.endsWith("/")) rel += "index.html";
        const file = path.join(staticDir, rel);
        if (!file.startsWith(staticDir + path.sep)) { res.writeHead(403); return res.end(); }
        fs.readFile(file, (err, buf) => {
          if (err) { res.writeHead(404, SECURITY); return res.end("Not found"); }
          const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2" };
          const ext = path.extname(file).toLowerCase();
          const heavy = [".png", ".jpg", ".webp", ".pdf", ".woff2", ".svg"].includes(ext);
          const type = types[ext] || "application/octet-stream";
          res.writeHead(200, { "Content-Type": type + (type.startsWith("image/") || type === "application/pdf" || type === "font/woff2" ? "" : "; charset=utf-8"), "Cache-Control": heavy ? "public, max-age=86400" : "no-cache", ...SECURITY });
          res.end(req.method === "HEAD" ? undefined : buf);
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
    const p = PROVIDERS[String(process.env.MUSHROOM_PROVIDER || "kindwise").trim().toLowerCase()];
    const ok = Boolean(p && p.isConfigured(process.env));
    console.log(`Mushroom API + app on http://localhost:${port}  provider=${p?.name || "unknown"} configured=${ok}`);
    if (!p) console.warn("  ! MUSHROOM_PROVIDER must be 'kindwise' or 'anthropic'.");
    else if (!ok) console.warn(`  ! ${p.keyVar} in server/.env is ${(process.env[p.keyVar] || "").trim() ? "not a valid key (it must be the key itself: letters/digits, no spaces)" : "empty"}; the page will say 'not configured'.`);
  });
}
