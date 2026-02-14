///<reference types="chrome" />

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
      chrome.storage.local.set({ darkMode: true });
      sunIcon?.classList.add("hidden");
      moonIcon?.classList.remove("hidden");
    } else {
      chrome.storage.local.set({ darkMode: false });
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

// 4. Tab Switching
export function setupTabs(onTabSwitch?: (tabName: string) => void) {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const panels = document.querySelectorAll<HTMLElement>(".tab-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      if (!tabName) return;

      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      panels.forEach((panel) => {
        if (panel.id === `panel-${tabName}`) {
          panel.classList.remove("hidden");
        } else {
          panel.classList.add("hidden");
        }
      });

      onTabSwitch?.(tabName);
    });
  });
}

// 5. Confirmation Modal
export function showConfirmModal() {
  document.getElementById("confirm-modal")?.classList.remove("hidden");
}

export function hideConfirmModal() {
  document.getElementById("confirm-modal")?.classList.add("hidden");
}

// 6. Flip Cards
export function setupFlipCards() {
  document.querySelectorAll<HTMLElement>(".flip-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
    });
  });
}

// 7. Storage Section Toggles
export function setupStorageToggles() {
  document
    .querySelectorAll<HTMLElement>(".storage-section-header")
    .forEach((header) => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling as HTMLElement | null;
        if (!body) return;
        body.classList.toggle("hidden");
        header.classList.toggle("expanded");
      });
    });
}
