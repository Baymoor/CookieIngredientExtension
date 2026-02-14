/// <reference types="chrome" />
import "./popup.css";
import { CookieCategories } from "../cookie_lookup/cookietypes";
import { getElement } from "./helper";
import { identifyCookie } from "../cookie_lookup/identifyCookie";
import { setupThemeToggle, settingsPage, showIngredientList } from "./ui";

// --- UI Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements

  // Light/Dark theme
  const themeBtn = getElement<HTMLButtonElement>("btn-theme");
  const sunIcon = themeBtn.querySelector(".icon-sun");
  const moonIcon = themeBtn.querySelector(".icon-moon");

  // Settings page
  const settingsBtn = getElement<HTMLButtonElement>("btn-settings");
  const backBtn = getElement<HTMLButtonElement>("btn-back");
  const settingsView = getElement<HTMLElement>("view-opts");

  // Show Ingredient rolldown list
  const showIngredientsBtn = getElement<HTMLButtonElement>("btn-list");
  const listContainer = getElement<HTMLElement>("list-wrap");
  const cookieListContainer = getElement<HTMLElement>("list-items");
  const showIngredientsIcon = getElement<HTMLElement>("icon-list");

  const clearBtn = getElement<HTMLButtonElement>("btn-clear-all");
  const toast = getElement<HTMLElement>("toast");
  const scanningView = getElement<HTMLElement>("view-scan");
  const dashboardView = getElement<HTMLElement>("view-dash");
  const currentSiteEl = getElement<HTMLElement>("site-host");

  const totalCountEl = getElement<HTMLElement>("count-total");
  const countFunctionalEl = getElement<HTMLElement>("count-func");
  const countPerformanceEl = getElement<HTMLElement>("count-perf");
  const countTargetingEl = getElement<HTMLElement>("count-target");
  const countStrictlyNecessaryEl = getElement<HTMLElement>("count-strict");

  const protectBtn = getElement<HTMLButtonElement>("btn-lock");
  const protectIconUnlocked = getElement<HTMLElement>("icon-unlock");
  const protectIconLocked = getElement<HTMLElement>("icon-lock");

  let isProtected = false;
  let currentHostname = "";

  // 1. Theme Toggle
  const themeData = await chrome.storage.local.get("darkMode");
  if(themeData.darkMode) {
  document.body.classList.add("dark");
  sunIcon?.classList.add("hidden");
  moonIcon?.classList.remove("hidden");
  }
  setupThemeToggle(themeBtn, sunIcon, moonIcon);

  // 2. Settings Navigation
  settingsPage(settingsBtn, backBtn, settingsView);

  // 3. Ingredients Toggle
  showIngredientList(showIngredientsBtn, listContainer, showIngredientsIcon);

  // Helper: Update Protect UI
  function updateProtectUI() {
    if (isProtected) {
      protectIconUnlocked.classList.add("hidden");
      protectIconLocked.classList.remove("hidden");
      protectBtn.classList.add("locked");
      clearBtn.setAttribute("disabled", "true");
      clearBtn.title = "Site is protected";
      clearBtn.textContent = "Cookies Protected";
    } else {
      protectIconUnlocked.classList.remove("hidden");
      protectIconLocked.classList.add("hidden");
      protectBtn.classList.remove("locked");
      clearBtn.removeAttribute("disabled");
      clearBtn.title = "Remove all cookies";
      clearBtn.textContent = "Clear All Cookies";
    }
  }

  // 4. Initial Scan & Data Fetching
  scanningView.classList.remove("hidden");
  dashboardView.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (
      tab.url &&
      (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
    ) {
      const urlObj = new URL(tab.url);
      currentHostname = urlObj.hostname;
      currentSiteEl.textContent = currentHostname;

      // Check protection status
      const storage = await chrome.storage.local.get(
        `protect_${currentHostname}`,
      );
      isProtected = !!storage[`protect_${currentHostname}`];
      updateProtectUI();

      // Fetch cookies
      const cookies = await chrome.cookies.getAll({ url: tab.url });

      let counts = {
        func: 0,
        perf: 0,
        target: 0,
        strict: 0,
      };

      cookieListContainer.textContent = "";

      cookies.forEach((cookie: chrome.cookies.Cookie) => {
        // PASS CURRENT HOSTNAME HERE
        const info = identifyCookie(cookie, currentHostname);

        if (info.category === CookieCategories.Functional) counts.func++;
        else if (info.category === CookieCategories.Performance) counts.perf++;
        else if (info.category === CookieCategories.Targeting) counts.target++;
        else if (info.category === CookieCategories.Strictly_Necessary)
          counts.strict++;

        // Determine Badge Class based on category
        let badgeClass = "badge-unknown";
        if (info.category === CookieCategories.Functional)
          badgeClass = "badge-func";
        else if (info.category === CookieCategories.Performance)
          badgeClass = "badge-perf";
        else if (info.category === CookieCategories.Targeting)
          badgeClass = "badge-target";
        else if (info.category === CookieCategories.Strictly_Necessary)
          badgeClass = "badge-strict";

        // Create List Item
        const cookieItem = document.createElement("div");
        cookieItem.className = "cookie-item";
        const cookieHead = document.createElement("div");
        cookieHead.className = "cookie-head";
        const cookieSpanText = document.createElement("span");
        cookieSpanText.className = "truncate";
        const cookieSpanBadge = document.createElement("span");
        cookieSpanBadge.className = `cookie-badge ${badgeClass}`;
        const cookieDesc = document.createElement("div");
        cookieDesc.className = "cookie-desc";

        cookieSpanText.textContent = cookie.name;
        cookieSpanText.title = cookie.name;
        cookieSpanBadge.textContent = info.category;
        cookieDesc.textContent = info.description;

        cookieListContainer.appendChild(cookieItem);
        cookieItem.append(cookieHead);
        cookieItem.append(cookieDesc);
        cookieHead.append(cookieSpanText);
        cookieHead.append(cookieSpanBadge);
      });

      // Update Counts
      totalCountEl.textContent = String(cookies.length);
      countFunctionalEl.textContent = String(counts.func);
      countPerformanceEl.textContent = String(counts.perf);
      countTargetingEl.textContent = String(counts.target);
      countStrictlyNecessaryEl.textContent = String(counts.strict);

      // Show dashboard
      scanningView.classList.add("hidden");
      dashboardView.classList.remove("hidden");
    } else {
      // Restricted page handling
      scanningView.classList.add("hidden");
      currentSiteEl.textContent = "Restricted Page";
      dashboardView.classList.remove("hidden");
      const dashBoardViewDiv = document.createElement("div");
      dashBoardViewDiv.className = "cannot-scan-cookies";
      dashBoardViewDiv.textContent = "Cannot scan cookies on this page.";
      dashboardView.replaceChildren();
      dashboardView.appendChild(dashBoardViewDiv);
    }
  } catch (e) {
    console.error(e);
    scanningView.classList.add("hidden");
  }

  // 5. Clear Cookies Logic
  clearBtn.addEventListener("click", async () => {
    if (isProtected) return;

    clearBtn.textContent = "Clearing...";

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url) {
        const cookies = await chrome.cookies.getAll({ url: tab.url });
        for (const cookie of cookies) {
          await chrome.cookies.remove({ url: tab.url, name: cookie.name });
        }

        // Reset UI
        totalCountEl.textContent = "0";
        countFunctionalEl.textContent = "0";
        countPerformanceEl.textContent = "0";
        countTargetingEl.textContent = "0";
        countStrictlyNecessaryEl.textContent = "0";
        cookieListContainer.replaceChildren();

        // Show toast
        toast.classList.remove("hidden");
        setTimeout(() => {
          toast.classList.add("hidden");
        }, 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        clearBtn.textContent = "Clear All Cookies";
      }, 500);
    }
  });

  // 6. Protect Button Logic
  protectBtn.addEventListener("click", async () => {
    isProtected = !isProtected;
    if (currentHostname) {
      if (isProtected) {
        await chrome.storage.local.set({
          [`protect_${currentHostname}`]: true,
        });
      } else {
        await chrome.storage.local.remove(`protect_${currentHostname}`);
      }
    }
    updateProtectUI();
  });
});
