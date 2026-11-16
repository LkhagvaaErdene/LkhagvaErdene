import { renderPageLayout } from "../layouts/pageLayout.js";
import { getLocalizedValue as L } from "../i18n/i18n.js";
import * as C from "../fn/mushroomCalc.js";

const f = (id, mn, en, val, min, max, step = "any") => ({ id, label: { mn, en }, val, min, max, step });
const WATER = f("w", "Шинэ мөөгний ус (%)", "Water in fresh mushroom (%)", 90, 0, 99);
const DRYM = f("d", "Хатсан мөөгний чийг (%)", "Moisture of dried mushroom (%)", 10, 0, 99);
const fmt = (x, u = "") => `${Number(x.toFixed(2)).toLocaleString()}${u ? " " + u : ""}`;

export const CALCS = {
  drying: {
    icon: "sun", c: "warning",
    title: { mn: "Хатаалт", en: "Drying" },
    lead: { mn: "Шинэ мөөгийг хатаахад хэдэн граммтай болохыг тооцно. Зөвхөн ус гарна гэж үзнэ.", en: "Estimates dried weight, assuming only water is lost." },
    fields: [f("m", "Шинэ мөөгний жин (г)", "Fresh weight (g)", 1000, 0, 1e7), WATER, DRYM],
    run: (v) => { const r = C.dryFromFresh(v.m, v.w, v.d); return r && [[{ mn: "Хатсан жин", en: "Dried weight" }, fmt(r.dried, "g")], [{ mn: "Ууршсан ус", en: "Water removed" }, fmt(r.waterRemoved, "g")], [{ mn: "Шинэ : хатсан", en: "Fresh : dried" }, fmt(r.ratio) + " : 1"]]; },
    formula: { mn: "хатсан = шинэ × (100 − ус%) ÷ (100 − чийг%)", en: "dried = fresh × (100 − water%) ÷ (100 − moisture%)" },
  },
  rehydrate: {
    icon: "droplet", c: "info",
    title: { mn: "Хатсан → шинэ", en: "Dried → fresh" },
    lead: { mn: "Хатсан мөөг хэдэн граммын шинэ мөөгтэй тэнцэхийг тооцно.", en: "Fresh-weight equivalent of a dried amount." },
    fields: [f("m", "Хатсан мөөгний жин (г)", "Dried weight (g)", 50, 0, 1e7), WATER, DRYM],
    run: (v) => { const r = C.freshFromDried(v.m, v.w, v.d); return r && [[{ mn: "Тэнцэх шинэ мөөг", en: "Fresh equivalent" }, fmt(r.fresh, "g")]]; },
    formula: { mn: "шинэ = хатсан × (100 − чийг%) ÷ (100 − ус%)", en: "fresh = dried × (100 − moisture%) ÷ (100 − water%)" },
  },
  substrate: {
    icon: "seedling", c: "success",
    title: { mn: "Субстратын чийг", en: "Substrate moisture" },
    lead: { mn: "Тарилгын субстратыг зорилтот чийгт хүргэхэд нэмэх усыг тооцно (нойтон жингийн суурьтай чийг).", en: "Water to add to bring a cultivation substrate to a target moisture (wet-basis)." },
    fields: [f("m", "Субстратын жин (кг)", "Substrate weight (kg)", 10, 0, 1e5), f("m0", "Одоогийн чийг (%)", "Current moisture (%)", 30, 0, 99), f("mt", "Зорилтот чийг (%)", "Target moisture (%)", 65, 0, 99)],
    run: (v) => { const r = C.substrateWater(v.m, v.m0, v.mt); return r && [[{ mn: "Хуурай бодис", en: "Dry matter" }, fmt(r.dry, "kg")], [{ mn: "Эцсийн жин", en: "Final weight" }, fmt(r.targetWet, "kg")], [r.water >= 0 ? { mn: "Нэмэх ус", en: "Water to add" } : { mn: "Хэт нойтон: хатаах ус", en: "Too wet: water to remove" }, fmt(Math.abs(r.water), "kg")]]; },
    formula: { mn: "хуурай = жин × (100 − m₀)/100; эцсийн = хуурай × 100/(100 − m₁); ус = эцсийн − жин", en: "dry = W × (100 − m₀)/100; final = dry × 100/(100 − m₁); water = final − W" },
  },
  yield: {
    icon: "chart-line", c: "primary",
    title: { mn: "Ургацын үр ашиг (BE)", en: "Biological efficiency" },
    lead: { mn: "Тариалалтын биологийн үр ашиг (BE) = шинэ ургац ÷ хуурай субстрат × 100.", en: "BE = fresh yield ÷ dry substrate × 100." },
    fields: [f("m", "Субстратын жин (кг)", "Substrate weight (kg)", 10, 0, 1e5), f("sm", "Субстратын чийг (%)", "Substrate moisture (%)", 30, 0, 99), f("a", "1-р ургац (кг)", "Flush 1 (kg)", 2, 0, 1e5), f("b", "2-р ургац (кг)", "Flush 2 (kg)", 1, 0, 1e5), f("c", "3-р ургац (кг)", "Flush 3 (kg)", 0.5, 0, 1e5)],
    run: (v) => { const r = C.biologicalEfficiency(v.m, v.sm, [v.a, v.b, v.c]); return r && [[{ mn: "Хуурай субстрат", en: "Dry substrate" }, fmt(r.dry, "kg")], [{ mn: "Нийт ургац", en: "Total yield" }, fmt(r.total, "kg")], [{ mn: "BE (хуурай суурьтай)", en: "BE (dry basis)" }, fmt(r.be, "%")], [{ mn: "Нойтон суурьтай", en: "Wet basis" }, fmt(r.wetBasis, "%")]]; },
    formula: { mn: "BE = нийт шинэ ургац ÷ (жин × (100 − чийг%)/100) × 100", en: "BE = total fresh yield ÷ (weight × (100 − moisture%)/100) × 100" },
  },
  spawn: {
    icon: "vial", c: "link",
    title: { mn: "Үрийн (spawn) хэмжээ", en: "Spawn amount" },
    lead: { mn: "Субстратын нойтон жингийн хувиар хэрэгтэй үрийн хэмжээг тооцно.", en: "Spawn needed as a % of substrate wet weight." },
    fields: [f("m", "Субстратын жин (кг)", "Substrate weight (kg)", 10, 0, 1e5), f("r", "Үрийн хувь (%)", "Spawn rate (%)", 5, 0, 100)],
    run: (v) => { const r = C.spawnAmount(v.m, v.r); return r && [[{ mn: "Үр", en: "Spawn" }, fmt(r.spawn, "kg")], [{ mn: "Нийт жин", en: "Total weight" }, fmt(r.total, "kg")]]; },
    formula: { mn: "үр = субстрат × хувь ÷ 100", en: "spawn = substrate × rate ÷ 100" },
  },
  brine: {
    icon: "jar", c: "danger",
    title: { mn: "Давсны уусмал", en: "Salt brine" },
    lead: { mn: "Масс-ын хувиар (w/w) зорилтот давсжилтад хүрэх давсны хэмжээ. 1 л ус ≈ 1000 г.", en: "Salt needed for a target brine strength by mass (w/w). 1 L water ≈ 1000 g." },
    fields: [f("w", "Усны жин (г)", "Water weight (g)", 1000, 0, 1e7), f("c", "Давсжилт (%, масс)", "Brine strength (% by mass)", 5, 0, 99)],
    run: (v) => { const r = C.brineSalt(v.w, v.c); return r && [[{ mn: "Давс", en: "Salt" }, fmt(r.salt, "g")], [{ mn: "Нийт уусмал", en: "Total brine" }, fmt(r.total, "g")]]; },
    formula: { mn: "давс = ус × c ÷ (100 − c)", en: "salt = water × c ÷ (100 − c)" },
    note: { mn: "Давсалж, жигнэх нь хортой мөөгийг хоргүй болгохгүй.", en: "Salting or pickling does not make a poisonous mushroom safe." },
  },
  price: {
    icon: "coins", c: "warning",
    title: { mn: "Үнийн хөрвүүлэлт", en: "Price conversion" },
    lead: { mn: "Шинэ мөөгний үнээс хатсан мөөгний түүхий эдийн өртгийг гаргана (хуурай бодисын тэнцэлээр).", en: "Raw-material cost per dried kg from the fresh price (dry-matter balance)." },
    fields: [f("p", "Шинэ мөөгний үнэ (₮/кг)", "Fresh price (per kg)", 10000, 0, 1e9), WATER, DRYM],
    run: (v) => { const r = C.dryPrice(v.p, v.w, v.d); return r && [[{ mn: "1 кг хатсанд шаардагдах шинэ", en: "Fresh needed per kg dried" }, fmt(r.freshPerKgDried, "kg")], [{ mn: "Хатсан мөөгний өртөг (1 кг)", en: "Cost per kg dried" }, fmt(r.pricePerKgDried)]]; },
    formula: { mn: "шинэ/кг хатсан = (100 − чийг%) ÷ (100 − ус%); өртөг = үнэ × энэ", en: "fresh per kg = (100 − moisture%) ÷ (100 − water%); cost = price × that" },
    note: { mn: "Зөвхөн түүхий эдийн өртөг: хөдөлмөр, эрчим хүч, алдагдлыг оруулаагүй.", en: "Raw material only: labour, energy and losses are not included." },
  },
  cooking: {
    icon: "fire-burner", c: "danger",
    title: { mn: "Хоол хийх жин", en: "Cooking weight" },
    lead: { mn: "Чанах, шарахад алдагдах жингийн хувиар (өөрийн хэмжсэн утгаар) жинг тооцно.", en: "Cooked weight from a loss % you measured yourself." },
    fields: [f("m", "Түүхий мөөг (г)", "Raw mushroom (g)", 500, 0, 1e7), f("l", "Жингийн алдагдал (%)", "Weight loss (%)", 40, 0, 99), f("t", "Хүссэн болсон жин (г)", "Target cooked weight (g)", 300, 0, 1e7)],
    run: (v) => { const a = C.cookedWeight(v.m, v.l), b = C.rawNeeded(v.t, v.l); return a && b && [[{ mn: "Болсон жин", en: "Cooked weight" }, fmt(a.cooked, "g")], [{ mn: "Хүссэн жинд шаардагдах түүхий", en: "Raw needed for target" }, fmt(b.raw, "g")]]; },
    formula: { mn: "болсон = түүхий × (100 − алдагдал%)/100", en: "cooked = raw × (100 − loss%)/100" },
    note: { mn: "Алдагдлын хувь зүйл, аргаас хамаарна: өөрийн хэмжилтээр оруулна уу.", en: "Loss varies by species and method: enter your own measured value." },
  },
};

export function renderCalc(id) {
  const c = CALCS[id];
  document.getElementById("app").innerHTML = renderPageLayout({
    title: L(c.title),
    content: `<p class="mb-4">${L(c.lead)}</p><div class="columns"><div class="column is-5"><div class="box">
      ${c.fields.map((x) => `<div class="field"><label class="label" for="cf_${x.id}">${L(x.label)}</label><input id="cf_${x.id}" class="input" type="number" inputmode="decimal" value="${x.val}" min="${x.min}" max="${x.max}" step="${x.step}" /></div>`).join("")}
      </div></div><div class="column"><div class="box" id="calcOut" aria-live="polite"></div>
      <p class="is-size-7 mb-2"><strong>${L({ mn: "Томьёо", en: "Formula" })}:</strong> <code>${L(c.formula)}</code></p>
      ${c.note ? `<article class="message is-warning"><div class="message-body">${L(c.note)}</div></article>` : ""}
      <p class="is-size-7 has-text-grey">${L({ mn: "Ойролцоо тооцоо: зүйл бүрийн жинхэнэ усны хувь өөр. Хатаах, давслах, чанах нь хортой мөөгийг хоргүй болгохгүй.", en: "Approximate: real water content varies by species. Drying, salting or cooking never makes a poisonous mushroom safe." })}</p>
    </div></div>`,
  });
  const out = document.getElementById("calcOut");
  const run = () => {
    const v = {};
    c.fields.forEach((x) => { const el = document.getElementById("cf_" + x.id); v[x.id] = el.value === "" ? NaN : Number(el.value); });
    const rows = c.run(v);
    out.innerHTML = rows ? rows.map(([k, val]) => `<p class="heading">${L(k)}</p><p class="title is-4">${val}</p>`).join("") : `<p class="has-text-danger">${L({ mn: "Оруулсан утга буруу байна (хоосон, сөрөг эсвэл 100%-иас их).", en: "Invalid input (empty, negative or ≥ 100%)." })}</p>`;
  };
  document.querySelectorAll("#app input").forEach((i) => i.addEventListener("input", run));
  run();
}
export const calcRoutes = Object.fromEntries(Object.keys(CALCS).map((k) => [`#/calc-${k}`, () => renderCalc(k)]));
