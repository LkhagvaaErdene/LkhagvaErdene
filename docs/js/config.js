export const DATA_MODE = "local"; 
export const LOCAL_NUTRITIONS_URL = "./data/nutritionsEnMn.json";

export const API_BASE_URL = "https://example.com/api";
export const API_NUTRITIONS_URL = `${API_BASE_URL}/nutritions`;

// Mushroom identification backend (see MUSHROOM_README.md).
// Resolution order:
//   1. ?api=https://my-backend.example.com   (saved in this browser; ?api= with no value clears it)
//   2. a value saved earlier by (1)
//   3. MUSHROOM_API_PRODUCTION below, when the page runs on a non-local host (e.g. GitHub Pages)
//   4. page opened from a local static server (Live Server, python -m http.server, ...) -> http://localhost:8787
//   5. same origin "/api" (the Node server serves this app itself: `npm start`)
export const MUSHROOM_API_PRODUCTION = ""; // e.g. "https://lkhagvaa-api.onrender.com"

const clean = (u) => String(u).trim().replace(/\/+$/, "").replace(/\/api$/, "") + "/api";

// Ordered list of backend URLs to try; the first one whose /health answers with JSON is used.
export function apiCandidates() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("api")) {
      const v = q.get("api");
      if (v) localStorage.setItem("mushroomApi", v); else localStorage.removeItem("mushroomApi");
    }
    const saved = localStorage.getItem("mushroomApi");
    if (saved) return [clean(saved)];
  } catch { /* storage unavailable */ }
  const local = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
  if (!local) return [MUSHROOM_API_PRODUCTION ? clean(MUSHROOM_API_PRODUCTION) : "/api"];
  // Local: the Node server may serve this page itself (same origin) or a separate static server may (-> :8787).
  return location.port === "8787" ? ["/api"] : ["/api", "http://localhost:8787/api"];
}

export const MUSHROOM_API_BASE_URL = apiCandidates()[0];
