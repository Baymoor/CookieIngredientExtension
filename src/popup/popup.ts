/// <reference types="chrome" />
import "./popup.css";
import cookieData from "../cookie_lookup/cookies.json";

// --- Interfaces for the Open Cookie Database ---
interface ExternalCookie {
  id: string;
  category: string;
  cookie: string; // This matches cookie.name
  domain: string;
  description: string;
  retentionPeriod: string;
  dataController: string;
  privacyLink: string;
  wildcardMatch: string; // "0" for exact, "1" for pattern
}

interface ExternalCookieDB {
  [vendorName: string]: ExternalCookie[];
}

// Type assertion for the imported JSON
const RAW_COOKIE_DB: ExternalCookieDB =
  cookieData as unknown as ExternalCookieDB;

// --- Optimization: Pre-process DB into a Map ---
const EXACT_MATCH_MAP = new Map<
  string,
  { category: string; vendor: string; description: string; retention: string }
>();
const PATTERN_MATCH_LIST: {
  regex: RegExp;
  category: string;
  vendor: string;
  description: string;
  retention: string;
}[] = [];

// Helper: Map OpenCookieDB Categories to Our Extension Categories
function normalizeCategory(dbCategory: string): string {
  const cat = dbCategory.toLowerCase();

  if (
    cat === "functional" ||
    cat === "security" ||
    cat === "strictly necessary"
  ) {
    return "Strictly Necessary";
  }
  if (cat === "personalization" || cat === "preferences") {
    return "Functional";
  }
  if (cat === "analytics" || cat === "performance" || cat === "statistics") {
    return "Performance";
  }
  if (cat === "marketing" || cat === "advertising" || cat === "targeting") {
    return "Targeting";
  }

  return "Functional"; // Default fallback
}

// Initialize Lookup Tables (Runs once on load)
(function initializeCookieDatabase() {
  for (const [vendor, cookies] of Object.entries(RAW_COOKIE_DB)) {
    for (const cookieDef of cookies) {
      // Create our normalized entry
      const entry = {
        category: normalizeCategory(cookieDef.category),
        vendor: vendor || cookieDef.dataController || "Unknown",
        description: cookieDef.description,
        retention: cookieDef.retentionPeriod,
      };

      // Handle Pattern vs Exact matches
      if (cookieDef.wildcardMatch === "1") {
        try {
          // Convert wildcard string to Regex (assuming simple string or regex format)
          PATTERN_MATCH_LIST.push({
            ...entry,
            regex: new RegExp(cookieDef.cookie, "i"),
          });
        } catch (e) {
          console.warn("Invalid Regex in DB:", cookieDef.cookie);
        }
      } else {
        // Store exact matches in a Map for O(1) lookup (using lowercase key)
        EXACT_MATCH_MAP.set(cookieDef.cookie.toLowerCase(), entry);
      }
    }
  }
  console.log(
    `Database loaded: ${EXACT_MATCH_MAP.size} exact matches, ${PATTERN_MATCH_LIST.length} patterns.`
  );
})();

// --- Logic ---

function identifyCookie(
  cookie: chrome.cookies.Cookie,
  currentHostname: string
): {
  category: string;
  vendor: string;
  description: string;
  retention: string;
} {
  const cookieNameLower = cookie.name.toLowerCase();

  // 1. FAST LOOKUP: Check the Map (O(1) speed)
  if (EXACT_MATCH_MAP.has(cookieNameLower)) {
    return EXACT_MATCH_MAP.get(cookieNameLower)!;
  }

  // 2. PATTERN MATCH: Check the wildcard list
  const patternMatch = PATTERN_MATCH_LIST.find((def) =>
    def.regex.test(cookie.name)
  );
  if (patternMatch) {
    return {
      category: patternMatch.category,
      vendor: patternMatch.vendor,
      description: patternMatch.description,
      retention: patternMatch.retention,
    };
  }

  // 3. HEURISTIC ANALYSIS (The "Speculation" Engine)

  const isSession = cookie.session;
  const isHttpOnly = cookie.httpOnly;

  // Calculate lifespan (in seconds)
  let lifespan = 0;
  if (cookie.expirationDate) {
    lifespan = cookie.expirationDate - Date.now() / 1000;
  }

  const oneDay = 86400;
  const oneYear = 31536000;

  // --- LEVEL 1: Security Flags (Strongest Signals) ---
  if (isHttpOnly) {
    return {
      category: "Strictly Necessary",
      vendor: "Unknown (Backend)",
      description: "This cookie is flagged as 'HttpOnly', meaning it's used securely by the server (likely for login or security) and can't be touched by trackers.", 
      retention: isSession ? "Session" : "Persistent",
    };
  }

  // --- LEVEL 2: Contextual Analysis (Third-Party Check) ---
  const cleanCookieDomain = cookie.domain.startsWith(".") ? cookie.domain.substring(1) : cookie.domain;
  const cleanCurrentHost = currentHostname.startsWith("www.") ? currentHostname.substring(4) : currentHostname;

  // Simple check: Is the cookie domain completely different from the current site?
  if (
    !cleanCurrentHost.includes(cleanCookieDomain) &&
    !cleanCookieDomain.includes(cleanCurrentHost)
  ) {
    return {
      category: "Targeting",
      vendor: "Third Party (" + cleanCookieDomain + ")",
      description: `This cookie comes from a different domain (${cleanCookieDomain}). Third-party cookies are typically used to track you across different websites.`,
      retention: lifespan > oneYear ? "Long-term" : "Medium-term",
    };
  }

  // --- LEVEL 3: Common Naming Patterns (Fallback) ---
  if (
    cookieNameLower.includes("sess") ||
    cookieNameLower.includes("csrf") ||
    cookieNameLower.includes("xsrf") ||
    cookieNameLower.includes("token") ||
    cookieNameLower.includes("auth")
  ) {
    return {
      category: "Strictly Necessary",
      vendor: "Heuristic Match",
      description:
        "The name suggests this is a security token or session ID, essential for keeping you logged in.",
      retention: isSession ? "Session" : "Persistent",
    };
  }

  if (
    cookieNameLower.startsWith("_g") ||
    cookieNameLower.includes("pixel") ||
    cookieNameLower.includes("ads") ||
    cookieNameLower.includes("tracker")
  ) {
    return {
      category: "Performance",
      vendor: "Heuristic Match",
      description:
        "The name contains common tracking terms. It is likely measuring your interactions with the page.",
      retention: "Variable",
    };
  }

  if (
    cookieNameLower.includes("pref") ||
    cookieNameLower.includes("lang") ||
    cookieNameLower.includes("theme") ||
    cookieNameLower.includes("mode")
  ) {
    return {
      category: "Functional",
      vendor: "Heuristic Match",
      description:
        "The name implies it's remembering a choice you made, like language or dark mode.",
      retention: "Persistent",
    };
  }

  // --- LEVEL 4: Time-Based Fallback ---
  if (isSession) {
    return {
      category: "Strictly Necessary",
      vendor: "Unknown",
      description:
        "This is a temporary session cookie. It usually holds your 'state' while you browse and is deleted when you close the browser.",
      retention: "Session",
    };
  }

  if (lifespan < oneDay) {
    return {
      category: "Performance",
      vendor: "Unknown",
      description:
        "This cookie expires very quickly (under 24h). Short-lived cookies are often used for brief analytics or checking if your browser supports cookies.",
      retention: "Short-term",
    };
  }

  if (lifespan > oneYear) {
    return {
      category: "Targeting",
      vendor: "Unknown",
      description:
        "This cookie lasts over a year. Long lifespans are a hallmark of tracking cookies building a long-term profile of you.",
      retention: "Long-term",
    };
  }

  return {
    category: "Functional",
    vendor: "Unknown",
    description:
      "This persistent cookie doesn't match known tracking patterns. It's likely remembering your preferences or site state.",
    retention: "Medium-term",
  };
}

// --- UI Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const themeBtn = document.getElementById("btn-theme");
  const sunIcon = themeBtn?.querySelector(".icon-sun");
  const moonIcon = themeBtn?.querySelector(".icon-moon");

  const settingsBtn = document.getElementById("btn-settings");
  const backBtn = document.getElementById("btn-back");
  const settingsView = document.getElementById("view-opts");

  const clearBtn = document.getElementById("btn-clear-all");
  const toast = document.getElementById("toast");
  const scanningView = document.getElementById("view-scan");
  const dashboardView = document.getElementById("view-dash");
  const currentSiteEl = document.getElementById("site-host");

  const totalCountEl = document.getElementById("count-total");
  const countFunctionalEl = document.getElementById("count-func");
  const countPerformanceEl = document.getElementById("count-perf");
  const countTargetingEl = document.getElementById("count-target");
  const countStrictlyNecessaryEl = document.getElementById("count-strict");

  const showIngredientsBtn = document.getElementById("btn-list");
  const listContainer = document.getElementById("list-wrap");
  const cookieListContainer = document.getElementById("list-items");
  const showIngredientsIcon = document.getElementById("icon-list");

  const protectBtn = document.getElementById("btn-lock");
  const protectIconUnlocked = document.getElementById("icon-unlock");
  const protectIconLocked = document.getElementById("icon-lock");

  // Flash Card Elements
  const cards = document.querySelectorAll(".flip-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
    });
  });

  let isProtected = false;
  let currentHostname = "";

  // 1. Theme Toggle
  themeBtn?.addEventListener("click", () => {
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

  // 2. Settings Navigation
  settingsBtn?.addEventListener("click", () => {
    settingsView?.classList.remove("hidden");
  });
  backBtn?.addEventListener("click", () => {
    settingsView?.classList.add("hidden");
  });

  // 3. Ingredients Toggle
  showIngredientsBtn?.addEventListener("click", () => {
    const isHidden = listContainer?.classList.contains("hidden");
    if (isHidden) {
      listContainer?.classList.remove("hidden");
      showIngredientsIcon?.classList.add("rotate-180");
      setTimeout(
        () => listContainer?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    } else {
      listContainer?.classList.add("hidden");
      showIngredientsIcon?.classList.remove("rotate-180");
    }
  });

  // Helper: Update Protect UI
  function updateProtectUI() {
    if (isProtected) {
      protectIconUnlocked?.classList.add("hidden");
      protectIconLocked?.classList.remove("hidden");
      protectBtn?.classList.add("locked");
      if (clearBtn) {
        clearBtn.setAttribute("disabled", "true");
        clearBtn.title = "Site is protected";
        clearBtn.textContent = "Cookies Protected";
      }
    } else {
      protectIconUnlocked?.classList.remove("hidden");
      protectIconLocked?.classList.add("hidden");
      protectBtn?.classList.remove("locked");
      if (clearBtn) {
        clearBtn.removeAttribute("disabled");
        clearBtn.title = "Remove all cookies";
        clearBtn.textContent = "Clear All Cookies";
      }
    }
  }

  // 4. Initial Scan & Data Fetching
  if (scanningView && dashboardView) {
    scanningView.classList.remove("hidden");
    dashboardView.classList.add("hidden");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        tab?.url &&
        (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
      ) {
        const urlObj = new URL(tab.url);
        currentHostname = urlObj.hostname;
        if (currentSiteEl) currentSiteEl.textContent = currentHostname;

        // Check protection status
        const storage = await chrome.storage.local.get(
          `protect_${currentHostname}`
        );
        isProtected = !!storage[`protect_${currentHostname}`];
        updateProtectUI();

        // Fetch cookies
        const cookies = await chrome.cookies.getAll({ url: tab.url });

        let counts = { func: 0, perf: 0, target: 0, strict: 0 };

        if (cookieListContainer) cookieListContainer.innerHTML = "";

        cookies.forEach((cookie: chrome.cookies.Cookie) => {
          // PASS CURRENT HOSTNAME HERE
          const info = identifyCookie(cookie, currentHostname);

          if (info.category === "Functional") counts.func++;
          else if (info.category === "Performance") counts.perf++;
          else if (info.category === "Targeting") counts.target++;
          else if (info.category === "Strictly Necessary") counts.strict++;

          // Determine Badge Class based on category
          let badgeClass = "badge-unknown";
          if (info.category === "Functional") badgeClass = "badge-func";
          else if (info.category === "Performance") badgeClass = "badge-perf";
          else if (info.category === "Targeting") badgeClass = "badge-target";
          else if (info.category === "Strictly Necessary")
            badgeClass = "badge-strict";

          // Create List Item
          if (cookieListContainer) {
            const item = document.createElement("div");
            item.className = "cookie-item";

            item.innerHTML = `
                <div class="cookie-head">
                    <span class="truncate" style="max-width: 60%;" title="${cookie.name}">${cookie.name}</span>
                    <span class="cookie-badge ${badgeClass}">${info.category}</span>
                </div>
                <div class="cookie-desc">${info.description}</div>
            `;
            cookieListContainer.appendChild(item);
          }
        });

        // Update Counts
        if (totalCountEl) totalCountEl.textContent = String(cookies.length);
        if (countFunctionalEl)
          countFunctionalEl.textContent = String(counts.func);
        if (countPerformanceEl)
          countPerformanceEl.textContent = String(counts.perf);
        if (countTargetingEl)
          countTargetingEl.textContent = String(counts.target);
        if (countStrictlyNecessaryEl)
          countStrictlyNecessaryEl.textContent = String(counts.strict);

        // Show dashboard
        scanningView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
      } else {
        // Restricted page handling
        scanningView.classList.add("hidden");
        if (currentSiteEl) currentSiteEl.textContent = "Restricted Page";
        if (dashboardView) {
          dashboardView.classList.remove("hidden");
          dashboardView.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Cannot scan cookies on this page.</div>`;
        }
      }
    } catch (e) {
      console.error(e);
      scanningView.classList.add("hidden");
    }
  }

  // 5. Clear Cookies Logic
  clearBtn?.addEventListener("click", async () => {
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
        if (totalCountEl) totalCountEl.textContent = "0";
        if (countFunctionalEl) countFunctionalEl.textContent = "0";
        if (countPerformanceEl) countPerformanceEl.textContent = "0";
        if (countTargetingEl) countTargetingEl.textContent = "0";
        if (countStrictlyNecessaryEl)
          countStrictlyNecessaryEl.textContent = "0";
        if (cookieListContainer) cookieListContainer.innerHTML = "";

        // Show toast
        if (toast) {
          toast.classList.remove("hidden");
          setTimeout(() => {
            toast.classList.add("hidden");
          }, 2000);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        if (clearBtn) clearBtn.textContent = "Clear All Cookies";
      }, 500);
    }
  });

  // 6. Protect Button Logic
  protectBtn?.addEventListener("click", async () => {
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
