// General-purpose vision LLM. NOT a validated mushroom classifier: probabilities are the model's own
// uncalibrated estimates, so the front end never reports a "likely" status for this provider.
const SYSTEM = `You help a mushroom-education app. Look at the photo and list up to 5 candidate fungal species by Latin binomial.
Respond with ONLY JSON: {"isMushroom":{"probability":0-1},"suggestions":[{"name":"Genus species","probability":0-1}]}.
Be conservative. If the photo is unclear, give low probabilities. Never state that a mushroom is safe to eat.`;

export const anthropic = {
  name: "anthropic",
  calibrated: false,
  isConfigured: (env) => Boolean(env.ANTHROPIC_API_KEY),
  async identify(dataUrl, env) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) throw Object.assign(new Error("bad image"), { code: "bad_image" });
    const r = await fetch(`${env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
          { type: "text", text: "Identify the fungus in this photo." },
        ] }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (r.status === 429) throw Object.assign(new Error("upstream rate"), { code: "rate_limited" });
    if (!r.ok) throw Object.assign(new Error(`upstream ${r.status}`), { code: "upstream" });
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    let parsed;
    try { parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { parsed = null; }
    if (!parsed || !Array.isArray(parsed.suggestions)) throw Object.assign(new Error("unparseable model output"), { code: "upstream" });
    const clamp = (x) => (typeof x === "number" && x >= 0 && x <= 1 ? x : null);
    return {
      provider: "anthropic",
      calibrated: false,
      isMushroom: parsed.isMushroom && clamp(parsed.isMushroom.probability) != null ? { probability: clamp(parsed.isMushroom.probability) } : null,
      suggestions: parsed.suggestions.filter((s) => s && typeof s.name === "string").slice(0, 5).map((s) => ({ name: s.name, probability: clamp(s.probability), commonNames: [] })),
    };
  },
};
