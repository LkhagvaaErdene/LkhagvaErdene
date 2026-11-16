// Safety hub: three bookmarkable tabs (#/mushroom-safety-sos | -check | -facts) under one
// always-visible emergency call strip. General information only - never a diagnosis.
import { renderPageLayout } from "../layouts/pageLayout.js";
import { renderNotification } from "../layouts/notificationLayout.js";
import { t, getLocalizedValue as L } from "../i18n/i18n.js";
import { escapeHtml as esc } from "../fn/format.js";
import { loadMushroomData } from "../services/mushroomService.js";
import { hoursBetween } from "../fn/mushroomCalc.js";
import { renderSafetyWarning, renderCategoryBadge } from "../components/mushroomUi.js";

const app = () => document.getElementById("app");
const $ = (id) => document.getElementById(id);
const ul = (a) => `<ul>${a.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul>`;

const TABS = [
  { id: "sos", icon: "truck-medical", label: { mn: "Хордсон уу?", en: "Poisoned?" } },
  { id: "check", icon: "clipboard-check", label: { mn: "Идэхийн өмнө", en: "Before eating" } },
  { id: "facts", icon: "lightbulb", label: { mn: "Баримт, хор", en: "Facts & toxins" } },
];

const SEV = {
  "life-threatening": [0, { mn: "Үхлийн аюултай", en: "Life-threatening", c: "danger" }],
  "serious (CNS)": [1, { mn: "Ноцтой (мэдрэлийн систем)", en: "Serious (nervous system)", c: "danger" }],
  "serious (muscle)": [1, { mn: "Ноцтой (булчин)", en: "Serious (muscle)", c: "danger" }],
  "moderate (gastrointestinal)": [2, { mn: "Дунд (хоол боловсруулах)", en: "Moderate (gastrointestinal)", c: "warning" }],
};
const SYMS = [
  { mn: "Бөөлжих", en: "Vomiting" }, { mn: "Суулгалт", en: "Diarrhoea" }, { mn: "Хэвлийн өвдөлт", en: "Abdominal pain" },
  { mn: "Толгой эргэх, төөрөлдөх", en: "Dizziness, confusion" }, { mn: "Хий үзэгдэл, хөдөлгөөний алдагдал", en: "Hallucinations, loss of coordination" },
  { mn: "Хөлрөх, шүлс их гарах", en: "Sweating, heavy salivation" }, { mn: "Булчин өвдөх, шээс бараан болох", en: "Muscle pain, dark urine" }, { mn: "Бусад", en: "Other" },
];
const GATE = [
  { mn: "Мэргэжилтэн (миколог) дээжийг биечлэн хараад зүйлийг баталгаажуулсан.", en: "An expert (mycologist) examined the specimen in person and confirmed the species." },
  { mn: "Ишний суурийг бүтэн ухаж, волва байгаа эсэхийг шалгасан.", en: "I dug out the whole stem base and checked for a volva." },
  { mn: "Цагираг, хавтсын өнгө, бэхэлгээг шалгасан.", en: "I checked the ring and the colour and attachment of the gills." },
  { mn: "Төстэй аюултай зүйлтэй (Төстэй зүйлс хуудас) харьцуулсан.", en: "I compared it with dangerous look-alikes (Look-alikes page)." },
  { mn: "Мөөг шинэхэн, ялзраагүй, хорхойгүй.", en: "The mushroom is fresh, not decayed or maggoty." },
  { mn: "Зөвхөн нэг зүйлийн мөөгийг, бусадтай хольсонгүй.", en: "Only one species, not mixed with others." },
  { mn: "Эхний удаа бага хэмжээгээр бөгөөд хэдэн ширхэг дээжийг тусад нь хадгалсан.", en: "First time only a small portion, and a few specimens are kept aside." },
];
const STEPS = [
  { icon: "phone", tone: "danger", h: { mn: "Залгах: 103", en: "Call 103" }, p: { mn: "Шинж тэмдэг илрэхийг хүлээхгүй. Хамт идсэн бүх хүний талаар хэл.", en: "Do not wait for symptoms. Tell them about everyone who ate it." } },
  { icon: "clock", tone: "warning", h: { mn: "Цагаа тэмдэглэх", en: "Note the time" }, p: { mn: "Хэзээ идсэн, шинж тэмдэг хэзээ эхэлснийг доор оруул.", en: "Enter when it was eaten and when symptoms began (below)." } },
  { icon: "box-archive", tone: "info", h: { mn: "Дээж хадгалах", en: "Keep samples" }, p: { mn: "Үлдсэн мөөг, бөөлжсөн зүйлийг савлаж, мөөгийг зураг авч эмнэлэгт авч яв.", en: "Bag leftover mushroom and vomit, photograph the mushroom, and take them to the hospital." } },
  { icon: "users", tone: "success", h: { mn: "Бусдыг шалгах", en: "Check others" }, p: { mn: "Хамт идсэн хүн шинж тэмдэггүй ч эмчид үзүүл.", en: "Anyone who ate it should be seen even without symptoms." } },
];
const DONT = [
  { mn: "Эмчийн зааваргүйгээр өөрийгөө бөөлжүүлэхгүй.", en: "Do not make yourself vomit unless a medical professional tells you to." },
  { mn: "Сүү, архи, ардын аргаар “эмчлэхгүй”.", en: "Do not self-treat with milk, alcohol or folk remedies." },
  { mn: "Шинж тэмдэг намжихыг хүлээхгүй: хожуу илэрдэг хор байдаг.", en: "Do not wait for symptoms to ease: some toxins act late." },
];
const MYTHS = [
  [{ mn: "Хоол хийх, хатаах, хөлдөөх нь хортой мөөгийг хоргүй болгоно.", en: "Cooking, drying or freezing makes poisonous mushrooms safe." },
    { mn: "Амитоксин зэрэг зарим хор халаалтад задардаггүй (нэр томьёоны толийг үз). Бэлтгэх арга нь хортой мөөгийг аюулгүй болгохгүй.", en: "Some toxins, such as amatoxins, are heat-stable (see the glossary). Preparation does not make a poisonous mushroom safe." }],
  [{ mn: "Малгайг хуулбал хор арилна.", en: "Peeling the cap removes the poison." },
    { mn: "Хор нь зөвхөн малгайны арьсанд байдаггүй. Хуулах нь мөөгийг аюулгүй болгохгүй.", en: "Toxins are not limited to the cap skin. Peeling does not make a mushroom safe." }],
  [{ mn: "Шавж, амьтан идсэн мөөг хүнд аюулгүй.", en: "A mushroom eaten by insects or animals is safe for people." },
    { mn: "Амьтан бүр хорыг өөр өөрөөр тэсвэрлэдэг. Тэдэнд хоргүй нь хүнд хоргүй гэсэн үг биш.", en: "Species tolerate toxins differently. Harmless to an animal does not mean harmless to a person." }],
  [{ mn: "Мөнгөн халбага хараагдвал хортой.", en: "A silver spoon tarnishes in poisonous mushrooms." },
    { mn: "Энэ нь найдвартай шалгалт биш. Халбага хараагдах эсэх нь мөөг хортой эсэхийг заадаггүй.", en: "This is not a reliable test. A spoon tarnishing does not tell you whether a mushroom is poisonous." }],
];
const RULES = [
  { mn: "Итгэлтэй таниагүй мөөгийг түүхгүй, идэхгүй.", en: "Never pick or eat a mushroom you cannot identify with certainty." },
  { mn: "Зөвхөн малгайны өнгөөр бүү ялга.", en: "Never rely on cap colour alone." },
  { mn: "Апп-ын зургийн танилт нь баталгаа биш: мэргэжилтнээр шалгуул.", en: "A photo result from this app is not proof: have an expert check it." },
];

async function load() {
  app().innerHTML = renderPageLayout({ content: renderNotification(t("notification.loadingData")) });
  try { return await loadMushroomData(); }
  catch (e) { console.error(e); app().innerHTML = renderPageLayout({ content: renderNotification(t("mushroom.errGeneric"), "danger") }); return null; }
}

const callStrip = () => `
  <section class="safety-call" aria-label="${esc(L({ mn: "Яаралтай дуудлага", en: "Emergency call" }))}">
    <div class="safety-call-text"><span class="icon"><i class="fas fa-truck-medical"></i></span><strong>${esc(L({ mn: "Хордсон гэж сэжиглэвэл шууд залгана уу", en: "If poisoning is suspected, call now" }))}</strong></div>
    <div class="buttons">
      <a class="button is-danger" href="tel:103"><span class="icon"><i class="fas fa-phone"></i></span><span>103 · ${esc(L({ mn: "Түргэн тусламж", en: "Ambulance" }))}</span></a>
      <a class="button is-danger is-light" href="tel:105"><span class="icon"><i class="fas fa-phone"></i></span><span>105 · ${esc(L({ mn: "Яаралтай хариу арга хэмжээ", en: "Emergency response" }))}</span></a>
    </div>
  </section>`;

const tabStrip = (active) => `
  <nav class="tabs is-toggle is-fullwidth safety-tabs" aria-label="${esc(L({ mn: "Аюулгүй байдлын хэсгүүд", en: "Safety sections" }))}"><ul>
    ${TABS.map((x) => `<li class="${x.id === active ? "is-active" : ""} safety-tab--${x.id}"><a href="#/mushroom-safety-${x.id}" ${x.id === active ? 'aria-current="page"' : ""}><span class="icon"><i class="fas fa-${x.icon}"></i></span><span>${esc(L(x.label))}</span></a></li>`).join("")}
  </ul></nav>`;

/* ---------------- SOS tab ---------------- */
function sosPanel(ms) {
  const sp = (id, key, inner) => `<div class="field"><label class="label" for="${id}">${esc(L(key))}</label>${inner}</div>`;
  return `
    <ol class="safety-steps">
      ${STEPS.map((s, i) => `<li class="safety-step safety-step--${s.tone}"><span class="safety-step-n" aria-hidden="true">${i + 1}</span><div><strong>${esc(L(s.h))}</strong><p>${esc(L(s.p))}</p></div></li>`).join("")}
    </ol>
    <div class="columns">
      <div class="column is-5">
        <div class="box">
          <h2 class="title is-5">${esc(L({ mn: "Хугацааны шугам", en: "Timeline" }))}</h2>
          <div class="tl" aria-hidden="true">
            <div class="tl-track"><span class="tl-seg tl-seg--a"></span><span class="tl-seg tl-seg--b"></span><span class="tl-seg tl-seg--c"></span><span class="tl-pin" id="tlPin" hidden></span></div>
            <div class="tl-ticks"><span style="left:0%">0</span><span style="left:12.5%">6</span><span style="left:50%">24</span><span style="left:100%">48 ${esc(L({ mn: "ц", en: "h" }))}</span></div>
          </div>
          <div id="tlOut" class="notification is-light is-warning mt-4" aria-live="polite">${esc(L({ mn: "Идсэн цагаа оруулбал өнгөрсөн хугацааг харуулна.", en: "Enter when it was eaten to see the elapsed time." }))}</div>
        </div>
        <article class="message is-danger is-light"><div class="message-header"><p>${esc(L({ mn: "Хийж болохгүй", en: "Do not" }))}</p></div><div class="message-body content">${ul(DONT)}</div></article>
        <p class="help">${esc(L({ mn: "Ерөнхий мэдээлэл: эмчийн зөвлөгөө биш. 103-ын зааврыг дага. Дугаар: Харилцаа холбооны зохицуулах хороо (crc.gov.mn). Хордлогын тусгай төвийн дугаарыг орон нутгийн эмнэлгээс урьдчилан мэдэж аваарай.", en: "General information, not medical advice. Follow the 103 operator's instructions. Numbers: Communications Regulatory Commission (crc.gov.mn). Ask your local hospital for a poison-information number in advance." }))}</p>
      </div>
      <div class="column is-7"><div class="box">
        <h2 class="title is-5">${esc(L({ mn: "Эмчид өгөх мэдээлэл бэлтгэх", en: "Prepare information for the doctor" }))}</h2>
        <p class="help mb-3">${esc(L({ mn: "Оношлол биш. Эмч нарт хурдан мэдээлэл өгөхөд туслана. Эхлээд 103 руу залгаарай.", en: "Not a diagnosis. Helps you give information quickly. Call 103 first." }))}</p>
        ${sp("rSp", { mn: "Мөөгний зүйл (мэдэж байгаа бол)", en: "Mushroom species (if known)" }, `<div class="select is-fullwidth"><select id="rSp"><option value="">${esc(L({ mn: "Мэдэхгүй", en: "Unknown" }))}</option>${ms.map((m) => `<option value="${esc(m.id)}">${esc(m.scientificName)}</option>`).join("")}</select></div>`)}
        ${sp("rAte", { mn: "Хэзээ идсэн", en: "When eaten" }, `<input id="rAte" class="input" type="datetime-local" />`)}
        ${sp("rOn", { mn: "Шинж тэмдэг хэзээ эхэлсэн (байвал)", en: "When symptoms started (if any)" }, `<input id="rOn" class="input" type="datetime-local" />`)}
        ${sp("rN", { mn: "Хэдэн хүн идсэн", en: "How many people ate it" }, `<input id="rN" class="input" type="number" min="1" value="1" />`)}
        ${sp("rQ", { mn: "Хэмжээ, хэрхэн бэлтгэсэн", en: "Amount and how prepared" }, `<input id="rQ" class="input" type="text" />`)}
        <div class="field"><label class="label">${esc(L({ mn: "Шинж тэмдэг", en: "Symptoms" }))}</label><div class="safety-syms">${SYMS.map((k) => `<label class="checkbox"><input type="checkbox" class="sym" value="${esc(L(k))}" /> ${esc(L(k))}</label>`).join("")}</div></div>
        <label class="checkbox is-block mb-3"><input type="checkbox" id="rKeep" /> ${esc(L({ mn: "Үлдэгдэл мөөг эсвэл зураг байгаа", en: "I have leftovers or a photo of the mushroom" }))}</label>
        <div id="rOut"></div>
      </div></div>
    </div>`;
}

function wireSos(ms) {
  const drawTimeline = () => {
    const ate = $("rAte").value, pin = $("tlPin"), out = $("tlOut");
    if (!ate) { pin.hidden = true; return; }
    const since = hoursBetween(ate, new Date());
    if (since === null) {
      pin.hidden = true; out.className = "notification is-light is-warning mt-4";
      out.textContent = L({ mn: "Идсэн цаг ирээдүйд байна: шалгана уу.", en: "The eating time is in the future: please check it." });
      return;
    }
    pin.hidden = false; pin.style.left = `${Math.min(100, (since / 48) * 100)}%`;
    const h = Math.round(since * 10) / 10;
    const msg = since < 6
      ? L({ mn: "Шинж тэмдэг хараахан илрээгүй байж болно. Хүлээлгүй 103-д залгана уу.", en: "Symptoms may not have appeared yet. Do not wait: call 103." })
      : since < 24
        ? L({ mn: "Өгөгдлийн сангаас: амитоксинт зүйлд шинж тэмдэг хожуу (ойролцоогоор 6–24 цаг) илэрдэг. Шинж тэмдэггүй ч яаралтай үзүүлнэ үү.", en: "From the database: amatoxin species show delayed symptoms (about 6–24 h). Seek care urgently even without symptoms." })
        : L({ mn: "Хугацаа багагүй өнгөрсөн. Шинж тэмдэг байсан ч, байгаагүй ч яаралтай эмнэлэгт хандана уу.", en: "A good deal of time has passed. Seek care urgently whether or not there are symptoms." });
    out.className = `notification is-light mt-4 is-${since >= 6 ? "danger" : "warning"}`;
    out.textContent = `${h.toLocaleString()} ${L({ mn: "цагийн өмнө идсэн.", en: "h since eating." })} ${msg}`;
  };

  const rep = () => {
    const m = ms.find((x) => x.id === $("rSp").value), now = new Date();
    const ate = $("rAte").value, on = $("rOn").value;
    const since = ate ? hoursBetween(ate, now) : null, delay = ate && on ? hoursBetween(ate, on) : null;
    const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString();
    const syms = [...document.querySelectorAll(".sym:checked")].map((x) => x.value);
    const unk = L({ mn: "тодорхойгүй", en: "unknown" });
    const lines = [
      `${L({ mn: "Мөөгний зүйл", en: "Species" })}: ${m ? `${m.scientificName} (${L({ mn: "хэрэглэгчийн таамаг", en: "user's guess" })})` : L({ mn: "мэдэхгүй", en: "unknown" })}`,
      `${L({ mn: "Идсэн цаг", en: "Time eaten" })}: ${ate ? ate.replace("T", " ") : unk}${since !== null ? ` (${f1(since)} ${L({ mn: "цагийн өмнө", en: "h ago" })})` : ""}`,
      `${L({ mn: "Шинж тэмдэг эхэлсэн", en: "Symptom onset" })}: ${on ? on.replace("T", " ") : L({ mn: "эхлээгүй / тодорхойгүй", en: "none / unknown" })}${delay !== null ? ` (${f1(delay)} ${L({ mn: "цагийн дараа", en: "h after eating" })})` : ""}`,
      `${L({ mn: "Идсэн хүний тоо", en: "People who ate" })}: ${$("rN").value || "?"}`,
      `${L({ mn: "Хэмжээ, бэлтгэл", en: "Amount, preparation" })}: ${$("rQ").value || unk}`,
      `${L({ mn: "Шинж тэмдэг", en: "Symptoms" })}: ${syms.join(", ") || L({ mn: "бүртгээгүй", en: "none recorded" })}`,
      `${L({ mn: "Үлдэгдэл/зураг", en: "Leftovers/photo" })}: ${$("rKeep").checked ? L({ mn: "байгаа", en: "available" }) : L({ mn: "байхгүй", en: "not available" })}`,
    ];
    if (m && SEV[m.toxicity?.severity]) lines.push(`${L({ mn: "Өгөгдлийн сан (ерөнхий мэдээлэл)", en: "Database (general info)" })}: ${(m.toxicity.toxins || []).join(", ")}; ${L(m.toxicity.symptoms, "")}`);
    const warn = [];
    if (ate && since === null) warn.push(L({ mn: "Идсэн цаг ирээдүйд байна: шалгана уу.", en: "The eating time is in the future: please check it." }));
    if (on && ate && delay === null) warn.push(L({ mn: "Шинж тэмдэг идсэнээс өмнө эхэлсэн байна: шалгана уу.", en: "Symptoms start before eating: please check." }));
    if (delay !== null && delay >= 6) warn.push(L({ mn: "Шинж тэмдэг 6+ цагийн дараа эхэлсэн. Өгөгдөлд амитоксинт зүйлд шинж тэмдэг хожуу (ойролцоогоор 6–24 цаг) илэрдэг гэсэн. Яаралтай хандана уу.", en: "Symptoms began 6+ hours later. The database notes that amatoxin species show delayed symptoms (about 6–24 h). Seek care urgently." }));
    const text = lines.join("\n");

    const out = $("rOut");
    out.textContent = "";
    for (const w of warn) { const d = document.createElement("div"); d.className = "notification is-warning is-light"; d.textContent = w; out.append(d); }
    const ta = document.createElement("textarea"); // textContent/value only: user text is never parsed as HTML
    ta.className = "textarea"; ta.rows = 8; ta.readOnly = true; ta.id = "rTxt"; ta.value = text;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "button is-link mt-2"; btn.textContent = L({ mn: "Хуулах", en: "Copy" });
    const ok = document.createElement("span"); ok.className = "help is-inline ml-2";
    btn.onclick = async () => {
      try { await navigator.clipboard.writeText(text); ok.textContent = L({ mn: "Хуулагдлаа", en: "Copied" }); }
      catch { ta.select(); document.execCommand?.("copy"); ok.textContent = L({ mn: "Сонгогдлоо: хуулна уу", en: "Selected: copy it" }); }
    };
    out.append(ta, btn, ok);
  };

  document.querySelectorAll("#rSp,#rAte,#rOn,#rN,#rQ,#rKeep,.sym").forEach((e) => e.addEventListener("input", rep));
  $("rAte").addEventListener("input", drawTimeline);
  rep();
}

/* ---------------- Before-eating tab ---------------- */
function checkPanel(ms) {
  return `
    <div class="columns">
      <div class="column is-7"><div class="box">
        <h2 class="title is-5">${esc(L({ mn: "Хэрэглэхийн өмнөх шалгах хуудас", en: "Pre-eating checklist" }))}</h2>
        <progress id="gateBar" class="progress is-danger" value="0" max="${GATE.length}"></progress>
        ${GATE.map((g) => `<label class="checkbox is-block mb-2"><input type="checkbox" class="gate" /> ${esc(L(g))}</label>`).join("")}
        <div id="gateOut" class="notification mt-3" aria-live="polite"></div>
      </div></div>
      <div class="column is-5"><div class="box">
        <h2 class="title is-5">${esc(L({ mn: "Таны мөөгийг ялгах шинж", en: "How to tell your mushroom" }))}</h2>
        <div class="select is-fullwidth mb-3"><select id="spPick" aria-label="${esc(L({ mn: "Мөөгний зүйл", en: "Mushroom species" }))}"><option value="">${esc(L({ mn: "Зүйлээ сонго…", en: "Pick a species…" }))}</option>${ms.map((m) => `<option value="${esc(m.id)}">${esc(m.scientificName)}</option>`).join("")}</select></div>
        <div id="spOut" class="content"><p class="help">${esc(L({ mn: "Зүйл сонговол ялгах арга болон төстэй аюултай зүйлийг харуулна.", en: "Pick a species to see how to tell it and its dangerous look-alikes." }))}</p></div>
      </div></div>
    </div>`;
}

function wireCheck(ms) {
  const gates = [...document.querySelectorAll(".gate")];
  const upd = () => {
    const n = gates.filter((g) => g.checked).length, all = n === gates.length;
    $("gateBar").value = n;
    $("gateBar").className = `progress is-${all ? "warning" : "danger"}`;
    const out = $("gateOut");
    out.className = `notification mt-3 is-light is-${all ? "warning" : "danger"}`;
    out.textContent = `${n} / ${gates.length} · ` + (all
      ? L({ mn: "Бүгдийг тэмдэглэсэн ч энэ нь аюулгүй гэсэн баталгаа БИШ. Идэхийн өмнө мэргэжилтнээр дахин шалгуулна уу.", en: "Even with everything ticked this is NOT a guarantee of safety. Have an expert check it again before eating." })
      : L({ mn: "Хэрэглэж БОЛОХГҮЙ. Бүх зүйл биелээгүй байна.", en: "Do NOT eat. Not all conditions are met." }));
  };
  gates.forEach((g) => g.addEventListener("change", upd));
  upd();

  $("spPick").addEventListener("change", () => {
    const m = ms.find((x) => x.id === $("spPick").value), out = $("spOut");
    if (!m) { out.innerHTML = ""; return; }
    const dang = (m.similarSpecies || []).filter((x) => x.risk === "dangerous");
    const own = m.toxicity?.category && m.toxicity.category !== "documented_edible"
      ? `<p>${renderCategoryBadge(m.toxicity.category)}</p>` : "";
    out.innerHTML = `${own}<p><strong>${esc(m.scientificName)}</strong></p><p>${esc(L(m.identificationNotes, "—"))}</p>` +
      (dang.length
        ? `<p class="mt-3"><strong>${esc(L({ mn: "Андуурагдах аюултай зүйл", en: "Dangerous look-alikes" }))}</strong></p><div class="tags">${dang.map((d) => `<span class="tag is-danger is-light"><em>${esc(d.scientificName)}</em></span>`).join("")}</div>` +
          (dang[0].id ? `<a class="button is-small is-link is-light mt-2 cmp" href="#/mushroom-compare" data-a="${esc(m.id)}" data-b="${esc(dang[0].id)}">${esc(L({ mn: "Харьцуулах", en: "Compare" }))}</a>` : "")
        : `<p class="help">${esc(L({ mn: "Өгөгдлийн санд аюултай төстэй зүйл бүртгээгүй. Энэ нь аюулгүй гэсэн үг биш.", en: "No dangerous look-alike is recorded in the database. That does not mean it is safe." }))}</p>`);
  });
}

/* ---------------- Facts tab ---------------- */
function factsPanel(ms) {
  const rank = (m) => (SEV[m.toxicity?.severity] || [9])[0];
  const rows = ms.filter((m) => SEV[m.toxicity?.severity]).sort((a, b) => rank(a) - rank(b)).map((m) => {
    const sv = SEV[m.toxicity.severity][1];
    const sim = (m.similarSpecies || []).find((x) => x.id && x.risk === "dangerous") || (m.similarSpecies || []).find((x) => x.id);
    return `<tr data-rank="${rank(m)}"><td><em>${esc(m.scientificName)}</em><br><span class="is-size-7">${esc(m.englishName || "")}</span></td><td><span class="tag is-light is-${sv.c}">${esc(L(sv))}</span></td><td>${esc((m.toxicity.toxins || []).join(", ") || "—")}</td><td>${esc(L(m.toxicity.symptoms, "—"))}</td><td>${sim ? `<a href="#/mushroom-compare" class="cmp" data-a="${esc(m.id)}" data-b="${esc(sim.id)}">${esc(L({ mn: "Харьцуулах", en: "Compare" }))}</a>` : ""}</td></tr>`;
  }).join("");
  const chips = [["all", { mn: "Бүгд", en: "All" }], ["0", { mn: "Үхлийн аюултай", en: "Life-threatening" }], ["1", { mn: "Ноцтой", en: "Serious" }], ["2", { mn: "Дунд", en: "Moderate" }]];
  return `
    <h2 class="title is-5">${esc(L({ mn: "Буруу итгэл: товшоод бодит байдлыг хар", en: "Myths: tap to see the facts" }))}</h2>
    <div class="safety-myths">${MYTHS.map(([m, f]) => `<details class="safety-myth"><summary><span class="tag is-danger is-light">${esc(L({ mn: "ХУДАЛ", en: "MYTH" }))}</span> ${esc(L(m))}</summary><p><span class="tag is-success is-light">${esc(L({ mn: "БОДИТ", en: "FACT" }))}</span> ${esc(L(f))}</p></details>`).join("")}</div>
    <div class="box content mt-4"><h3 class="title is-6">${esc(L({ mn: "Үндсэн дүрэм", en: "Core rules" }))}</h3>${ul(RULES)}</div>
    <h2 class="title is-5 mt-5">${esc(L({ mn: "Хордлогын лавлах (өгөгдлийн сангаас)", en: "Toxicity reference (from the database)" }))}</h2>
    <div class="buttons safety-chips" role="group" aria-label="${esc(L({ mn: "Хүнд байдлаар шүүх", en: "Filter by severity" }))}">${chips.map(([k, l], i) => `<button type="button" class="button is-small ${i === 0 ? "is-link" : "is-light"}" data-sev="${k}" aria-pressed="${i === 0}">${esc(L(l))}</button>`).join("")}</div>
    <div class="table-container"><table class="table is-fullwidth is-striped" id="sevTable"><thead><tr><th>${esc(L({ mn: "Зүйл", en: "Species" }))}</th><th>${esc(L({ mn: "Хүнд байдал", en: "Severity" }))}</th><th>${esc(L({ mn: "Хор", en: "Toxins" }))}</th><th>${esc(L({ mn: "Шинж тэмдэг", en: "Symptoms" }))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function wireFacts() {
  const chips = [...document.querySelectorAll(".safety-chips [data-sev]")];
  chips.forEach((c) => c.addEventListener("click", () => {
    chips.forEach((o) => { const on = o === c; o.classList.toggle("is-link", on); o.classList.toggle("is-light", !on); o.setAttribute("aria-pressed", String(on)); });
    document.querySelectorAll("#sevTable tbody tr").forEach((tr) => { tr.hidden = c.dataset.sev !== "all" && tr.dataset.rank !== c.dataset.sev; });
  }));
}

export async function renderSafetyPage(tab = "check") {
  const data = await load(); if (!data) return;
  if (!TABS.some((x) => x.id === tab)) tab = "check";
  const ms = data.mushrooms;
  const panel = tab === "sos" ? sosPanel(ms) : tab === "facts" ? factsPanel(ms) : checkPanel(ms);
  app().innerHTML = renderPageLayout({
    title: L({ mn: "Аюулгүй байдал", en: "Safety" }),
    content: `${callStrip()}${renderSafetyWarning()}${tabStrip(tab)}<div class="safety-panel" id="safetyPanel">${panel}</div>`,
  });
  if (tab === "sos") wireSos(ms); else if (tab === "facts") wireFacts(); else wireCheck(ms);
  // Compare links remember the pair; onclick (not addEventListener) so re-rendering never stacks handlers.
  app().onclick = (e) => {
    const a = e.target.closest(".cmp"); if (!a) return;
    try { sessionStorage.setItem("cmpA", a.dataset.a); sessionStorage.setItem("cmpB", a.dataset.b); } catch { /* ignore */ }
  };
}
