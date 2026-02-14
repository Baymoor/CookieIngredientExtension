/// <reference types="chrome" />
import "./popup.css";
import { CookieCategories } from "../cookie_lookup/cookietypes";
import { calculateRiskScore } from "../cookie_lookup/riskScore";
import { getElement } from "./helper";
import { identifyCookie } from "../cookie_lookup/identifyCookie";
import {
  setupThemeToggle,
  settingsPage,
  setupTabs,
  showConfirmModal,
  hideConfirmModal,
  setupFlipCards,
  setupStorageToggles,
} from "./ui";

// --- Gauge Rendering ---
function renderGauge(score: number, color: string, label: string) {
  const arc = document.getElementById("gauge-arc") as SVGPathElement | null;
  const scoreText = document.getElementById("gauge-score");
  const labelText = document.getElementById("gauge-label");

  if (!arc) return;

  // The arc path length for a semicircle with radius 80 is ~251.3
  const totalLength = arc.getTotalLength();
  const fillLength = totalLength * (score / 100);

  arc.style.strokeDasharray = `${totalLength}`;
  arc.style.strokeDashoffset = `${totalLength - fillLength}`;
  arc.style.stroke = color;

  if (scoreText) scoreText.textContent = String(score);
  if (labelText) labelText.textContent = label;
}

// --- Storage Rendering ---
interface StorageItem {
  key: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function renderStorageList(
  localItems: StorageItem[],
  sessionItems: StorageItem[],
) {
  const localContainer = document.getElementById("storage-local-items");
  const sessionContainer = document.getElementById("storage-session-items");
  const localCountEl = document.getElementById("local-count");
  const sessionCountEl = document.getElementById("session-count");
  const emptyMsg = document.getElementById("storage-empty-msg");
  const sections = document.querySelectorAll(".storage-section");

  if (localItems.length === 0 && sessionItems.length === 0) {
    sections.forEach((s) => (s as HTMLElement).classList.add("hidden"));
    emptyMsg?.classList.remove("hidden");
    return;
  }

  sections.forEach((s) => (s as HTMLElement).classList.remove("hidden"));
  emptyMsg?.classList.add("hidden");

  // Update counts
  if (localCountEl) localCountEl.textContent = `${localItems.length} item${localItems.length !== 1 ? "s" : ""}`;
  if (sessionCountEl) sessionCountEl.textContent = `${sessionItems.length} item${sessionItems.length !== 1 ? "s" : ""}`;

  // Render local items
  if (localContainer) {
    localContainer.textContent = "";
    for (const item of localItems) {
      localContainer.appendChild(createStorageItemEl(item, "Local"));
    }
  }

  // Render session items
  if (sessionContainer) {
    sessionContainer.textContent = "";
    for (const item of sessionItems) {
      sessionContainer.appendChild(createStorageItemEl(item, "Session"));
    }
  }
}

function createStorageItemEl(
  item: StorageItem,
  type: "Local" | "Session",
): HTMLElement {
  const el = document.createElement("div");
  el.className = "storage-item";

  const info = document.createElement("div");
  info.className = "storage-item-info";

  const keyEl = document.createElement("span");
  keyEl.className = "storage-item-key";
  keyEl.textContent = item.key;
  keyEl.title = item.key;

  const sizeEl = document.createElement("span");
  sizeEl.className = "storage-item-size";
  sizeEl.textContent = formatSize(item.size);

  info.appendChild(keyEl);
  info.appendChild(sizeEl);

  const badge = document.createElement("span");
  badge.className = `storage-badge ${type === "Local" ? "storage-badge-local" : "storage-badge-session"}`;
  badge.textContent = type;

  el.appendChild(info);
  el.appendChild(badge);
  return el;
}

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

  // Cookie list container
  const cookieListContainer = getElement<HTMLElement>("list-items");

  const clearBtn = getElement<HTMLButtonElement>("btn-clear-all");
  const toast = getElement<HTMLElement>("toast");
  const scanningView = getElement<HTMLElement>("view-scan");
  const dashboardView = getElement<HTMLElement>("view-dash");
  const currentSiteEl = getElement<HTMLElement>("site-host");

  const countFunctionalEl = getElement<HTMLElement>("count-func");
  const countPerformanceEl = getElement<HTMLElement>("count-perf");
  const countTargetingEl = getElement<HTMLElement>("count-target");
  const countStrictlyNecessaryEl = getElement<HTMLElement>("count-strict");

  const gaugeTotalEl = getElement<HTMLElement>("gauge-total");

  const protectBtn = getElement<HTMLButtonElement>("btn-lock");
  const protectIconUnlocked = getElement<HTMLElement>("icon-unlock");
  const protectIconLocked = getElement<HTMLElement>("icon-lock");

  // Storage elements
  const clearStorageBtn = getElement<HTMLButtonElement>("btn-clear-storage");
  const modalCancelBtn = getElement<HTMLButtonElement>("modal-cancel");
  const modalConfirmBtn = getElement<HTMLButtonElement>("modal-confirm");
  const modalDomainEl = getElement<HTMLElement>("modal-domain");

  let isProtected = false;
  let currentHostname = "";
  let currentTabId: number | undefined;
  let storageLoaded = false;

  // 1. Theme Toggle
  const themeData = await chrome.storage.local.get("darkMode");
  if (themeData.darkMode) {
    document.body.classList.add("dark");
    sunIcon?.classList.add("hidden");
    moonIcon?.classList.remove("hidden");
  }
  setupThemeToggle(themeBtn, sunIcon, moonIcon);

  // 2. Settings Navigation
  settingsPage(settingsBtn, backBtn, settingsView);

  // 3. Flip Cards & Storage Toggles
  setupFlipCards();
  setupStorageToggles();

  // 4. Tab Switching
  setupTabs((tabName) => {
    if (tabName === "storage" && !storageLoaded && currentTabId) {
      loadStorageData();
    }
  });

  // Helper: load storage data from content script
  function loadStorageData() {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(
      currentTabId,
      { type: "GET_STORAGE_INFO" },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          renderStorageList([], []);
          return;
        }
        renderStorageList(
          response.localStorage ?? [],
          response.sessionStorage ?? [],
        );
        storageLoaded = true;
      },
    );
  }

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

  // 5. Initial Scan & Data Fetching
  scanningView.classList.remove("hidden");
  dashboardView.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    currentTabId = tab?.id;

    if (
      tab.url &&
      (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
    ) {
      const urlObj = new URL(tab.url);
      currentHostname = urlObj.hostname;
      currentSiteEl.textContent = currentHostname;
      modalDomainEl.textContent = currentHostname;

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
        cookieItem.dataset.category = info.category;
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
      countFunctionalEl.textContent = String(counts.func);
      countPerformanceEl.textContent = String(counts.perf);
      countTargetingEl.textContent = String(counts.target);
      countStrictlyNecessaryEl.textContent = String(counts.strict);

      // Risk Score & Gauge
      const risk = calculateRiskScore(counts);
      renderGauge(risk.score, risk.color, risk.label);
      gaugeTotalEl.textContent = `${cookies.length} cookie${cookies.length !== 1 ? "s" : ""}`;

      // Filter btns
      const allFilterBtns = document.querySelectorAll(".filter-btn");
      allFilterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const filter = (btn as HTMLElement).dataset.filter;

          // Update active state
          allFilterBtns.forEach((b) => b.classList.remove("filter-active"));
          btn.classList.add("filter-active");

          const items = cookieListContainer.querySelectorAll(".cookie-item");
          items.forEach((item) => {
            const itemCategory = (item as HTMLElement).dataset.category;
            if (filter === "all" || itemCategory === filter) {
              (item as HTMLElement).classList.remove("hidden");
            } else {
              (item as HTMLElement).classList.add("hidden");
            }
          });
        });
      });

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

  // 6. Clear Cookies Logic
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
        countFunctionalEl.textContent = "0";
        countPerformanceEl.textContent = "0";
        countTargetingEl.textContent = "0";
        countStrictlyNecessaryEl.textContent = "0";
        cookieListContainer.replaceChildren();

        // Reset gauge
        const zeroCounts = { func: 0, perf: 0, target: 0, strict: 0 };
        const risk = calculateRiskScore(zeroCounts);
        renderGauge(risk.score, risk.color, risk.label);
        gaugeTotalEl.textContent = "0 cookies";

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

  // 7. Protect Button Logic
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

  // 8. Clear Storage Modal Logic
  clearStorageBtn.addEventListener("click", () => {
    showConfirmModal();
  });

  modalCancelBtn.addEventListener("click", () => {
    hideConfirmModal();
  });

  modalConfirmBtn.addEventListener("click", () => {
    if (!currentTabId) return;
    hideConfirmModal();
    clearStorageBtn.textContent = "Clearing...";

    chrome.tabs.sendMessage(
      currentTabId,
      { type: "CLEAR_STORAGE", target: "all" },
      (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          clearStorageBtn.textContent = "Clear All Storage";
          return;
        }

        // Refresh storage list
        storageLoaded = false;
        loadStorageData();

        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 2000);

        setTimeout(() => {
          clearStorageBtn.textContent = "Clear All Storage";
        }, 500);
      },
    );
  });
});
