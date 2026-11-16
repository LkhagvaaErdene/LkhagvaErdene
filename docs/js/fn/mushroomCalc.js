// Pure mushroom calculation functions (mass-balance formulas). Return null for invalid input.
const ok = (...n) => n.every((x) => Number.isFinite(x));
const pct = (x) => ok(x) && x >= 0 && x < 100;

/* Drying: only water leaves. dry matter = fresh * (1 - w); dried = dry matter / (1 - d). Mass in any unit. */
export function dryFromFresh(fresh, w, d) {
  if (!ok(fresh) || fresh < 0 || !pct(w) || !pct(d)) return null;
  const dried = (fresh * (100 - w)) / (100 - d);
  return { dried, waterRemoved: fresh - dried, ratio: dried > 0 ? fresh / dried : null };
}
export function freshFromDried(dried, w, d) {
  if (!ok(dried) || dried < 0 || !pct(w) || !pct(d)) return null;
  return { fresh: (dried * (100 - d)) / (100 - w) };
}

/* Substrate moisture: wet mass W at moisture m0 (%, wet basis). Water to add to reach target moisture mt. */
export function substrateWater(wet, m0, mt) {
  if (!ok(wet) || wet < 0 || !pct(m0) || !pct(mt)) return null;
  const dry = (wet * (100 - m0)) / 100;
  const target = (dry * 100) / (100 - mt);
  return { dry, targetWet: target, water: target - wet };
}

/* Biological efficiency: total fresh yield / dry substrate * 100. Wet-basis yield also reported. */
export function biologicalEfficiency(wet, m, flushes) {
  if (!ok(wet) || wet <= 0 || !pct(m) || !Array.isArray(flushes) || flushes.some((f) => !ok(f) || f < 0)) return null;
  const dry = (wet * (100 - m)) / 100;
  const total = flushes.reduce((a, b) => a + b, 0);
  if (dry <= 0) return null;
  return { dry, total, be: (total / dry) * 100, wetBasis: (total / wet) * 100 };
}

/* Spawn rate as % of substrate wet mass. */
export function spawnAmount(substrateWet, ratePct) {
  if (!ok(substrateWet, ratePct) || substrateWet < 0 || ratePct < 0 || ratePct > 100) return null;
  const spawn = (substrateWet * ratePct) / 100;
  return { spawn, total: substrateWet + spawn };
}

/* Brine, % by mass (w/w): salt / (salt + water) = c  ->  salt = water * c / (100 - c). */
export function brineSalt(water, c) {
  if (!ok(water) || water < 0 || !ok(c) || c < 0 || c >= 100) return null;
  const salt = (water * c) / (100 - c);
  return { salt, total: water + salt };
}

/* Price conversion by dry-matter balance. */
export function dryPrice(priceFresh, w, d) {
  if (!ok(priceFresh) || priceFresh < 0 || !pct(w) || !pct(d)) return null;
  const freshPerKgDried = (100 - d) / (100 - w);
  return { freshPerKgDried, pricePerKgDried: priceFresh * freshPerKgDried };
}

/* Cooking loss. */
export function cookedWeight(raw, lossPct) {
  if (!ok(raw) || raw < 0 || !ok(lossPct) || lossPct < 0 || lossPct >= 100) return null;
  return { cooked: (raw * (100 - lossPct)) / 100 };
}
export function rawNeeded(cooked, lossPct) {
  if (!ok(cooked) || cooked < 0 || !ok(lossPct) || lossPct < 0 || lossPct >= 100) return null;
  return { raw: (cooked * 100) / (100 - lossPct) };
}

/* Hours between two moments (Date or ms). null if invalid or `to` is before `from`. */
export function hoursBetween(from, to) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  if (!ok(a, b) || b < a) return null;
  return (b - a) / 3600000;
}
