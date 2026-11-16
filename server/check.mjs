// Checks server/.env without printing the key.  npm run check            -> format check only (free)
//                                                npm run check -- photo.jpg -> sends ONE real photo to the provider (uses 1 credit)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDotEnv } from "./server.js";
import { kindwise } from "./providers/kindwise.js";
import { anthropic } from "./providers/anthropic.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, ".env");
if (!fs.existsSync(file)) { console.log("✗ server/.env not found. Run: cp server/.env.example server/.env"); process.exit(1); }
const env = { ...parseDotEnv(fs.readFileSync(file, "utf8")), ...process.env };
const name = String(env.MUSHROOM_PROVIDER || "kindwise").trim().toLowerCase();
const provider = { kindwise, anthropic }[name];
if (!provider) { console.log(`✗ MUSHROOM_PROVIDER='${name}' is invalid (use kindwise or anthropic).`); process.exit(1); }
const key = env[provider.keyVar] || "";
console.log(`provider: ${provider.name}`);
console.log(`${provider.keyVar}: ${key ? `${key.length} characters, starts '${key.slice(0, 3)}…'` : "EMPTY"}`);
if (!provider.isConfigured(env)) {
  console.log(key ? "✗ This is not a valid key: it must be only the key (no spaces/Mongolian text/quotes)." : "✗ No key. Put it after KINDWISE_API_KEY= in server/.env");
  process.exit(1);
}
console.log("✓ key format looks valid");
const photo = process.argv[2];
if (!photo) { console.log("Next: npm run check -- path/to/mushroom.jpg   (sends one photo to test the key for real)"); process.exit(0); }
const buf = fs.readFileSync(photo);
const type = /\.png$/i.test(photo) ? "image/png" : /\.webp$/i.test(photo) ? "image/webp" : "image/jpeg";
try {
  const out = await provider.identify(`data:${type};base64,${buf.toString("base64")}`, env);
  console.log("✓ provider accepted the key. Top suggestions:");
  for (const s of out.suggestions.slice(0, 3)) console.log(`  - ${s.name}  ${s.probability == null ? "" : Math.round(s.probability * 100) + "%"}`);
} catch (e) {
  const hint = { upstream_auth: "the provider rejected the key (401/403): wrong key, expired, or key of another product (it must be a Mushroom.id key)", rate_limited: "quota or rate limit reached (429)", bad_image: "the provider could not read the image", upstream: "unexpected provider response or network problem" };
  console.log(`✗ ${e.code || "error"}: ${hint[e.code] || e.message}\n  detail: ${e.message}`);
  process.exit(1);
}
