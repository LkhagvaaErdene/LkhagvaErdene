import test from "node:test"; import assert from "node:assert/strict";
import { loadFn, readJson } from "./helpers.mjs";
const C = await loadFn("fn/mushroomClassify.js");
const G = await loadFn("fn/geo.js");
const db = readJson("src/data/mushrooms.json").mushrooms;
const src = readJson("src/data/mushroomSources.json").sources;
const idx = C.buildNameIndex(db);

test("database integrity: unique ids/names, valid categories, sources resolve", () => {
  assert.equal(new Set(db.map((m) => m.id)).size, db.length);
  assert.equal(new Set(db.map((m) => C.normalizeName(m.scientificName))).size, db.length);
  for (const m of db) {
    assert.ok(C.CATEGORIES.includes(m.toxicity.category), m.id);
    for (const s of m.sources) assert.ok(src[s], `${m.id}: ${s}`);
    for (const s of m.toxicity.sourceIds) assert.ok(src[s], `${m.id}: tox ${s}`);
    for (const sp of m.similarSpecies) if (sp.id) assert.ok(db.find((x) => x.id === sp.id), `${m.id} -> ${sp.id}`);
    if (m.toxicity.category === "documented_edible") assert.ok(m.toxicity.sourceIds.length > 0, `${m.id} edible needs source`);
    assert.equal(m.mongolianName, null); // none verified -> never invented
  }
});
test("name normalisation strips authority; genus-only never matches", () => {
  assert.equal(C.normalizeName("Amanita phalloides (Vaill. ex Fr.) Link"), "amanita phalloides");
  assert.ok(C.matchSpecies("Boletus edulis Bull.", idx));
  assert.equal(C.matchSpecies("Boletus", idx), null);
});
const mk = (arr, extra = {}) => ({ suggestions: arr.map(([name, probability]) => ({ name, probability })), isMushroom: { probability: 0.99 }, calibrated: true, ...extra });
test("high-confidence edible -> likely, never 'confirmed'", () => {
  const r = C.classifyIdentification(mk([["Boletus edulis", 0.95], ["Tylopilus felleus", 0.03]]), idx);
  assert.equal(r.status, "likely"); assert.equal(r.headlineCategory, "documented_edible");
});
test("low confidence / ambiguity / not-mushroom / uncalibrated / empty -> inconclusive", () => {
  assert.equal(C.classifyIdentification(mk([["Boletus edulis", 0.6]]), idx).headlineCategory, "identification_inconclusive");
  assert.ok(C.classifyIdentification(mk([["Boletus edulis", 0.85], ["Cantharellus cibarius", 0.8]]), idx).reasons.includes("reasonAmbiguous"));
  assert.ok(C.classifyIdentification(mk([["Boletus edulis", 0.95]], { isMushroom: { probability: 0.1 } }), idx).reasons.includes("reasonNotMushroom"));
  assert.equal(C.classifyIdentification(mk([["Boletus edulis", 0.97]], { calibrated: false }), idx).status, "uncertain");
  assert.ok(C.classifyIdentification({ suggestions: [] }, idx).reasons.includes("reasonNone"));
});
test("dangerous candidate surfaced even when top is edible; unknown species -> toxicity_unknown", () => {
  const r = C.classifyIdentification(mk([["Agaricus campestris", 0.6], ["Amanita phalloides", 0.3]]), idx);
  assert.equal(r.headlineCategory, "identification_inconclusive");
  assert.equal(r.dangerousCandidates[0].name, "Amanita phalloides");
  const u = C.classifyIdentification(mk([["Morchella esculenta", 0.95]]), idx);
  assert.equal(u.headlineCategory, "toxicity_unknown");
  const l = C.classifyIdentification(mk([["Agaricus campestris", 0.95]]), idx);
  assert.ok(l.lookalikeDangers.includes("Amanita phalloides"));
});
test("geoToSvg maps bounds to SVG extent and rejects outside coordinates", () => {
  const a = G.geoToSvg(G.GEO_BOUNDS.latMax, G.GEO_BOUNDS.lonMin);
  assert.ok(Math.abs(a.x - G.SVG_BOUNDS.xMin) < 1e-6 && Math.abs(a.y - G.SVG_BOUNDS.yMin) < 1e-6);
  assert.equal(G.isValidMongoliaCoord(47.9, 106.9), true);
  assert.equal(G.isValidMongoliaCoord(55, 106), false);
});
test("mushroom filters", async () => {
  const S = await loadFn("services/mushroomService.js");
  const data = { mushrooms: db, records: [], regions: readJson("src/data/mushroomRegions.json").regions };
  assert.equal(S.filterMushrooms(data, { query: "phalloides" }).length, 1);
  assert.equal(S.filterMushrooms(data, { category: "documented_edible" }).length, db.filter((m) => m.toxicity.category === "documented_edible").length);
  assert.ok(S.filterMushrooms(data, { province: "Khuvsgul" }).every((m) => S.regionCodesOf(m).includes("1")));
  assert.equal(S.filterMushrooms(data, { dateFrom: "2020-01-01" }).length, 0); // no dated records -> none
});

test("GBIF importer mapping (offline fixture; NOT a live GBIF call)", async () => {
  const { mapOccurrence } = await import("../tools/importGbifRecords.mjs");
  const r = mapOccurrence({ key: 1, decimalLatitude: 47.9, decimalLongitude: 106.9, stateProvince: "Töv Aimag", eventDate: "2020-08-01T10:00", basisOfRecord: "PRESERVED_SPECIMEN", countryCode: "MN" }, "boletus-edulis", "Boletus edulis");
  assert.equal(r.verification, "specimen_verified"); assert.equal(r.observationDate, "2020-08-01"); assert.equal(r.province, null); // unmatched text is never guessed
  assert.equal(mapOccurrence({ key: 2, decimalLatitude: 48, decimalLongitude: 100, stateProvince: "Khövsgöl" }, "x", "X").province, null);
  assert.equal(mapOccurrence({ key: 3, decimalLatitude: 48, decimalLongitude: 100, stateProvince: "Hovsgol" }, "x", "X").province, "Khuvsgul");
  assert.equal(mapOccurrence({ key: 4 }, "x", "X"), null);
});
