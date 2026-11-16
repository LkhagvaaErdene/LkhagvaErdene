/* Загвар (theme): light | dark | auto
   auto бол компьютер/утасны үйлдлийн системийн тохиргоог дагана. */

const STORAGE_KEY = "theme";
const DEFAULT_THEME = "auto";
export const THEMES = ["light", "dark", "auto"];

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

// Хадгалагдсан сонголтыг авна (light | dark | auto)
export function getThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

// Бодитоор ашиглагдах загвар: auto бол системийнхээс хамаарна
function resolveTheme(preference) {
  if (preference === "auto") return darkQuery.matches ? "dark" : "light";
  return preference;
}

// <html data-theme="light|dark" data-theme-pref="light|dark|auto">
export function applyTheme() {
  const preference = getThemePreference();
  const root = document.documentElement;
  root.setAttribute("data-theme", resolveTheme(preference));
  root.setAttribute("data-theme-pref", preference);
}

export function setThemePreference(preference) {
  if (!THEMES.includes(preference)) return;
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* хадгалах боломжгүй бол зөвхөн энэ удаагийн сонголт хүчинтэй */
  }
  applyTheme();
}

// Апп эхлэхэд нэг удаа дуудна. auto үед системийн тохиргоо өөрчлөгдвөл шууд солигдоно.
export function initTheme() {
  applyTheme();
  darkQuery.addEventListener("change", () => {
    if (getThemePreference() === "auto") applyTheme();
  });
}
