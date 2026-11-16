import { renderPageLayout } from "../layouts/pageLayout.js";
import { renderNotification } from "../layouts/notificationLayout.js";
import { t, getLocalizedValue as L } from "../i18n/i18n.js";
import { loadMushroomData } from "../services/mushroomService.js";
import { renderSafetyWarning, renderCategoryBadge } from "../components/mushroomUi.js";

const app = () => document.getElementById("app");
const ul = (a) => `<ul>${a.map((x) => `<li>${L(x)}</li>`).join("")}</ul>`;
async function load() {
  app().innerHTML = renderPageLayout({ content: renderNotification(t("notification.loadingData")) });
  try { return await loadMushroomData(); } catch (e) { console.error(e); app().innerHTML = renderPageLayout({ content: renderNotification(t("mushroom.errGeneric"), "danger") }); return null; }
}

export async function renderComparePage() {
  const data = await load(); if (!data) return;
  const ms = data.mushrooms;
  const opt = (sel) => ms.map((m, i) => `<option value="${m.id}" ${i === sel ? "selected" : ""}>${m.scientificName}</option>`).join("");
  app().innerHTML = renderPageLayout({
    title: L({ mn: "Мөөг харьцуулах", en: "Compare mushrooms" }),
    content: `<div class="columns"><div class="column"><div class="select is-fullwidth"><select id="cmpA">${opt(0)}</select></div></div><div class="column"><div class="select is-fullwidth"><select id="cmpB">${opt(1)}</select></div></div></div><div class="table-container"><table class="table is-fullwidth is-striped" id="cmpT"></table></div>`,
  });
  const rows = [
    [{ mn: "Англи нэр", en: "English name" }, (m) => m.englishName || "—"],
    [{ mn: "Ангилал", en: "Category" }, (m) => renderCategoryBadge(m.toxicity?.category || "toxicity_unknown")],
    [{ mn: "Овог", en: "Family" }, (m) => m.taxonomy?.family || "—"],
    [{ mn: "Малгай", en: "Cap" }, (m) => L(m.morphology?.cap, "—")],
    [{ mn: "Иш", en: "Stem" }, (m) => L(m.morphology?.stem, "—")],
    [{ mn: "Хавтас", en: "Gills" }, (m) => L(m.morphology?.hymenophore, "—")],
    [{ mn: "Ургах орчин", en: "Habitat" }, (m) => L(m.habitat?.text, "—")],
    [{ mn: "Ялгах арга", en: "How to tell" }, (m) => L(m.identificationNotes, "—")],
    [{ mn: "Хор", en: "Toxins" }, (m) => (m.toxicity?.toxins || []).join(", ") || "—"],
  ];
  const pre = [sessionStorage.getItem("cmpA"), sessionStorage.getItem("cmpB")];
  sessionStorage.removeItem("cmpA"); sessionStorage.removeItem("cmpB");
  if (pre[0] && ms.some((m) => m.id === pre[0])) document.getElementById("cmpA").value = pre[0];
  if (pre[1] && ms.some((m) => m.id === pre[1])) document.getElementById("cmpB").value = pre[1];
  const draw = () => {
    const a = ms.find((m) => m.id === document.getElementById("cmpA").value), b = ms.find((m) => m.id === document.getElementById("cmpB").value);
    document.getElementById("cmpT").innerHTML = rows.map(([k, fn]) => `<tr><th>${L(k)}</th><td>${fn(a)}</td><td>${fn(b)}</td></tr>`).join("");
  };
  ["cmpA", "cmpB"].forEach((i) => document.getElementById(i).addEventListener("change", draw));
  draw();
}

export async function renderLookalikePage() {
  const data = await load(); if (!data) return;
  const risk = { dangerous: { mn: "Аюултай", en: "Dangerous", c: "danger" }, harmless: { mn: "Хоргүй", en: "Harmless", c: "success" }, unknown: { mn: "Тодорхойгүй", en: "Unknown", c: "warning" } };
  const rows = data.mushrooms.flatMap((m) => (m.similarSpecies || []).map((s) => `<tr><td><em>${m.scientificName}</em></td><td><em>${s.scientificName}</em></td><td><span class="tag is-light is-${(risk[s.risk] || risk.unknown).c}">${L(risk[s.risk] || risk.unknown)}</span></td><td>${L(s.note, "")}</td></tr>`));
  app().innerHTML = renderPageLayout({
    title: L({ mn: "Андуурагдах төстэй зүйлс", en: "Look-alike species" }),
    content: `${renderSafetyWarning()}<div class="table-container"><table class="table is-fullwidth is-striped"><thead><tr><th>${L({ mn: "Зүйл", en: "Species" })}</th><th>${L({ mn: "Төстэй", en: "Similar to" })}</th><th>${L({ mn: "Эрсдэл", en: "Risk" })}</th><th>${L({ mn: "Тайлбар", en: "Note" })}</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`,
  });
}

const G = [
  [{ mn: "Малгай (pileus)", en: "Cap (pileus)" }, { mn: "Мөөгний дээд, дугуй хэсэг.", en: "The upper, usually rounded part." }],
  [{ mn: "Хавтас (gills)", en: "Gills" }, { mn: "Малгайн доор байх, спор үүсгэх хавтан.", en: "Plates under the cap that bear spores." }],
  [{ mn: "Ишний цагираг (annulus)", en: "Ring (annulus)" }, { mn: "Ишийг тойрсон, бүрхүүлийн үлдэгдэл.", en: "Remnant of the veil around the stem." }],
  [{ mn: "Волва (volva)", en: "Volva" }, { mn: "Ишний суурийн уут хэлбэрийн бүрхэвч; Amanita-д чухал шинж. Түүнийг ухаж шалгана.", en: "Sac-like cup at the stem base; key feature in Amanita. Dig up to check." }],
  [{ mn: "Спор (spore)", en: "Spore" }, { mn: "Мөөгний үржих нэгж.", en: "The reproductive unit of a fungus." }],
  [{ mn: "Мичориз (mycorrhiza)", en: "Mycorrhiza" }, { mn: "Мөөг ба модны үндсийн хамтын амьдрал.", en: "Symbiosis between fungus and tree roots." }],
  [{ mn: "Мицели (mycelium)", en: "Mycelium" }, { mn: "Хөрс, мод дотор тархсан мөөгний сүлжээ.", en: "The underground or in-wood network of a fungus." }],
  [{ mn: "Амитоксин", en: "Amatoxins" }, { mn: "Элэгийг гэмтээдэг, хоол хийхэд задардаггүй хор (Amanita phalloides).", en: "Heat-stable toxins that damage the liver (Amanita phalloides)." }],
];
export function renderGlossaryPage() {
  app().innerHTML = renderPageLayout({ title: L({ mn: "Нэр томьёоны толь", en: "Glossary" }), content: `<div class="box content"><dl>${G.map(([k, v]) => `<dt><strong>${L(k)}</strong></dt><dd>${L(v)}</dd>`).join("")}</dl></div>` });
}
