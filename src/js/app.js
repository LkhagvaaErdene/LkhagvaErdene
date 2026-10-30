import { mountNavbar } from "./components/navbar.js";
import { mountFooter } from "./components/footer.js";
import { initRouter } from "./router.js";
import { routes } from "./routes.js";
import { initTheme } from "./i18n/theme.js";

initTheme();

const navbarRoot = document.getElementById("navbar");
mountNavbar(navbarRoot);

const footerRoot = document.getElementById("footer");
mountFooter(footerRoot);

initRouter(routes);
