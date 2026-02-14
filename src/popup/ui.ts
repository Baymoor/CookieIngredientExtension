// 1. Theme Toggle
export function setupThemeToggle(
  themeBtn: HTMLButtonElement,
  sunIcon: Element | null,
  moonIcon: Element | null,
) {
  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    if (isDark) {
      sunIcon?.classList.add("hidden");
      moonIcon?.classList.remove("hidden");
    } else {
      sunIcon?.classList.remove("hidden");
      moonIcon?.classList.add("hidden");
    }
  });
}

// 2. Settings Navigation
export function settingsPage(
  settingsBtn: HTMLButtonElement,
  backBtn: HTMLButtonElement,
  settingsView: HTMLElement,
) {
  settingsBtn.addEventListener("click", () => {
    settingsView.classList.remove("hidden");
  });
  backBtn.addEventListener("click", () => {
    settingsView.classList.add("hidden");
  });
}

// 3. Ingredients Toggle
export function showIngredientList(
  showIngredientsBtn: HTMLButtonElement,
  listContainer: HTMLElement,
  showIngredientsIcon: HTMLElement,
) {
  showIngredientsBtn.addEventListener("click", () => {
    const isHidden = listContainer.classList.contains("hidden");
    if (isHidden) {
      listContainer.classList.remove("hidden");
      showIngredientsIcon.classList.add("rotate-180");
      setTimeout(
        () => listContainer.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } else {
      listContainer.classList.add("hidden");
      showIngredientsIcon.classList.remove("rotate-180");
    }
  });
}
