import cookieData from "./cookies.json";
import type {
  CookieCategory,
  CookieIdentification,
  ExternalCookie,
  ExternalCookieDB,
} from "./cookietypes";
import { CookieCategories } from "./cookietypes";

// Type assertion for the imported JSON
const RAW_COOKIE_DB: ExternalCookieDB = cookieData as unknown as ExternalCookieDB;

// --- Optimization: Pre-process DB into a Map ---
export const EXACT_MATCH_MAP = new Map<
  string,
  { category: string; vendor: string; description: string; retention: string }
>();
export const PATTERN_MATCH_LIST: {
  regex: RegExp;
  category: string;
  vendor: string;
  description: string;
  retention: string;
}[] = [];

// Helper: Map OpenCookieDB Categories to Our Extension Categories
function normalizeCategory(dbCategory: string): CookieCategory {
  const cat = dbCategory.toLowerCase();

  if (
    cat === "functional" ||
    cat === "security" ||
    cat === "strictly necessary"
  ) {
    return CookieCategories.Strictly_Necessary;
  }
  if (cat === "personalization" || cat === "preferences") {
    return CookieCategories.Functional;
  }
  if (cat === "analytics" || cat === "performance" || cat === "statistics") {
    return CookieCategories.Performance;
  }
  if (cat === "marketing" || cat === "advertising" || cat === "targeting") {
    return CookieCategories.Targeting;
  }

  return CookieCategories.Functional; // Default fallback
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
    `Database loaded: ${EXACT_MATCH_MAP.size} exact matches, ${PATTERN_MATCH_LIST.length} patterns.`,
  );
})();
