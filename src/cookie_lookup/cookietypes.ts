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

export interface ExternalCookieDB {
  [vendorName: string]: ExternalCookie[];
}

export interface CookieIdentification {
  category: string;
  vendor: string;
  description: string;
  retention: string;
}

export const CookieCategories = {
  Strictly_Necessary: "Strictly Necessary",
  Functional: "Functional",
  Performance: "Performance",
  Targeting: "Targeting",
} as const;

// "give me all the values from this object as a type." The result is a union type.
export type CookieCategory = (typeof CookieCategories)[keyof typeof CookieCategories];