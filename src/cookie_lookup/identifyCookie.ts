/// <reference types="chrome" />
import { EXACT_MATCH_MAP, PATTERN_MATCH_LIST } from "./cookieDatabase";
import { CookieCategories } from "./cookietypes";
import type { CookieIdentification } from "./cookietypes";

// --- Constants ---

const ONE_DAY = 86400;
const ONE_YEAR = 31536000;

const KNOWN_AD_DOMAINS = new Set([
  "doubleclick.net",
  "criteo.com",
  "adnxs.com",
  "adsrvr.org",
  "casalemedia.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "taboola.com",
  "outbrain.com",
  "tapad.com",
  "bidswitch.net",
  "demdex.net",
  "bluekai.com",
  "quantserve.com",
  "scorecardresearch.com",
]);

const TRACKER_NAME_PREFIXES = [
  "_fbp", "_fbc", "_gcl_", "_uet", "_tt_", "_pin_",
  "IDE", "DSID", "MUID", "NID", "_scid", "_ttp",
];

const ANALYTICS_NAME_PREFIXES = [
  "_ga", "_gid", "_gat", "_pk_", "_hj", "__utm",
];

const TARGETING_NAME_RE = /pixel|\bads?\b|tracker|retarget|campaign/i;
const SECURITY_NAME_RE = /^(__Host-|__Secure-)|sess|csrf|xsrf|token|auth/i;
const PREFERENCE_NAME_RE = /pref|lang|theme|mode|locale|consent/i;

// --- Helpers ---

function calculateEntropy(value: string): number {
  if (value.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of value) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  const len = value.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isThirdParty(cookieDomain: string, currentHostname: string): boolean {
  const cleanCookie = cookieDomain.startsWith(".")
    ? cookieDomain.substring(1)
    : cookieDomain;
  const cleanHost = currentHostname.startsWith("www.")
    ? currentHostname.substring(4)
    : currentHostname;
  return (
    !cleanHost.endsWith(cleanCookie) && !cleanCookie.endsWith(cleanHost)
  );
}

function isKnownAdDomain(cookieDomain: string): boolean {
  const clean = cookieDomain.startsWith(".")
    ? cookieDomain.substring(1)
    : cookieDomain;
  for (const ad of KNOWN_AD_DOMAINS) {
    if (clean === ad || clean.endsWith("." + ad)) return true;
  }
  return false;
}

function determineVendor(
  cookie: chrome.cookies.Cookie,
  currentHostname: string,
  signals: string[],
): string {
  const cleanDomain = cookie.domain.startsWith(".")
    ? cookie.domain.substring(1)
    : cookie.domain;

  if (isKnownAdDomain(cookie.domain)) {
    return "Ad Network (" + cleanDomain + ")";
  }
  if (isThirdParty(cookie.domain, currentHostname)) {
    return "Third Party (" + cleanDomain + ")";
  }
  if (signals.length > 0) {
    return "Heuristic Match";
  }
  return "Unknown";
}

function buildDescription(signals: string[], category: string): string {
  if (signals.length === 0) {
    if (category === CookieCategories.Functional) {
      return "This cookie doesn't match known tracking patterns. It's likely remembering your preferences or site state.";
    }
    return "This cookie could not be identified from known databases.";
  }
  return "This cookie " + signals.join(", and ") + ".";
}

type CategoryKey = keyof typeof CookieCategories;

// --- Main Logic ---

export function identifyCookie(
  cookie: chrome.cookies.Cookie,
  currentHostname: string,
): CookieIdentification {
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

  // 3. SIGNAL-BASED SCORING ENGINE
  const scores: Record<CategoryKey, number> = {
    Strictly_Necessary: 0,
    Functional: 0,
    Performance: 0,
    Targeting: 0,
  };
  const signals: string[] = [];

  // Calculate lifespan
  let lifespan = 0;
  if (cookie.expirationDate) {
    lifespan = cookie.expirationDate - Date.now() / 1000;
  }

  // --- Domain signals ---
  if (isThirdParty(cookie.domain, currentHostname)) {
    scores.Targeting += 40;
    const cleanDomain = cookie.domain.startsWith(".")
      ? cookie.domain.substring(1)
      : cookie.domain;
    signals.push("comes from a different domain (" + cleanDomain + ")");
  }

  if (isKnownAdDomain(cookie.domain)) {
    scores.Targeting += 30;
    const cleanDomain = cookie.domain.startsWith(".")
      ? cookie.domain.substring(1)
      : cookie.domain;
    signals.push("comes from the ad network " + cleanDomain);
  }

  // --- SameSite signals ---
  if (cookie.sameSite === "no_restriction") {
    scores.Targeting += 25;
    signals.push("allows cross-site access (SameSite=None)");
  } else if (cookie.sameSite === "strict") {
    scores.Strictly_Necessary += 10;
  }

  // --- Security flag signals ---
  if (cookie.httpOnly && cookie.secure) {
    scores.Strictly_Necessary += 20;
    signals.push("uses server-side security flags (HttpOnly+Secure)");
  } else if (cookie.httpOnly) {
    scores.Strictly_Necessary += 10;
    signals.push("is managed by the server (HttpOnly)");
  }

  if (cookie.hostOnly) {
    scores.Strictly_Necessary += 5;
  }

  // --- Name-based signals: tracker prefixes ---
  if (TRACKER_NAME_PREFIXES.some((p) => cookieNameLower.startsWith(p.toLowerCase()))) {
    scores.Targeting += 25;
    signals.push("has a known tracker name prefix");
  }

  // --- Name-based signals: analytics prefixes ---
  if (ANALYTICS_NAME_PREFIXES.some((p) => cookieNameLower.startsWith(p.toLowerCase()))) {
    scores.Performance += 20;
    signals.push("has a known analytics name prefix");
  }

  // --- Name-based signals: keyword patterns ---
  if (TARGETING_NAME_RE.test(cookie.name)) {
    scores.Targeting += 15;
    signals.push("shows tracking signals in its name");
  }

  if (SECURITY_NAME_RE.test(cookie.name)) {
    scores.Strictly_Necessary += 15;
    signals.push("has a security-related name pattern");
  }

  if (PREFERENCE_NAME_RE.test(cookie.name)) {
    scores.Functional += 15;
    signals.push("has a preference-related name pattern");
  }

  // --- Value entropy analysis ---
  if (cookie.value) {
    const entropy = calculateEntropy(cookie.value);
    if (entropy > 3.5 && cookie.value.length > 20) {
      scores.Targeting += 10;
      signals.push("has a high-entropy value (likely a tracking ID)");
    } else if (entropy <= 3.5 && cookie.value.length <= 20) {
      scores.Functional += 5;
    }
  }

  // --- Lifespan signals ---
  if (cookie.session) {
    scores.Strictly_Necessary += 5;
  }

  if (lifespan > ONE_YEAR) {
    scores.Targeting += 10;
    signals.push("persists for over a year");
  } else if (lifespan > 0 && lifespan < ONE_DAY) {
    scores.Performance += 5;
  }

  // --- Determine winner ---
  // Tie-break priority: Targeting > Performance > Functional > Strictly Necessary
  const priority: CategoryKey[] = [
    "Targeting",
    "Performance",
    "Functional",
    "Strictly_Necessary",
  ];

  let winnerKey: CategoryKey = "Functional"; // default fallback
  let winnerScore = -1;
  for (const key of priority) {
    if (scores[key] > winnerScore) {
      winnerScore = scores[key];
      winnerKey = key;
    }
  }

  const category = CookieCategories[winnerKey];
  const vendor = determineVendor(cookie, currentHostname, signals);
  const description = buildDescription(signals, category);

  let retention: string;
  if (cookie.session) {
    retention = "Session";
  } else if (lifespan > ONE_YEAR) {
    retention = "Long-term";
  } else if (lifespan < ONE_DAY) {
    retention = "Short-term";
  } else {
    retention = "Medium-term";
  }

  return { category, vendor, description, retention };
}
