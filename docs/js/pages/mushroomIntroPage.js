import { renderSplitPageLayout } from "../layouts/splitPageLayout.js";
import { renderPageLayout } from "../layouts/pageLayout.js";
import { renderNotification } from "../layouts/notificationLayout.js";
import { escapeHtml } from "../fn/format.js";
import { t, getCurrentLanguage, getLocalizedValue } from "../i18n/i18n.js";
import { xt } from "../i18n/mushroomExtraText.js";
import { getProvinceDisplayName } from "../components/map.js";
import { loadMushroomData, provincesForSpecies } from "../services/mushroomService.js";
import { renderSafetyWarning, renderSpeciesModal, openSpeciesModal, bindSpeciesModal, fmt } from "../components/mushroomUi.js";
import { renderMushroomMapShell, mountMushroomMap, renderLegend } from "../components/mushroomMap.js";

const list = (keys) => `<ul>${keys.map((k) => `<li>${xt(k)}</li>`).join("")}</ul>`;

export async function renderMushroomIntroPage() {
  const app = document.getElementById("app");
  app.innerHTML = renderPageLayout({ content: renderNotification(t("notification.loadingData")) });
  let data;
  try {
    data = await loadMushroomData();
  } catch (e) {
    console.error(e);
    app.innerHTML = renderPageLayout({ content: renderNotification(t("mushroom.errGeneric"), "danger") });
    return;
  }
  const lang = getCurrentLanguage();
  const ms = data.mushrooms;
  const edible = ms.filter((m) => m.edibility?.documentedEdible === true).length;
  const prov = new Set();
  ms.forEach((m) => { try { provincesForSpecies(m, data.regions).forEach((_, p) => prov.add(p)); } catch (e) { /* ignore */ } });
  const stat = (n, label) => `<div class="column is-6 has-text-centered"><p class="heading" style="white-space:normal">${label}</p><p class="title is-3">${n}</p></div>`;
  const opt = (v, label) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;

  // Same layout as the original overview page: map on the left, text on the right.
  const left = `
    ${renderMushroomMapShell("introMap")}
    <div id="introLegend"></div>
    <p class="help">${t("mushroom.distProvincesApprox")}</p>
    <div id="introInfo" class="box mm-info" aria-live="polite"><p class="help">${t("mushroom.provincePanelHint")}</p></div>`;
  const right = `
    <p class="mb-3">${xt("lead")}</p>
    <div class="box"><div class="columns is-mobile is-multiline">${stat(ms.length, xt("species"))}${stat(edible, xt("edible"))}${stat(ms.length - edible, xt("toxic"))}${stat(prov.size, xt("provinces"))}</div></div>
    <div class="field"><label class="label" for="introSpecies">${getLocalizedValue({ mn: "Тархацыг зүйлээр харах", en: "Show distribution of a species" })}</label>
      <div class="select is-fullwidth"><select id="introSpecies">${opt("", t("mushroom.all"))}${ms.map((m) => opt(m.id, m.scientificName)).join("")}</select></div></div>
    ${renderSafetyWarning()}`;

  app.innerHTML =
    renderSplitPageLayout({ pageId: "overview", pageTitle: xt("title"), leftContent: left, rightContent: right }) +
    `<section class="section pt-0"><div class="container">
      <div class="columns mt-4">
        <div class="column"><div class="box content"><h3 class="title is-6">${xt("checkTitle")}</h3>${list(["c1", "c2", "c3", "c4", "c5"])}</div></div>
        <div class="column"><div class="box content"><h3 class="title is-6">${xt("poisonTitle")}</h3>${list(["p1", "p2", "p3", "p4"])}</div></div>
      </div></div></section>` +
    renderSpeciesModal();
  bindSpeciesModal();

  const $ = (id) => document.getElementById(id);
  const info = $("introInfo");
  $("introLegend").innerHTML = renderLegend({ hasRecords: data.records.length > 0 });
  let map = null;
  const current = () => { const id = $("introSpecies").value; return id ? ms.filter((m) => m.id === id) : ms; };
  const shade = () => {
    if (!map) return;
    const l = current(), counts = new Map();
    for (const m of l) for (const p of provincesForSpecies(m, data.regions).keys()) counts.set(p, (counts.get(p) || 0) + 1);
    map.setShading(counts, l.length === 1 ? "single" : "density");
  };
  const showProvince = (name) => {
    const inProv = current().filter((m) => provincesForSpecies(m, data.regions).has(name));
    info.innerHTML = `<h4 class="title is-6">${escapeHtml(fmt(t("mushroom.provincePanelTitle"), { province: getProvinceDisplayName(name, lang) }))}</h4>` +
      (inProv.length ? `<ul>${inProv.map((m) => `<li><button type="button" class="button is-ghost is-small mm-open" data-id="${escapeHtml(m.id)}"><em>${escapeHtml(m.scientificName)}</em></button></li>`).join("")}</ul>` : `<p>${t("mushroom.provincePanelNone")}</p>`) +
      `<p class="help">${t("mushroom.distProvincesApprox")}</p>`;
  };
  $("introSpecies").addEventListener("change", shade);
  app.addEventListener("click", (e) => {
    const b = e.target.closest(".mm-open");
    const m = b && ms.find((x) => x.id === b.dataset.id);
    if (m) openSpeciesModal(m, data);
  });
  map = await mountMushroomMap("introMap", { lang, onProvince: showProvince, onMarker: () => {} });
  shade();
}
