import { renderPageLayout } from "../layouts/pageLayout.js";
import { renderNotification } from "../layouts/notificationLayout.js";
import { escapeHtml } from "../fn/format.js";
import { getCurrentLanguage, t } from "../i18n/i18n.js";
import { loadMushroomData, provincesForSpecies } from "../services/mushroomService.js";
import { getBackendStatus, identifyImage, IdentifyError, ACCEPTED_TYPES, MAX_FILE_BYTES } from "../services/identifyService.js";
import { classifyIdentification } from "../fn/mushroomClassify.js";
import { renderSafetyWarning, renderToxicityPanel, renderSpeciesDetail, renderCategoryBadge, renderSummaryCard, hydrateHeroImage, fmt, CAT_META } from "../components/mushroomUi.js";
import { renderMushroomMapShell, mountMushroomMap, renderLegend, renderRecordPopup } from "../components/mushroomMap.js";

const ERR_KEY = { rate_limited: "errRate", upstream: "errUpstream", timeout: "errTimeout", too_large: "errTooLarge", bad_image: "errBadImage", network: "errNetwork", not_configured: "backendNotConfiguredTitle" };

export async function renderMushroomIdentifyPage() {
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
  app.innerHTML = renderPageLayout({
    id: "mushroom-identify",
    title: t("mushroom.identifyTitle"),
    content: `
      <p class="mb-4">${escapeHtml(t("mushroom.identifyLead"))}</p>
      ${renderSafetyWarning()}
      <div id="mmBackend" class="mb-4" aria-live="polite">${renderNotification(t("mushroom.backendChecking"), "light")}</div>
      <section class="box mm-upload" aria-labelledby="mmUploadTitle">
        <h2 class="title is-5" id="mmUploadTitle">${t("mushroom.uploadTitle")}</h2>
        <div id="mmDrop" class="mm-drop" tabindex="0" role="button" aria-label="${escapeHtml(t("mushroom.uploadHint"))}">
          <span class="icon is-large"><i class="fas fa-camera fa-2x"></i></span>
          <p>${t("mushroom.uploadHint")}</p><p class="help">${t("mushroom.uploadFormats")}</p>
        </div>
        <input id="mmFile" type="file" accept="image/jpeg,image/png,image/webp" class="is-hidden" />
        <div id="mmPreviewWrap" class="mm-preview is-hidden">
          <img id="mmPreview" alt="${escapeHtml(t("mushroom.previewAlt"))}" />
          <div class="buttons mt-3">
            <button type="button" id="mmChange" class="button is-light"><span class="icon"><i class="fas fa-image"></i></span><span>${t("mushroom.changeImage")}</span></button>
            <button type="button" id="mmRemove" class="button is-light is-danger"><span class="icon"><i class="fas fa-trash"></i></span><span>${t("mushroom.removeImage")}</span></button>
          </div>
        </div>
        <p id="mmFileError" class="help is-danger" role="alert"></p>
        <p class="help">${t("mushroom.photoTips")}</p>
        <button type="button" id="mmIdentify" class="button is-success is-medium mt-3" disabled><span class="icon"><i class="fas fa-magnifying-glass"></i></span><span>${t("mushroom.identifyBtn")}</span></button>
      </section>
      <div id="mmResults" aria-live="polite"></div>`,
  });

  const $ = (id) => document.getElementById(id);
  const st = { file: null, url: null, ready: false, busy: false };
  const refresh = () => ($("mmIdentify").disabled = !(st.file && st.ready) || st.busy);

  getBackendStatus().then((s) => {
    st.ready = s.state === "ready";
    $("mmBackend").innerHTML =
      s.state === "ready"
        ? renderNotification(fmt(t("mushroom.backendReady"), { provider: escapeHtml(s.provider || "") }), "success")
        : s.state === "not_configured"
          ? renderNotification(`<strong>${t("mushroom.backendNotConfiguredTitle")}</strong><br>${escapeHtml(t("mushroom.backendNotConfiguredText"))}`, "warning")
          : renderNotification(`<strong>${t("mushroom.backendUnreachableTitle")}</strong><br>${escapeHtml(t("mushroom.backendUnreachableText"))}`, "warning");
    refresh();
  });

  const setFile = (file) => {
    $("mmFileError").textContent = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return ($("mmFileError").textContent = t("mushroom.fileErrType"));
    if (file.size > MAX_FILE_BYTES) return ($("mmFileError").textContent = t("mushroom.fileErrSize"));
    if (st.url) URL.revokeObjectURL(st.url);
    st.file = file;
    st.url = URL.createObjectURL(file);
    $("mmPreview").src = st.url;
    $("mmPreviewWrap").classList.remove("is-hidden");
    $("mmDrop").classList.add("is-hidden");
    $("mmResults").innerHTML = "";
    refresh();
  };
  const clear = () => {
    if (st.url) URL.revokeObjectURL(st.url);
    st.file = st.url = null;
    $("mmFile").value = "";
    $("mmPreview").removeAttribute("src");
    $("mmPreviewWrap").classList.add("is-hidden");
    $("mmDrop").classList.remove("is-hidden");
    $("mmResults").innerHTML = "";
    refresh();
  };
  const pick = () => $("mmFile").click();
  $("mmDrop").addEventListener("click", pick);
  $("mmDrop").addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick()));
  $("mmChange").addEventListener("click", pick);
  $("mmRemove").addEventListener("click", clear);
  $("mmFile").addEventListener("change", (e) => setFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach((ev) => $("mmDrop").addEventListener(ev, (e) => (e.preventDefault(), $("mmDrop").classList.add("is-over"))));
  ["dragleave", "drop"].forEach((ev) => $("mmDrop").addEventListener(ev, (e) => (e.preventDefault(), $("mmDrop").classList.remove("is-over"))));
  $("mmDrop").addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

  $("mmIdentify").addEventListener("click", async () => {
    if (!st.file || st.busy) return;
    st.busy = true;
    $("mmIdentify").classList.add("is-loading");
    refresh();
    $("mmResults").innerHTML = renderNotification(t("mushroom.identifying"), "info");
    try {
      const res = await identifyImage(st.file);
      renderResults(res, data);
    } catch (e) {
      (e instanceof IdentifyError ? console.warn : console.error)(e);
      const code = e instanceof IdentifyError ? e.code : "generic";
      $("mmResults").innerHTML = renderNotification(escapeHtml(t(`mushroom.${ERR_KEY[code] || "errGeneric"}`)), "danger");
    } finally {
      st.busy = false;
      $("mmIdentify").classList.remove("is-loading");
      refresh();
    }
  });
}

function renderResults(res, data) {
  const c = classifyIdentification(res, data.index);
  const box = document.getElementById("mmResults");
  const likely = c.status === "likely";
  const meta = CAT_META[c.headlineCategory];
  const reasons = c.reasons.map((r) => `<li>${escapeHtml(t(`mushroom.${r}`))}</li>`).join("");
  const danger = c.dangerousCandidates.length
    ? `<article class="message is-danger"><div class="message-body"><strong>${t("mushroom.dangerBannerTitle")}</strong><br>${escapeHtml(fmt(t("mushroom.dangerBannerText"), { names: c.dangerousCandidates.map((x) => x.name).join(", ") }))}</div></article>`
    : "";
  const look = likely && c.lookalikeDangers.length
    ? `<article class="message is-warning"><div class="message-body"><strong>${t("mushroom.lookalikeBannerTitle")}</strong><br>${escapeHtml(fmt(t("mushroom.lookalikeBannerText"), { names: c.lookalikeDangers.join(", ") }))}</div></article>`
    : "";
  const cards = c.candidates
    .map((x, i) => {
      const pct = x.probability == null ? null : Math.round(x.probability * 100);
      return `
      <div class="box mm-cand" data-i="${i}">
        <div class="is-flex is-justify-content-space-between is-flex-wrap-wrap">
          <div><p class="mm-latin"><em>${escapeHtml(x.name)}</em></p>
          ${x.entry?.mongolianName ? `<p>${escapeHtml(x.entry.mongolianName)}</p>` : ""}
          ${x.entry?.englishName ? `<p class="is-size-7">${escapeHtml(x.entry.englishName)}</p>` : x.commonNames.length ? `<p class="is-size-7">${escapeHtml(x.commonNames.join(", "))}</p>` : ""}</div>
          <div>${x.entry ? renderCategoryBadge(x.category) : `<span class="tag is-dark">${t("mushroom.notInDb")}</span>`}</div>
        </div>
        ${pct == null ? "" : `<label class="help">${t("mushroom.probability")}: ${pct}%</label><progress class="progress is-small ${likely && i === 0 ? "is-success" : "is-info"}" value="${pct}" max="100">${pct}%</progress>`}
        <button type="button" class="button is-small mm-pick" data-i="${i}">${t("mushroom.viewDetails")}</button>
      </div>`;
    })
    .join("");
  box.innerHTML = `
    <section class="mt-5" aria-labelledby="mmResTitle">
      <h2 class="title is-5" id="mmResTitle">${t("mushroom.resultsTitle")}</h2>
      <article class="message ${meta.cls} mm-status mm-status--${c.status}"><div class="message-body">
        <p class="is-size-5"><strong>${likely ? t("mushroom.statusLikely") : t("mushroom.statusUncertain")}</strong></p>
        <p>${renderCategoryBadge(c.headlineCategory)}</p>
        <p class="mt-2">${escapeHtml(t(`mushroom.explain_${c.headlineCategory}`))}</p>
        ${likely ? `<p class="mt-2">${escapeHtml(t("mushroom.likelyExplain"))}</p>` : `<p class="mt-2"><strong>${t("mushroom.inconclusiveHeadline")}.</strong> ${t("mushroom.inconclusiveSub")}</p><ul>${reasons}</ul>`}
      </div></article>
      ${danger}${look}
      <h3 class="title is-6">${t("mushroom.candidates")}</h3>
      ${cards || ""}
      <div id="mmDetail"></div>
    </section>`;

  const showDetail = (i) => {
    const x = c.candidates[i];
    if (!x) return;
    box.querySelectorAll(".mm-cand").forEach((el) => el.classList.toggle("is-selected", el.dataset.i === String(i)));
    const entry = x.entry;
    // For an uncertain overall result the per-candidate panel is shown for that candidate only.
    const cat = entry ? x.category : "toxicity_unknown";
    const dist = entry ? renderDistribution(entry, data) : "";
    document.getElementById("mmDetail").innerHTML = `
      <div class="mt-4">
        <div id="mmHero"></div>
        ${renderSummaryCard(entry, cat)}
        ${renderToxicityPanel(entry, cat, data)}
        ${entry ? `<section class="box">${renderSpeciesDetail(entry, data)}</section>` : ""}
        ${dist}
      </div>`;
    if (entry) { mountDist(entry, data); hydrateHeroImage(document.getElementById("mmHero"), entry); }
  };
  box.querySelectorAll(".mm-pick").forEach((b) => b.addEventListener("click", () => showDetail(Number(b.dataset.i))));
  const first = c.candidates.findIndex((x) => x.entry);
  showDetail(first >= 0 ? first : 0);
}

function renderDistribution(entry, data) {
  const recs = data.records.filter((r) => r.speciesId === entry.id);
  return `
    <section class="box" aria-labelledby="mmDistTitle">
      <h3 class="title is-5" id="mmDistTitle">${t("mushroom.mapTitle")}</h3>
      ${renderMushroomMapShell("mmResultMap")}
      ${renderLegend({ hasRecords: recs.length > 0 })}
      <div id="mmMarkerInfo" class="mm-popup" aria-live="polite"></div>
      <p class="help">${t("mushroom.distProvincesApprox")}</p>
      ${recs.length ? `<p>${fmt(t("mushroom.distRecordsCount"), { n: recs.length })}</p>` : `<p class="help">${t("mushroom.distNoRecords")}</p>`}
      <a class="button is-link is-light mt-2" href="#/mushroom-atlas" id="mmOpenAtlas" data-id="${escapeHtml(entry.id)}">${t("mushroom.openAtlas")}</a>
    </section>`;
}

async function mountDist(entry, data) {
  document.getElementById("mmOpenAtlas")?.addEventListener("click", (e) => sessionStorage.setItem("pendingMushroomId", e.currentTarget.dataset.id));
  const lang = getCurrentLanguage();
  const map = await mountMushroomMap("mmResultMap", {
    lang,
    onMarker: (r) => {
      document.getElementById("mmMarkerInfo").innerHTML = renderRecordPopup(r, { sources: data.sources, lang, speciesName: entry.scientificName, habitatLabel: r.habitat ? t(`mushroom.hab_${r.habitat}`) : "" });
    },
  });
  if (!map) return;
  const counts = new Map([...provincesForSpecies(entry, data.regions).keys()].map((p) => [p, 1]));
  map.setShading(counts, "single");
  map.setMarkers(data.records.filter((r) => r.speciesId === entry.id), () => entry.toxicity?.category || "toxicity_unknown");
}
