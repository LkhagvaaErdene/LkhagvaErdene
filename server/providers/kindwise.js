// Kindwise Mushroom.id (dedicated mushroom classifier, ~4,500 taxa). Auth: "Api-Key" header.
// Response fields are read defensively; anything unexpected is reported as an upstream error,
// never turned into a fabricated identification.
export const kindwise = {
  name: "kindwise",
  calibrated: true,
  isConfigured: (env) => Boolean(env.KINDWISE_API_KEY),
  async identify(dataUrl, env) {
    const base = (env.KINDWISE_BASE_URL || "https://mushroom.kindwise.com/api/v1").replace(/\/$/, "");
    const r = await fetch(`${base}/identification?details=common_names,taxonomy,rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": env.KINDWISE_API_KEY },
      body: JSON.stringify({ images: [dataUrl], similar_images: false }),
      signal: AbortSignal.timeout(45000),
    });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error("upstream auth"), { code: "upstream_auth" });
    if (r.status === 429) throw Object.assign(new Error("upstream rate"), { code: "rate_limited" });
    if (!r.ok) throw Object.assign(new Error(`upstream ${r.status}`), { code: "upstream" });
    const j = await r.json();
    const result = j?.result;
    const sugg = result?.classification?.suggestions;
    if (!Array.isArray(sugg)) throw Object.assign(new Error("unexpected upstream response"), { code: "upstream" });
    const im = result?.is_mushroom;
    return {
      provider: "kindwise",
      calibrated: true,
      isMushroom: im && typeof im.probability === "number" ? { probability: im.probability } : null,
      suggestions: sugg
        .filter((s) => s && typeof s.name === "string")
        .map((s) => ({
          name: s.name,
          probability: typeof s.probability === "number" ? s.probability : null,
          commonNames: Array.isArray(s.details?.common_names) ? s.details.common_names.slice(0, 3) : [],
        })),
    };
  },
};
