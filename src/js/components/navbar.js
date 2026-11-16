import { t, toggleLanguage } from "../i18n/i18n.js";
import { CALCS } from "../pages/mushroomCalcPage.js";
import { getLocalizedValue as LV } from "../i18n/i18n.js";
import { xt } from "../i18n/mushroomExtraText.js";
import { getThemePreference, setThemePreference } from "../i18n/theme.js";

// Keep in sync with $navbar-breakpoint in src/scss/main.scss (burger menu below this width).
const NAV_BREAKPOINT = 1407;

export function renderNavbar() {
  return `
    <header class="app-sticky app-shadow">
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="container">
          <div class="navbar-brand">
            <a class="navbar-item has-text-weight-bold is-uppercase app-logo" href="#/overview">
              <figure class="image"><img src="./img/icon/icon.png" alt="logo" /></figure>
              <p><span class="is-hidden-mobile">${t("nav.brandSpan")}</span> ${t("nav.brand")}</p>
            </a>
            <a class="navbar-burger" role="button" aria-expanded="false" data-target="topNavbar">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>

          <div class="navbar-menu has-text-weight-semibold" id="topNavbar">
            <div class="navbar-start app-top-navbar-right">
<a class="navbar-item" href="#/overview"><span class="icon has-text-success"><i class="fas fa-seedling"></i></span><span>${LV({mn:"Нүүр",en:"Home"})}</span></a>
<div class="navbar-item has-dropdown is-hoverable app-dd"><a class="navbar-link" href="#" role="button" aria-haspopup="true" aria-expanded="false"><span class="icon has-text-primary"><i class="fas fa-book-open"></i></span><span>${LV({mn:"Мэдээлэл",en:"Learn"})}</span></a><div class="navbar-dropdown">
<a class="navbar-item" href="#/mushroom-atlas"><span class="icon"><i class="fas fa-map-location-dot"></i></span><span>${t("mushroom.navAtlas")}</span></a>
<a class="navbar-item" href="#/mushroom-compare"><span class="icon"><i class="fas fa-code-compare"></i></span><span>${LV({mn:"Харьцуулах",en:"Compare"})}</span></a>
<a class="navbar-item" href="#/mushroom-lookalikes"><span class="icon"><i class="fas fa-clone"></i></span><span>${LV({mn:"Төстэй зүйлс",en:"Look-alikes"})}</span></a>
<a class="navbar-item" href="#/mushroom-glossary"><span class="icon"><i class="fas fa-spell-check"></i></span><span>${LV({mn:"Нэр томьёо",en:"Glossary"})}</span></a>
</div></div>
<a class="navbar-item nav-identify" href="#/mushrooms"><span class="icon has-text-info"><i class="fas fa-camera"></i></span><span>${t("mushroom.navIdentify")}</span></a>
<div class="navbar-item has-dropdown is-hoverable app-dd"><a class="navbar-link" href="#" role="button" aria-haspopup="true" aria-expanded="false"><span class="icon has-text-link"><i class="fas fa-calculator"></i></span><span>${xt("navCalc")}</span></a><div class="navbar-dropdown">
${Object.entries(CALCS).map(([k,c])=>`<a class="navbar-item" href="#/calc-${k}"><span class="icon"><i class="fas fa-${c.icon}"></i></span><span>${LV(c.title)}</span></a>`).join("")}</div></div>
<div class="navbar-item has-dropdown is-hoverable app-dd nav-safety"><a class="navbar-link" href="#/mushroom-safety" role="button" aria-haspopup="true" aria-expanded="false"><span class="icon"><i class="fas fa-triangle-exclamation"></i></span><span>${LV({mn:"Аюулгүй байдал",en:"Safety"})}</span></a><div class="navbar-dropdown is-right nav-safety-dd">
<div class="nav-sos"><p class="nav-sos-title">${LV({mn:"Хордсон гэж сэжиглэвэл залгана уу",en:"Suspected poisoning? Call now"})}</p>
<div class="nav-sos-btns"><a class="button is-danger" href="tel:103"><span class="icon"><i class="fas fa-phone"></i></span><span>103</span></a><a class="button is-danger is-light" href="tel:105"><span class="icon"><i class="fas fa-phone"></i></span><span>105</span></a></div></div>
<hr class="navbar-divider">
<a class="navbar-item" href="#/mushroom-safety-sos"><span class="icon has-text-danger"><i class="fas fa-truck-medical"></i></span><span>${LV({mn:"Хордсон уу? Юу хийх вэ",en:"Poisoned? What to do"})}</span></a>
<a class="navbar-item" href="#/mushroom-safety-check"><span class="icon has-text-success"><i class="fas fa-clipboard-check"></i></span><span>${LV({mn:"Идэхийн өмнөх шалгалт",en:"Before-eating check"})}</span></a>
<a class="navbar-item" href="#/mushroom-safety-facts"><span class="icon has-text-info"><i class="fas fa-lightbulb"></i></span><span>${LV({mn:"Буруу итгэл, хорын лавлах",en:"Myths & toxin reference"})}</span></a>
</div></div>
<a class="navbar-item" href="#/contact"><span class="icon has-text-danger"><i class="fas fa-address-card"></i></span><span>${t("nav.contact")}</span></a>
            </div>

            <div class="navbar-end">
              <div class="navbar-item has-dropdown is-hoverable" id="themeDropdown">
                <a class="navbar-link" href="#" id="themeToggle" role="button" aria-haspopup="true" aria-label="${t("nav.theme")}">
                  <span class="icon app-theme-icon app-theme-icon-light"><i class="fas fa-sun"></i></span>
                  <span class="icon app-theme-icon app-theme-icon-dark"><i class="fas fa-moon"></i></span>
                  <span class="icon app-theme-icon app-theme-icon-auto"><i class="fas fa-circle-half-stroke"></i></span>
                  <span class="app-theme-label">${t("nav.theme")}</span>
                </a>
                <div class="navbar-dropdown is-right">
                  <a class="navbar-item" href="#" data-theme-option="light">
                    <span class="icon"><i class="fas fa-sun"></i></span>
                    <span>${t("nav.themeLight")}</span>
                  </a>
                  <a class="navbar-item" href="#" data-theme-option="dark">
                    <span class="icon"><i class="fas fa-moon"></i></span>
                    <span>${t("nav.themeDark")}</span>
                  </a>
                  <a class="navbar-item" href="#" data-theme-option="auto">
                    <span class="icon"><i class="fas fa-circle-half-stroke"></i></span>
                    <span>${t("nav.themeAuto")}</span>
                  </a>
                </div>
              </div>
              <a class="navbar-item" href="#" id="langToggle">${t("nav.language")}</a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  `;
}

export function initNavbar() {
  const burger = document.querySelector(".navbar-burger");
  const languageToggle = document.getElementById("langToggle");

  if (!burger) return;

  const targetId = burger.dataset.target;
  const menu = document.getElementById(targetId);
  const navLinks = menu?.querySelectorAll(".navbar-item[href^='#/']");

  function openMenu() {
    burger.classList.add("is-active");
    menu?.classList.add("is-active");
    burger.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    burger.classList.remove("is-active");
    menu?.classList.remove("is-active");
    burger.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const isOpen = burger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  burger.addEventListener("click", toggleMenu);

  navLinks?.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= NAV_BREAKPOINT) {
        closeMenu();
      }
    });
  });

  if (languageToggle) {
    languageToggle.addEventListener("click", (event) => {
      event.preventDefault();
      closeMenu();
      toggleLanguage();
      window.location.reload();
    });
  }

  initThemeDropdown();
  initMushroomDropdown();

  window.addEventListener("resize", () => {
    if (window.innerWidth > NAV_BREAKPOINT) {
      closeMenu();
    }
  });
}

// Загвар сонгох dropdown (Light / Dark / Auto)
function initThemeDropdown() {
  const dropdown = document.getElementById("themeDropdown");
  const toggle = document.getElementById("themeToggle");
  if (!dropdown || !toggle) return;

  const options = dropdown.querySelectorAll("[data-theme-option]");

  // Одоо сонгогдсон сонголтыг is-active болгож тэмдэглэнэ
  function markActive() {
    const current = getThemePreference();
    options.forEach((option) => {
      option.classList.toggle("is-active", option.dataset.themeOption === current);
    });
  }

  // Мобайл (hover байхгүй) дээр товшиж нээнэ/хаана
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    dropdown.classList.toggle("is-active");
  });

  options.forEach((option) => {
    option.addEventListener("click", (event) => {
      event.preventDefault();
      setThemePreference(option.dataset.themeOption);
      markActive();
      dropdown.classList.remove("is-active");
    });
  });

  // Dropdown-ийн гадна товшвол хаана
  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("is-active");
    }
  });

  markActive();
}

export function mountNavbar(root) {
  if (!root) return;
  root.innerHTML = renderNavbar();
  initNavbar();
}

// Dropdowns: click/tap toggle (hover alone does not work on touch screens); Escape closes.
function initMushroomDropdown() {
  const dds = [...document.querySelectorAll(".app-dd")];
  const setOpen = (dd, open) => {
    dd.classList.toggle("is-active", open);
    dd.querySelector(".navbar-link")?.setAttribute("aria-expanded", String(open));
  };
  dds.forEach((dd) => {
    dd.querySelector(".navbar-link").addEventListener("click", (event) => {
      event.preventDefault();
      const open = dd.classList.contains("is-active");
      dds.forEach((o) => setOpen(o, false));
      if (!open) setOpen(dd, true);
    });
    dd.querySelectorAll(".navbar-dropdown a").forEach((a) => a.addEventListener("click", () => setOpen(dd, false)));
  });
  document.addEventListener("click", (event) => {
    dds.forEach((dd) => { if (!dd.contains(event.target)) setOpen(dd, false); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dds.forEach((dd) => setOpen(dd, false));
  });
}
