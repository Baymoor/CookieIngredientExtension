/// <reference types="chrome" />
import { EXACT_MATCH_MAP, PATTERN_MATCH_LIST } from "./cookieDatabase";
import { CookieCategories } from "./cookietypes";

// --- Logic ---

export function identifyCookie(
  cookie: chrome.cookies.Cookie,
  currentHostname: string,
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
    def.regex.test(cookie.name),
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
      category: CookieCategories.Strictly_Necessary,
      vendor: "Unknown (Backend)",
      description:
        "This cookie is flagged as 'HttpOnly', meaning it's used securely by the server (likely for login or security) and can't be touched by trackers.",
      retention: isSession ? "Session" : "Persistent",
    };
  }

  // --- LEVEL 2: Contextual Analysis (Third-Party Check) ---
  const cleanCookieDomain = cookie.domain.startsWith(".")
    ? cookie.domain.substring(1)
    : cookie.domain;
  const cleanCurrentHost = currentHostname.startsWith("www.")
    ? currentHostname.substring(4)
    : currentHostname;

  // Simple check: Is the cookie domain completely different from the current site?
  if (
    !cleanCurrentHost.includes(cleanCookieDomain) &&
    !cleanCookieDomain.includes(cleanCurrentHost)
  ) {
    return {
      category: CookieCategories.Targeting,
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
      category: CookieCategories.Strictly_Necessary,
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
      category: CookieCategories.Performance,
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
      category: CookieCategories.Functional,
      vendor: "Heuristic Match",
      description:
        "The name implies it's remembering a choice you made, like language or dark mode.",
      retention: "Persistent",
    };
  }

  // --- LEVEL 4: Time-Based Fallback ---
  if (isSession) {
    return {
      category: CookieCategories.Strictly_Necessary,
      vendor: "Unknown",
      description:
        "This is a temporary session cookie. It usually holds your 'state' while you browse and is deleted when you close the browser.",
      retention: "Session",
    };
  }

  if (lifespan < oneDay) {
    return {
      category: CookieCategories.Performance,
      vendor: "Unknown",
      description:
        "This cookie expires very quickly (under 24h). Short-lived cookies are often used for brief analytics or checking if your browser supports cookies.",
      retention: "Short-term",
    };
  }

  if (lifespan > oneYear) {
    return {
      category: CookieCategories.Targeting,
      vendor: "Unknown",
      description:
        "This cookie lasts over a year. Long lifespans are a hallmark of tracking cookies building a long-term profile of you.",
      retention: "Long-term",
    };
  }

  return {
    category: CookieCategories.Functional,
    vendor: "Unknown",
    description:
      "This persistent cookie doesn't match known tracking patterns. It's likely remembering your preferences or site state.",
    retention: "Medium-term",
  };
}
