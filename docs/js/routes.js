import { renderOverviewPage } from "./pages/overviewPage.js";
import { renderSearchPage } from "./pages/searchPage.js";
import { renderCalculationPage } from "./pages/calculationPage.js";
import { renderBooksPage } from "./pages/booksPage.js";
import { renderContactPage } from "./pages/contactPage.js";
import { renderMushroomIdentifyPage } from "./pages/mushroomIdentifyPage.js";
import { renderMushroomAtlasPage } from "./pages/mushroomAtlasPage.js";
import { renderNotFoundPage } from "./pages/notFoundPage.js";

export const routes = {
  "#/overview": renderOverviewPage,
  "#/search": renderSearchPage,
  "#/calculation": renderCalculationPage,
  "#/books": renderBooksPage,
  "#/mushrooms": renderMushroomIdentifyPage,
  "#/mushroom-atlas": renderMushroomAtlasPage,
  "#/contact": renderContactPage,
  "#/404": renderNotFoundPage,
};
