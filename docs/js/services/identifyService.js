import { MUSHROOM_API_BASE_URL } from "../config.js";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class IdentifyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// -> { state: "ready"|"not_configured"|"unreachable", provider?, calibrated? }
export async function getBackendStatus() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${MUSHROOM_API_BASE_URL}/health`, { signal: ctl.signal });
    clearTimeout(timer);
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.includes("application/json")) return { state: "unreachable" };
    const j = await r.json();
    return j.configured ? { state: "ready", provider: j.provider } : { state: "not_configured", provider: j.provider };
  } catch {
    return { state: "unreachable" };
  }
}

// Downscale to keep uploads small; the original file is never modified.
export function fileToDataUrl(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new IdentifyError("bad_image"));
    };
    img.src = url;
  });
}

const ERR_MAP = { 429: "rate_limited", 413: "too_large", 415: "bad_image", 400: "bad_image", 503: "not_configured" };

export async function identifyImage(file) {
  const image = await fileToDataUrl(file);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  let r;
  try {
    r = await fetch(`${MUSHROOM_API_BASE_URL}/identify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
      signal: ctl.signal,
    });
  } catch (e) {
    throw new IdentifyError(e.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await r.json();
  } catch {}
  if (!r.ok) throw new IdentifyError(body?.error || ERR_MAP[r.status] || (r.status >= 500 ? "upstream" : "generic"));
  return body;
}
