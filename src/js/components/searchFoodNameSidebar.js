export function renderSearchFoodName() {
  return `    
    <!-- Үг бичиж хайх -->
    <p class="menu-label app-menu-label">🔍︎ Search by food name:</p>

    <div class="field">
      <p class="control has-icons-left">
        <input class="input is-primary" type="text" placeholder="Food Name" id="searchTxt"/>
        <span class="icon is-small is-left">
          <i class="fa-solid fa-bowl-rice"></i>
        </span>
      </p>
    </div>

    <div class="field">
      <p class="control">
        <button class="button is-primary is-fullwidth" type="button" id="searchBtn">
          Search
        </button>
      </p>
    </div>   
  `;
}
