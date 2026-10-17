import { escapeHtml } from "../fn/format.js";

function renderFoodGroup(group) {
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
                  <input type="checkbox" name="foodcode" value="${escapeHtml(item.food_code)}">
                  <span>${escapeHtml(item.food_name)}</span>
                </label>
              </li>
            `,
          )
          .join("")}
      </ul>
    </li>
  `;
}

export function renderFoodGroupList(foodGroups = []) {
  return `
    <p class="menu-label app-menu-label">🔍︎ Search by food groups:</p>

    <ul class="menu-list">
      ${foodGroups.map(renderFoodGroup).join("")}
    </ul>
  `;
}
