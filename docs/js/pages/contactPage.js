import { renderPageLayout } from "../layouts/pageLayout.js";
import { xt } from "../i18n/mushroomExtraText.js";
import { t } from "../i18n/i18n.js";

export function renderContactPage() {
  document.getElementById("app").innerHTML = renderPageLayout({
    id: "contact",
    title: xt("aboutTitle"),
    content: `
      <div class="box content">
        <p>${xt("aboutText")}</p>
        <ul>
          <li><i class="fas fa-university fa-fw"></i> ${t("footer.university")}</li>
          <li><i class="fas fa-envelope fa-fw"></i> <a class="custom-link" href="mailto:swe2461037@muls.edu.mn">swe2461037@muls.edu.mn</a></li>
        </ul>
      </div>`,
  });
}
