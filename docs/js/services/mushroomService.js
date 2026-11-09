import { buildNameIndex } from "../fn/mushroomClassify.js";
import { isValidMongoliaCoord } from "../fn/geo.js";

let cache = null;

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return r.json();
}

export async function loadMushroomData() {
  if (cache) return cache;
  const [m, rec, reg, src] = await Promise.all([
    getJson("./data/mushrooms.json"),
    getJson("./data/mushroomRecords.json").catch(() => ({ records: [] })),
    getJson("./data/mushroomRegions.json"),
    getJson("./data/mushroomSources.json"),
  ]);
  const mushrooms = m.mushrooms || [];
  const byId = new Map(mushrooms.map((x) => [x.id, x]));
  // Only keep records that point to a known species and carry valid coordinates.
  const records = (rec.records || []).filter(
    (r) => byId.has(r.speciesId) && isValidMongoliaCoord(Number(r.latitude), Number(r.longitude)),
  );
  cache = {
    mushrooms,
    byId,
    index: buildNameIndex(mushrooms),
    records,
    regions: reg.regions || {},
    sources: src.sources || {},
    recordsMeta: rec.meta || {},
  };
  return cache;
}

export function regionCodesOf(m) {
  const d = m?.distribution?.mongolia;
  return [...new Set([...(d?.regionCodes || []), ...(d?.newRegionCodes || [])])].map(String);
}

// province(en key) -> { regionCodes:[], confidence }
export function provincesForSpecies(m, regions) {
  const out = new Map();
  for (const code of regionCodesOf(m)) {
    const r = regions[code];
    for (const p of r?.provinces || []) {
      const cur = out.get(p) || { regionCodes: [], confidence: r.confidence };
      cur.regionCodes.push(code);
      out.set(p, cur);
    }
  }
  return out;
}

export function unmappedRegions(m, regions) {
  return regionCodesOf(m).filter((c) => !(regions[c]?.provinces || []).length);
}

export function isConfirmedRecord(r) {
  return r.verification === "specimen_verified" || r.verification === "research_grade";
}

const contains = (v, q) => String(v ?? "").toLowerCase().includes(q);

export function filterMushrooms(data, f = {}) {
  const q = (f.query || "").trim().toLowerCase();
  return data.mushrooms.filter((m) => {
    if (f.speciesId && m.id !== f.speciesId) return false;
    if (f.category && m.toxicity?.category !== f.category) return false;
    if (f.habitat && !(m.habitat?.types || []).includes(f.habitat)) return false;
    if (q) {
      const hay = [m.scientificName, m.englishName, m.mongolianName, ...(m.alternativeMongolianNames || []), ...(m.synonyms || [])];
      if (!hay.some((h) => contains(h, q))) return false;
    }
    if (f.province) {
      const inProv = provincesForSpecies(m, data.regions).has(f.province);
      const hasRec = data.records.some((r) => r.speciesId === m.id && r.province === f.province);
      if (!inProv && !hasRec) return false;
    }
    if (f.dateFrom || f.dateTo) {
      const ok = data.records.some((r) => r.speciesId === m.id && inRange(r.observationDate, f.dateFrom, f.dateTo));
      if (!ok) return false;
    }
    return true;
  });
}

function inRange(date, from, to) {
  if (!date) return false;
  const d = String(date).slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

export function filterRecords(data, f = {}, speciesList = null) {
  const ids = new Set((speciesList || filterMushrooms(data, { ...f, province: "", dateFrom: "", dateTo: "" })).map((m) => m.id));
  return data.records.filter((r) => {
    if (!ids.has(r.speciesId)) return false;
    if (f.province && r.province !== f.province) return false;
    if (f.habitat && r.habitat && r.habitat !== f.habitat) return false;
    if ((f.dateFrom || f.dateTo) && !inRange(r.observationDate, f.dateFrom, f.dateTo)) return false;
    return true;
  });
}

export const hasDatedRecords = (data) => data.records.some((r) => r.observationDate);
