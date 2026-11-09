#!/usr/bin/env node
// Imports REAL georeferenced occurrences for the species in src/data/mushrooms.json from GBIF
// (country=MN, hasCoordinate=true, no geospatial issues) into src/data/mushroomRecords.json.
// Run on a machine with internet access:  node tools/importGbifRecords.mjs [--out docs/data]
// Records are never created by hand. Province is only set when GBIF's stateProvince text matches a known aimag.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.gbif.org/v1";
const INAT_RESEARCH_GRADE = "50c9509d-22c7-4a22-a47d-8c48425ef4a7";
const PROVINCES = ["Uvs","Khovd","Dornod","Dornogovi","Umnugovi","Khuvsgul","Bulgan","Selenge","Darkhan-Uul","Khentii","Tuv","Ulaanbaatar","Arkhangai","Dundgovi","Uvurkhangai","Zavkhan","Govi-Altai","Sukhbaatar","Bayankhongor","Bayan-Ulgii","Orkhon","Govi-Sumber"];
const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/aimag|province|city|khot/g, "");
const PROV_INDEX = new Map(PROVINCES.map((p) => [squash(p), p]));
[["Ovorkhangai","Uvurkhangai"],["Umnugobi","Umnugovi"],["Omnogovi","Umnugovi"],["Khovsgol","Khuvsgul"],["Hovsgol","Khuvsgul"],["Khentij","Khentii"],["Hentii","Khentii"],["Tov","Tuv"],["Bayan-Olgii","Bayan-Ulgii"],["Bayanolgii","Bayan-Ulgii"],["Sukhbaatar","Sukhbaatar"],["Suhbaatar","Sukhbaatar"],["Dornogobi","Dornogovi"],["Gobi-Altai","Govi-Altai"],["Govialtai","Govi-Altai"]].forEach(([a, b]) => PROV_INDEX.set(squash(a), b));

export function mapOccurrence(o, speciesId, scientificName) {
  const lat = o.decimalLatitude, lon = o.decimalLongitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (o.country && o.countryCode && o.countryCode !== "MN") return null;
  const basis = o.basisOfRecord;
  const verification = basis === "PRESERVED_SPECIMEN" ? "specimen_verified" : o.datasetKey === INAT_RESEARCH_GRADE ? "research_grade" : "unverified";
  return {
    id: `gbif-${o.key}`,
    speciesId, scientificName,
    country: "MN",
    province: PROV_INDEX.get(squash(o.stateProvince)) || null,
    soum: null,
    region: o.locality || null,
    habitat: null,
    latitude: lat, longitude: lon,
    coordinateUncertaintyM: o.coordinateUncertaintyInMeters ?? null,
    observationDate: o.eventDate ? String(o.eventDate).slice(0, 10) : null,
    verification,
    source: {
      id: "gbif", datasetName: o.datasetName || o.institutionCode || "GBIF occurrence",
      recordUrl: `https://www.gbif.org/occurrence/${o.key}`, recordedBy: o.recordedBy || null,
      basisOfRecord: basis || null, license: o.license || null, datasetKey: o.datasetKey || null,
    },
  };
}

export async function importAll(fetchFn = fetch, { speciesFile, limitPerSpecies = 300 } = {}) {
  const species = JSON.parse(fs.readFileSync(speciesFile, "utf8")).mushrooms;
  const records = [];
  for (const m of species) {
    const match = await (await fetchFn(`${API}/species/match?name=${encodeURIComponent(m.scientificName)}&kingdom=Fungi`)).json();
    const key = match.acceptedUsageKey || match.usageKey;
    if (!key || match.matchType === "NONE") { console.warn("no GBIF match:", m.scientificName); continue; }
    for (let offset = 0; offset < limitPerSpecies; offset += 300) {
      const url = `${API}/occurrence/search?taxonKey=${key}&country=MN&hasCoordinate=true&hasGeospatialIssue=false&limit=300&offset=${offset}`;
      const page = await (await fetchFn(url)).json();
      for (const o of page.results || []) { const r = mapOccurrence(o, m.id, m.scientificName); if (r) records.push(r); }
      if (page.endOfRecords) break;
    }
  }
  return records;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outIdx = process.argv.indexOf("--out");
  const outDirs = outIdx > 0 ? [path.resolve(process.argv[outIdx + 1])] : [path.join(ROOT, "src/data"), path.join(ROOT, "docs/data")];
  const records = await importAll(fetch, { speciesFile: path.join(ROOT, "src/data/mushrooms.json") });
  const payload = { schemaVersion: 1, meta: { importedAt: new Date().toISOString(), source: "GBIF occurrence API (country=MN, hasCoordinate=true, hasGeospatialIssue=false)", note: "Cite the individual datasets/licences (see each record's source)." }, records };
  for (const d of outDirs) { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "mushroomRecords.json"), JSON.stringify(payload, null, 1)); }
  console.log(`Wrote ${records.length} records to ${outDirs.join(", ")}`);
}
