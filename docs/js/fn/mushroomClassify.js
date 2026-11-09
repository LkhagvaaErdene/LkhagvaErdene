// Pure logic: name matching and conservative interpretation of recognition results.
export const CATEGORIES = [
  "poisonous",
  "potentially_poisonous",
  "documented_edible",
  "toxicity_unknown",
  "identification_inconclusive",
];
export const THRESHOLDS = { likely: 0.8, margin: 0.25, notMushroom: 0.5, dangerMin: 0.1, maxCandidates: 5 };

export function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/×/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

export function buildNameIndex(mushrooms) {
  const index = new Map();
  for (const m of mushrooms) {
    const names = [m.scientificName, ...(m.synonyms || [])];
    for (const n of names) {
      const key = normalizeName(n);
      if (key && !index.has(key)) index.set(key, m);
    }
  }
  return index;
}

export function matchSpecies(name, index) {
  const key = normalizeName(name);
  if (key.split(" ").length < 2) return null; // genus-only is never a species match
  return index.get(key) || null;
}

export function categoryOf(entry) {
  return entry?.toxicity?.category && CATEGORIES.includes(entry.toxicity.category)
    ? entry.toxicity.category
    : "toxicity_unknown";
}

export const isDangerous = (cat) => cat === "poisonous" || cat === "potentially_poisonous";

/**
 * result: { suggestions:[{name, probability, commonNames}], isMushroom:{probability}|null, calibrated:boolean }
 * Never returns a "confirmed" state.
 */
export function classifyIdentification(result, index) {
  const reasons = [];
  const suggestions = [...(result?.suggestions || [])]
    .filter((s) => s && s.name)
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, THRESHOLDS.maxCandidates);

  const candidates = suggestions.map((s) => {
    const entry = matchSpecies(s.name, index);
    return {
      name: s.name,
      probability: typeof s.probability === "number" ? s.probability : null,
      commonNames: s.commonNames || [],
      entry,
      category: entry ? categoryOf(entry) : "toxicity_unknown",
    };
  });

  const pMush = result?.isMushroom?.probability;
  if (typeof pMush === "number" && pMush < THRESHOLDS.notMushroom) reasons.push("reasonNotMushroom");
  if (!candidates.length) reasons.push("reasonNone");

  const top = candidates[0] || null;
  const second = candidates[1] || null;
  if (top) {
    const p1 = top.probability ?? 0;
    const p2 = second?.probability ?? 0;
    if (p1 < THRESHOLDS.likely) reasons.push("reasonLow");
    else if (p1 - p2 < THRESHOLDS.margin) reasons.push("reasonAmbiguous");
  }
  if (result?.calibrated === false) reasons.push("reasonUncalibrated");

  const status = reasons.length === 0 ? "likely" : "uncertain";
  const headlineCategory =
    status === "likely" && top ? (top.entry ? top.category : "toxicity_unknown") : "identification_inconclusive";

  const dangerousCandidates = candidates.filter(
    (c) => isDangerous(c.category) && (c.probability ?? 0) >= THRESHOLDS.dangerMin,
  );
  const lookalikeDangers =
    top?.entry?.similarSpecies?.filter((s) => s.risk === "dangerous").map((s) => s.scientificName) || [];

  return { status, reasons, headlineCategory, candidates, top, dangerousCandidates, lookalikeDangers };
}
