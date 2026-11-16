import { renderContactPage } from "./pages/contactPage.js";
import { renderMushroomIdentifyPage } from "./pages/mushroomIdentifyPage.js";
import { renderMushroomAtlasPage } from "./pages/mushroomAtlasPage.js";
import { renderMushroomIntroPage } from "./pages/mushroomIntroPage.js";
import { calcRoutes } from "./pages/mushroomCalcPage.js";
import { renderComparePage, renderLookalikePage, renderGlossaryPage } from "./pages/mushroomInfoPages.js";
import { renderSafetyPage } from "./pages/mushroomSafetyPage.js";
import { renderNotFoundPage } from "./pages/notFoundPage.js";

export const routes = {
  "#/overview": renderMushroomIntroPage,
  "#/mushroom-intro": renderMushroomIntroPage,
  "#/mushroom-compare": renderComparePage,
  "#/mushroom-lookalikes": renderLookalikePage,
  "#/mushroom-glossary": renderGlossaryPage,
  "#/mushroom-safety": () => renderSafetyPage("check"),
  "#/mushroom-safety-sos": () => renderSafetyPage("sos"),
  "#/mushroom-safety-check": () => renderSafetyPage("check"),
  "#/mushroom-safety-facts": () => renderSafetyPage("facts"),
  ...calcRoutes,
  "#/mushrooms": renderMushroomIdentifyPage,
  "#/mushroom-atlas": renderMushroomAtlasPage,
  "#/contact": renderContactPage,
  "#/404": renderNotFoundPage,
};
