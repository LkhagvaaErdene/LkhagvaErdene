// Distribution layer on top of the EXISTING map.svg (same loader, same province paths and labels).
import { loadMapSvg } from "../services/mapService.js";
import { updateMapLabels, getProvinceDisplayName } from "./map.js";
import { geoToSvg } from "../fn/geo.js";
import { isConfirmedRecord } from "../services/mushroomService.js";
import { escapeHtml } from "../fn/format.js";
import { t } from "../i18n/i18n.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderMushroomMapShell(id = "mushroomMapHost") {
  return `<div class="map-wrap mushroom-map"><div id="${id}" class="mm-svg-host" aria-label="${escapeHtml(t("mushroom.mapTitle"))}"></div></div>`;
}

export async function mountMushroomMap(hostId, { lang = "mn", onProvince, onMarker } = {}) {
  const host = document.getElementById(hostId);
  if (!host) return null;
  host.innerHTML = await loadMapSvg();
  updateMapLabels(host, lang);
  const svg = host.querySelector("svg");
  const layer = document.createElementNS(SVG_NS, "g");
  layer.setAttribute("class", "mushroom-markers");
  svg.appendChild(layer);
  const paths = [...svg.querySelectorAll("path[name]")];

  paths.forEach((p) => {
    const name = p.getAttribute("name");
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    p.setAttribute("aria-label", getProvinceDisplayName(name, lang));
    const fire = () => onProvince?.(name);
    p.addEventListener("click", fire);
    p.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fire()));
  });

  return {
    // counts: Map(province -> n). mode "single" = one species (approx class), "density" = levels by count.
    setShading(counts, mode = "density") {
      const max = Math.max(0, ...counts.values());
      paths.forEach((p) => {
        p.classList.remove("mm-approx", "mm-l1", "mm-l2", "mm-l3", "mm-l4");
        const n = counts.get(p.getAttribute("name")) || 0;
        p.dataset.count = String(n);
        if (!n) return;
        if (mode === "single") p.classList.add("mm-approx");
        else p.classList.add(`mm-l${Math.min(4, Math.max(1, Math.ceil((n / max) * 4)))}`);
      });
    },
    setMarkers(records, categoryOf) {
      layer.innerHTML = "";
      for (const r of records) {
        const { x, y } = geoToSvg(Number(r.latitude), Number(r.longitude));
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", x.toFixed(1));
        c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("r", "5");
        c.setAttribute("tabindex", "0");
        c.setAttribute("role", "button");
        c.setAttribute("class", `mm-marker mm-marker--${categoryOf(r)} ${isConfirmedRecord(r) ? "is-confirmed" : "is-unverified"}`);
        c.dataset.recordId = r.id;
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = r.scientificName || r.speciesId;
        c.appendChild(title);
        const fire = () => onMarker?.(r);
        c.addEventListener("click", (e) => (e.stopPropagation(), fire()));
        c.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fire()));
        layer.appendChild(c);
      }
    },
  };
}

export function renderLegend({ hasRecords }) {
  return `
    <ul class="mm-legend">
      <li><span class="mm-sw mm-sw--approx"></span>${t("mushroom.legendApprox")}</li>
      ${hasRecords ? `<li><span class="mm-sw mm-sw--ver"></span>${t("mushroom.legendVerified")}</li><li><span class="mm-sw mm-sw--unv"></span>${t("mushroom.legendUnverified")}</li>` : ""}
      <li><span class="mm-sw mm-sw--none"></span>${t("mushroom.legendNone")}</li>
    </ul>`;
}

export function renderRecordPopup(r, { sources, lang, speciesName, habitatLabel }) {
  const src = sources[r.source?.id];
  const unknown = t("mushroom.mkUnknown");
  const row = (k, v) => `<tr><th>${t(k)}</th><td>${v}</td></tr>`;
  return `
    <h4 class="title is-6"><em>${escapeHtml(r.scientificName || speciesName)}</em></h4>
    <table class="table is-narrow is-fullwidth mm-popup-table"><tbody>
      ${row("mushroom.mkLocation", escapeHtml([r.country, r.province && getProvinceDisplayName(r.province, lang)].filter(Boolean).join(", ") || unknown))}
      ${r.soum ? row("mushroom.mkSoum", escapeHtml(r.soum)) : ""}
      ${r.region ? row("mushroom.mkRegion", escapeHtml(r.region)) : ""}
      ${row("mushroom.mkCoords", `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`)}
      ${r.coordinateUncertaintyM != null ? row("mushroom.mkUncertainty", `${escapeHtml(r.coordinateUncertaintyM)} m`) : ""}
      ${row("mushroom.mkObserved", escapeHtml(r.observationDate || unknown))}
      ${habitatLabel ? row("mushroom.mkHabitat", escapeHtml(habitatLabel)) : ""}
      ${row("mushroom.mkSource", r.source?.recordUrl ? `<a href="${escapeHtml(r.source.recordUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.source.datasetName || src?.citation || r.source.id || "")}</a>` : escapeHtml(r.source?.datasetName || src?.citation || unknown))}
      ${row("mushroom.mkVerification", escapeHtml(t(`mushroom.ver_${r.verification || "unverified"}`)))}
    </tbody></table>`;
}
