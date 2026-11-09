import { escapeHtml } from "../fn/format.js";
import { getLocalizedValue, getCurrentLanguage, t } from "../i18n/i18n.js";
import { provincesForSpecies, regionCodesOf, unmappedRegions } from "../services/mushroomService.js";

export const CAT_META = {
  poisonous: { cls: "is-danger", icon: "fa-skull-crossbones" },
  potentially_poisonous: { cls: "is-warning", icon: "fa-triangle-exclamation" },
  documented_edible: { cls: "is-success", icon: "fa-utensils" },
  toxicity_unknown: { cls: "is-dark", icon: "fa-circle-question" },
  identification_inconclusive: { cls: "is-info", icon: "fa-ban" },
};

export const fmt = (str, vars = {}) => String(str).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const L = (v) => escapeHtml(getLocalizedValue(v, ""));

export function renderCategoryBadge(cat) {
  const m = CAT_META[cat] || CAT_META.toxicity_unknown;
  return `<span class="tag ${m.cls} is-medium mm-cat"><span class="icon"><i class="fas ${m.icon}"></i></span><span>${escapeHtml(t(`mushroom.cat_${cat}`))}</span></span>`;
}

export function renderSafetyWarning() {
  return `
    <article class="message is-danger mm-safety" role="alert">
      <div class="message-header"><p><span class="icon"><i class="fas fa-triangle-exclamation"></i></span> ${escapeHtml(t("mushroom.safetyTitle"))}</p></div>
      <div class="message-body"><strong>${escapeHtml(t("mushroom.safetyText"))}</strong></div>
    </article>`;
}

export function renderSourceRefs(ids, sources) {
  const items = (ids || [])
    .map((id) => sources[id])
    .filter(Boolean)
    .map((s) => {
      const link = s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.citation)}</a>` : escapeHtml(s.citation);
      return `<li>${link}${s.region ? ` <em>(${escapeHtml(s.region)})</em>` : ""}${s.type === "popular-press" ? ` <em>[popular press]</em>` : ""}</li>`;
    });
  return items.length ? `<ul class="mm-refs">${items.join("")}</ul>` : "";
}

// category = effective category to display (may be inconclusive); entry may be null.
export function renderToxicityPanel(entry, category, data) {
  const meta = CAT_META[category] || CAT_META.toxicity_unknown;
  const tox = entry?.toxicity;
  const showDetails = tox && category === (tox.category || "");
  let body = "";
  if (showDetails) {
    const rows = [];
    if (tox.toxins?.length) rows.push(`<p><strong>${t("mushroom.toxins")}:</strong> ${escapeHtml(tox.toxins.join(", "))}</p>`);
    if (tox.severity) rows.push(`<p><strong>${t("mushroom.severity")}:</strong> ${escapeHtml(tox.severity)}</p>`);
    rows.push(`<p><strong>${t("mushroom.humans")}:</strong> ${L(tox.humans)}</p>`);
    rows.push(`<p><strong>${t("mushroom.animals")}:</strong> ${tox.animals ? L(tox.animals) : `<em>${t("mushroom.animalsNone")}</em>`}</p>`);
    if (tox.symptoms) rows.push(`<p><strong>${t("mushroom.symptoms")}:</strong> ${L(tox.symptoms)}</p>`);
    if (tox.warnings?.length) rows.push(`<p><strong>${t("mushroom.warnings")}:</strong></p><ul>${tox.warnings.map((w) => `<li>${L(w)}</li>`).join("")}</ul>`);
    if (entry.edibility?.note) rows.push(`<p><strong>${t("mushroom.edibility")}:</strong> ${L(entry.edibility.note)}</p>`);
    const dangerous = (entry.similarSpecies || []).filter((s) => s.risk === "dangerous");
    if (dangerous.length) rows.push(`<p><strong>${t("mushroom.similarSpecies")}:</strong></p><ul>${dangerous.map((s) => `<li><em>${escapeHtml(s.scientificName)}</em> — ${L(s.note)}</li>`).join("")}</ul>`);
    rows.push(`<details><summary>${t("mushroom.references")}</summary>${renderSourceRefs(tox.sourceIds, data.sources)}</details>`);
    body = rows.join("");
  } else if (!entry && category === "toxicity_unknown") {
    body = `<p>${t("mushroom.noToxData")}</p>`;
  }
  return `
    <section class="box mm-tox mm-tox--${category}" aria-labelledby="mmToxTitle">
      <h3 class="title is-5" id="mmToxTitle"><span class="icon"><i class="fas ${meta.icon}"></i></span> ${t("mushroom.toxicityTitle")}</h3>
      <p class="mb-3">${renderCategoryBadge(category)}</p>
      <p class="mm-tox-explain"><strong>${escapeHtml(t(`mushroom.explain_${category}`))}</strong></p>
      ${body}
    </section>`;
}

export function displayName(m) {
  return m.mongolianName || m.englishName || m.scientificName;
}

export function renderSpeciesCard(m, { onclickAttr = "" } = {}) {
  const cat = m.toxicity?.category || "toxicity_unknown";
  const mn = m.mongolianName ? escapeHtml(m.mongolianName) : `<em class="has-text-grey">${t("mushroom.unverifiedName")}</em>`;
  return `
    <div class="column is-12-mobile is-6-tablet is-4-desktop">
      <article class="card mm-card mm-card--${cat}">
        <div class="card-content">
          <p class="mm-latin"><em>${escapeHtml(m.scientificName)}</em></p>
          <p class="mm-names">${mn}</p>
          <p class="mm-names is-size-7">${escapeHtml(m.englishName || "")}</p>
          <p class="mt-2">${renderCategoryBadge(cat)}</p>
        </div>
        <footer class="card-footer">
          <button type="button" class="card-footer-item button is-ghost mm-open" data-id="${escapeHtml(m.id)}">${t("mushroom.viewDetails")}</button>
        </footer>
      </article>
    </div>`;
}

const field = (label, html) => (html ? `<div class="mm-field"><dt>${label}</dt><dd>${html}</dd></div>` : "");

export function renderSpeciesDetail(m, data) {
  const lang = getCurrentLanguage();
  const tx = m.taxonomy || {};
  const taxText = ["phylum", "class", "order", "family", "genus"].map((k) => tx[k]).filter(Boolean).join(" › ");
  const d = m.distribution?.mongolia;
  const codes = regionCodesOf(m);
  const regionNames = codes.map((c) => {
    const r = data.regions[c];
    const name = (lang === "mn" && r?.mn) || r?.en || c;
    const isNew = (d?.newRegionCodes || []).map(String).includes(c);
    return `${escapeHtml(name)}${isNew ? "+" : ""}`;
  });
  const unmapped = unmappedRegions(m, data.regions).map((c) => escapeHtml(data.regions[c]?.en || c));
  const provs = [...provincesForSpecies(m, data.regions).keys()];
  const missing = (m.dataCompleteness?.missing || []).map(escapeHtml).join(", ");
  const sim = (m.similarSpecies || [])
    .map((s) => `<li><em>${escapeHtml(s.scientificName)}</em>${s.risk === "dangerous" ? ' <span class="tag is-danger is-light">!</span>' : ""} — ${L(s.note)}</li>`)
    .join("");
  const habTypes = (m.habitat?.types || []).map((h) => t(`mushroom.hab_${h}`)).join(", ");
  return `
    <div class="mm-detail">
      <h3 class="title is-4 mb-1"><em>${escapeHtml(m.scientificName)}</em> <small class="has-text-grey is-size-6">${escapeHtml(m.authority || "")}</small></h3>
      <dl class="mm-fields">
        ${field(t("mushroom.mongolianName"), m.mongolianName ? escapeHtml(m.mongolianName) : `<em class="has-text-grey">${t("mushroom.unverifiedName")}</em>`)}
        ${field(t("mushroom.englishName"), escapeHtml(m.englishName || ""))}
        ${field(t("mushroom.classification"), escapeHtml(taxText) + (tx.family ? "" : ""))}
        ${field(t("mushroom.description"), L(m.description))}
        ${field(t("mushroom.cap"), L(m.morphology?.cap))}
        ${field(t("mushroom.stem"), L(m.morphology?.stem))}
        ${field(t("mushroom.hymenophore"), L(m.morphology?.hymenophore))}
        ${field(t("mushroom.habitat"), `${escapeHtml(habTypes)}${m.habitat?.text ? " — " + L(m.habitat.text) : ""}`)}
        ${field(t("mushroom.season"), L(m.season))}
        ${field(t("mushroom.identificationNotes"), L(m.identificationNotes))}
      </dl>
      <h4 class="title is-6 mt-4">${t("mushroom.distribution")}</h4>
      <dl class="mm-fields">
        ${field(t("mushroom.distRegions"), regionNames.join(", ") || "—")}
        ${unmapped.length ? field(t("mushroom.distRegionNotMapped"), unmapped.join(", ")) : ""}
        ${provs.length ? field(t("mushroom.legendApprox"), provs.map((p) => escapeHtml(p)).join(", ")) : ""}
        ${d?.conservationStatus ? field(t("mushroom.distConservation"), escapeHtml(d.conservationStatus)) : ""}
        ${d?.vouchers?.length ? field(t("mushroom.distVoucher"), escapeHtml(d.vouchers.join(", ")) + ` <em class="is-size-7">(${t("mushroom.distCoordsNotPublished")})</em>`) : ""}
      </dl>
      ${sim ? `<h4 class="title is-6 mt-4">${t("mushroom.similarSpecies")}</h4><ul class="mm-sim">${sim}</ul>` : ""}
      <p class="help mt-3">${t("mushroom.reviewNotice")}</p>
      <p class="help">${t("mushroom.confidence")}: ${t(`mushroom.conf_${m.confidenceLevel || "low"}`)} · ${t("mushroom.lastUpdated")}: ${escapeHtml(m.lastUpdated || "")}${missing ? ` · ${t("mushroom.missingInfo")}: ${missing}` : ""}</p>
      <details class="mt-2"><summary>${t("mushroom.sources")}</summary>${renderSourceRefs(m.sources, data.sources)}</details>
    </div>`;
}

export function renderSpeciesModal() {
  return `
    <div class="modal" id="mushroomModal" role="dialog" aria-modal="true">
      <div class="modal-background"></div>
      <div class="modal-card mm-modal-card">
        <header class="modal-card-head"><p class="modal-card-title" id="mushroomModalTitle"></p><button class="delete" aria-label="${escapeHtml(t("mushroom.close"))}"></button></header>
        <section class="modal-card-body" id="mushroomModalBody"></section>
      </div>
    </div>`;
}

export function openSpeciesModal(m, data) {
  const modal = document.getElementById("mushroomModal");
  if (!modal) return;
  document.getElementById("mushroomModalTitle").textContent = displayName(m);
  document.getElementById("mushroomModalBody").innerHTML =
    renderToxicityPanel(m, m.toxicity?.category || "toxicity_unknown", data) + renderSpeciesDetail(m, data);
  modal.classList.add("is-active");
}

export function bindSpeciesModal() {
  const modal = document.getElementById("mushroomModal");
  if (!modal) return;
  const close = () => modal.classList.remove("is-active");
  modal.querySelector(".modal-background").addEventListener("click", close);
  modal.querySelector(".delete").addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
}
