import { renderSplitPageLayout } from "../layouts/splitPageLayout.js";
import { renderPageLayout } from "../layouts/pageLayout.js";
import { renderNotification } from "../layouts/notificationLayout.js";
import { escapeHtml } from "../fn/format.js";
import { getCurrentLanguage, t } from "../i18n/i18n.js";
import { getProvinceDisplayName, provinceNameMap } from "../components/map.js";
import { loadMushroomData, filterMushrooms, filterRecords, provincesForSpecies, hasDatedRecords } from "../services/mushroomService.js";
import { renderSafetyWarning, renderSpeciesCard, renderSpeciesModal, openSpeciesModal, bindSpeciesModal, hydrateSpeciesImages, fmt, displayName } from "../components/mushroomUi.js";
import { renderMushroomMapShell, mountMushroomMap, renderLegend, renderRecordPopup } from "../components/mushroomMap.js";

const HABITATS = ["forest", "grassland", "wood"];
const CATS = ["poisonous", "potentially_poisonous", "documented_edible", "toxicity_unknown"];

export async function renderMushroomAtlasPage() {
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
  const pending = sessionStorage.getItem("pendingMushroomId");
  sessionStorage.removeItem("pendingMushroomId");
  const dated = hasDatedRecords(data);
  const opt = (v, label) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
  const provinces = Object.keys(provinceNameMap).sort((a, b) => getProvinceDisplayName(a, lang).localeCompare(getProvinceDisplayName(b, lang), lang));

  const filters = `
    <form id="mmFilters" class="box mm-filters" onsubmit="return false" aria-label="${escapeHtml(t("mushroom.filters"))}">
      <h3 class="title is-6">${t("mushroom.filters")}</h3>
      <div class="field"><label class="label" for="fQuery">${t("mushroom.search")}</label><input id="fQuery" class="input" type="search" placeholder="${escapeHtml(t("mushroom.searchPlaceholder"))}" /></div>
      <div class="field"><label class="label" for="fSpecies">${t("mushroom.speciesFilter")}</label><div class="select is-fullwidth"><select id="fSpecies">${opt("", t("mushroom.all"))}${data.mushrooms.map((m) => opt(m.id, m.scientificName)).join("")}</select></div></div>
      <div class="field"><label class="label" for="fProvince">${t("mushroom.provinceFilter")}</label><div class="select is-fullwidth"><select id="fProvince">${opt("", t("mushroom.all"))}${provinces.map((p) => opt(p, getProvinceDisplayName(p, lang))).join("")}</select></div></div>
      <div class="field"><label class="label" for="fHabitat">${t("mushroom.habitatFilter")}</label><div class="select is-fullwidth"><select id="fHabitat">${opt("", t("mushroom.all"))}${HABITATS.map((h) => opt(h, t(`mushroom.hab_${h}`))).join("")}</select></div></div>
      <div class="field"><label class="label" for="fCategory">${t("mushroom.categoryFilter")}</label><div class="select is-fullwidth"><select id="fCategory">${opt("", t("mushroom.all"))}${CATS.map((c) => opt(c, t(`mushroom.cat_${c}`))).join("")}</select></div></div>
      <div class="field"><label class="label" for="fFrom">${t("mushroom.dateFrom")}</label><input id="fFrom" class="input" type="date" ${dated ? "" : "disabled"} /></div>
      <div class="field"><label class="label" for="fTo">${t("mushroom.dateTo")}</label><input id="fTo" class="input" type="date" ${dated ? "" : "disabled"} /></div>
      ${dated ? "" : `<p class="help">${t("mushroom.dateDisabled")}</p>`}
      <button type="button" id="fReset" class="button is-light is-small mt-2">${t("mushroom.reset")}</button>
    </form>`;

  const left = `
    ${renderMushroomMapShell("atlasMap")}
    <div id="atlasLegend"></div>
    <p class="help">${t("mushroom.distProvincesApprox")}</p>
    <div id="atlasInfo" class="box mm-info" aria-live="polite"><p class="help">${t("mushroom.provincePanelHint")}</p></div>`;
  const right = `${filters}`;

  app.innerHTML =
    renderSplitPageLayout({
      pageId: "mushroom-atlas",
      pageTitle: t("mushroom.atlasTitle"),
      leftContent: `<p class="mb-3">${escapeHtml(t("mushroom.atlasLead"))}</p>${renderSafetyWarning()}${left}`,
      rightContent: right,
    }) +
    `<section class="section pt-0"><div class="container"><p id="atlasCount" class="has-text-weight-semibold mb-2" aria-live="polite"></p><p id="atlasRecNote" class="help mb-3"></p><div id="atlasCards" class="columns is-multiline"></div></div></section>` +
    renderSpeciesModal();
  bindSpeciesModal();

  const $ = (id) => document.getElementById(id);
  const catOf = (r) => data.byId.get(r.speciesId)?.toxicity?.category || "toxicity_unknown";
  const info = $("atlasInfo");
  let map = null;

  const getF = () => ({
    query: $("fQuery").value, speciesId: $("fSpecies").value, province: $("fProvince").value,
    habitat: $("fHabitat").value, category: $("fCategory").value, dateFrom: $("fFrom").value, dateTo: $("fTo").value,
  });

  function update() {
    const f = getF();
    const list = filterMushrooms(data, f);
    const recs = filterRecords(data, f, list);
    $("atlasCount").textContent = fmt(t("mushroom.resultsCount"), { n: list.length });
    $("atlasCards").innerHTML = list.length ? list.map((m) => renderSpeciesCard(m)).join("") : `<div class="column is-12">${renderNotification(t("mushroom.noResults"), "warning")}</div>`;
    hydrateSpeciesImages($("atlasCards"), data);
    $("atlasRecNote").textContent = data.records.length === 0 ? t("mushroom.noRecordsGlobal") : fmt(t("mushroom.recordsShown"), { n: recs.length });
    $("atlasLegend").innerHTML = renderLegend({ hasRecords: data.records.length > 0 });
    if (!map) return;
    const counts = new Map();
    for (const m of list) for (const p of provincesForSpecies(m, data.regions).keys()) counts.set(p, (counts.get(p) || 0) + 1);
    map.setShading(counts, list.length === 1 ? "single" : "density");
    map.setMarkers(recs, catOf);
  }

  const showProvince = (name) => {
    const f = { ...getF(), province: "" };
    const inProv = filterMushrooms(data, f).filter((m) => provincesForSpecies(m, data.regions).has(name));
    info.innerHTML = `<h4 class="title is-6">${escapeHtml(fmt(t("mushroom.provincePanelTitle"), { province: getProvinceDisplayName(name, lang) }))}</h4>` +
      (inProv.length ? `<ul>${inProv.map((m) => `<li><button type="button" class="button is-ghost is-small mm-open" data-id="${escapeHtml(m.id)}"><em>${escapeHtml(m.scientificName)}</em></button></li>`).join("")}</ul>` : `<p>${t("mushroom.provincePanelNone")}</p>`) +
      `<p class="help">${t("mushroom.distProvincesApprox")}</p>`;
  };
  const showRecord = (r) => {
    const m = data.byId.get(r.speciesId);
    info.innerHTML = `<h4 class="title is-6">${t("mushroom.markerTitle")}</h4>` + renderRecordPopup(r, { sources: data.sources, lang, speciesName: m?.scientificName || "", habitatLabel: r.habitat ? t(`mushroom.hab_${r.habitat}`) : "" });
  };

  document.querySelectorAll("#mmFilters input, #mmFilters select").forEach((el) => el.addEventListener("input", update));
  $("fReset").addEventListener("click", () => { $("mmFilters").reset(); update(); });
  document.getElementById("app").addEventListener("click", (e) => {
    const b = e.target.closest(".mm-open");
    if (!b) return;
    const m = data.byId.get(b.dataset.id);
    if (m) openSpeciesModal(m, data);
  });

  if (pending && data.byId.has(pending)) $("fSpecies").value = pending;
  update();
  map = await mountMushroomMap("atlasMap", { lang, onProvince: showProvince, onMarker: showRecord });
  update();
}
