![alt text](image.png)
# 🍪 Cookie Ingredient

**Cookie Ingredient** is a free, open-source Chrome Extension that acts as a "nutritional label" for the websites you visit. Just as you check the ingredients on food packaging, this tool breaks down the digital ingredients—cookies—embedded in your browser, helping you understand who is tracking you and why.

### [Download from the Chrome Web Store](https://chromewebstore.google.com/detail/cookie-ingredient/kpnieliibkbfnknhdnnkmcanclhnklcp)

---

## 🎯 Mission & Value Proposition

The web is powered by cookies, but they are often invisible or confusing to the average user. **Cookie Ingredient** was built with a simple mission: **Transparency without complexity.**

While developer tools exist, they are often overwhelming. This project aims to bridge the gap by:
* **Simplifying Data:** Grouping thousands of complex cookie names into 4 understandable categories.
* **Visualizing Privacy:** Using interactive "flashcards" to show exactly what a site is doing in real-time.
* **Empowering Users:** Providing a "Protect" mode (Clear All) to give users control over their digital footprint.

*This project is completely free, privacy-focused, and processes all data locally on your device.*

---

## 🧩 Design Decisions: The 4 Categories

To make cookie data digestible, we standardized thousands of different cookie types into four core categories:

1.  **🟢 Strictly Necessary:** Essential for the website to function (e.g., security tokens, login sessions, shopping carts).
2.  **🔵 Functional:** Remembers your choices to improve usability (e.g., language preference, dark mode settings).
3.  **🟣 Performance:** Anonymous data that helps website owners understand traffic (e.g., analytics, load times).
4.  **🔴 Targeting:** Used to build a profile of your interests and show you ads across different websites (e.g., marketing pixels, third-party trackers).

### Why this design?
This categorization aligns with major privacy standards like **GDPR** and **CCPA**, making the data familiar to users who have seen standard consent banners. It abstracts away the technical jargon (like `_ga` or `fbp`) into concepts that matter to the user: *"Is this necessary, or is it tracking me?"*

### Drawbacks & Future Improvements
* **Current Limitation:** The "Heuristic Engine" (our guessing logic) is good but not perfect. It lumps unknown cookies into broad categories based on their lifespan or flags, which might occasionally mislabel a unique functional cookie as "Targeting."
* **Future Improvement:** We plan to introduce an "Advanced Mode" that allows power users to see the raw JSON data and override categories locally.

---

## 💻 Under the Hood: Key Code Snippets

The core intelligence of the extension lives in `src/popup/popup.ts`. Here is how it works:

### 1. The Identification Engine
We don't just rely on a static list; we use a three-step process to identify cookies.

```typescript
function identifyCookie(cookie: chrome.cookies.Cookie, currentHostname: string) {
  const cookieNameLower = cookie.name.toLowerCase();

  // 1. FAST LOOKUP: Check the Map (O(1) speed) for known cookies
  if (EXACT_MATCH_MAP.has(cookieNameLower)) {
    return EXACT_MATCH_MAP.get(cookieNameLower)!;
  }

  // 2. PATTERN MATCH: Check regex patterns for dynamic cookie names (e.g. "_ga_1234")
  const patternMatch = PATTERN_MATCH_LIST.find(def => def.regex.test(cookie.name));
  if (patternMatch) {
     return { ... };
  }

  // 3. HEURISTIC ANALYSIS (The "Speculation" Engine)
  // If we don't know the cookie, we guess based on its behavior.
  // ...
}
```

### 2. Heuristic Analysis (The "Speculation" Engine)
When a cookie isn't in our database, we analyze its properties (lifespan, security flags, and domain) to make an educated guess.

```typescript
// Example: If a cookie is HttpOnly, it's likely a secure backend session.
if (isHttpOnly) {
  return {
    category: "Strictly Necessary",
    description: "Flagged as 'HttpOnly', likely used securely by the server...",
    // ...
  };
}

// Example: If a cookie lives for > 1 year, it's likely building a long-term profile.
if (lifespan > oneYear) {
  return {
    category: "Targeting",
    description: "This cookie lasts over a year. Long lifespans are a hallmark of tracking...",
    // ...
  };
}
```

### 3. Normalizing Data
We take the diverse categories from our open-source database and map them to our simple 4-color system for the UI.

```typescript
function normalizeCategory(dbCategory: string): string {
  const cat = dbCategory.toLowerCase();
  
  if (cat === 'functional' || cat === 'security' || cat === 'strictly necessary') {
    return 'Strictly Necessary';
  }
  // ... maps other variations to Functional, Performance, or Targeting
  return 'Functional'; // Default fallback
}
```

### 4. Elephant in the room; content.ts
In the initial scope, clearing your localStorage and sessionStorage was part of the bargain. Hence, the setup in the manifest and vite.config of the aforementioned ts file. However, it has since been collecting dust at the back of the backlog. Hopefully it will be implemented soon enough!


## 🤖 Built with Gemini 3 Pro Via The Gemini Web App

This project was accelerated using **Gemini 3 Pro**, Google's new LLM. Gemini acted (still does, but did too) as a pair programmer throughout the development lifecycle, assisting with:

* **Architecture:** Structuring the Vite + TypeScript setup for a Manifest V3 extension.
* **Logic Generation:** Writing the heuristic algorithms that classify unknown cookies based on their expiration dates and flags.
* **Refactoring:** Converting the raw JSON database into efficient `Map` lookups to ensure the popup opens instantly without lag.
* **Debugging:** Identifying build configuration issues in `vite.config.ts` and `tsconfig.json`.


## 👏 Acknowledgements

A massive thank you to the **[Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)** project.

This extension utilizes their extensive JSON dataset of common cookies to provide accurate descriptions and categorizations for thousands of known trackers. Without their community effort, the "Fast Lookup" portion of this extension would not be possible.

*Cookie Data License: Apache License 2.0*

## 📝 License

Distributed under the **MIT License**. See `LICENSE` for more information.