import { escapeHtml } from "../fn/format.js";

export const nutritionGroups = [
  {
    groupName: "Nutritions",
    items: [
      { value: "proximates", label: "Proximates", checked: true },
      { value: "minerals", label: "Minerals", checked: true },
      { value: "vitamins", label: "Vitamins", checked: true },
    ],
  },
  {
    groupName: "Sample informations",
    items: [
      { value: "collection_information", label: "Collection information", checked: false },
      { value: "edible_inedible_part", label: "Edible inedible part", checked: false },
      { value: "pretreatment_conditions", label: "Pretreatment conditions", checked: false },
      { value: "description", label: "Description", checked: false },
      { value: "images", label: "Images", checked: false },
    ],
  },
];

function renderNutritionGroup(group) {
  return `
    <li>
      <a class="app-toggle-sublist" href="#" role="button">
        <span>${escapeHtml(group.groupName)}</span>
      </a>

      <ul class="app-sublist is-hidden">
        ${group.items
          .map(
            (item) => `
              <li>
                <label class="app-sublist-item">
                  <input type="checkbox" name="nutrition" value="${escapeHtml(item.value)}" ${item.checked ? "checked" : ""}>
                  <span>${escapeHtml(item.label)}</span>
                </label>
              </li>
            `,
          )
          .join("")}
      </ul>
    </li>
  `;
}

export function renderSearchSettings() {
  return `
    <p class="menu-label app-menu-label">🛠 Search settings:</p>

    <ul class="menu-list">
      ${nutritionGroups.map(renderNutritionGroup).join("")}
    </ul>
  `;
}
