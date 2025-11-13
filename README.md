




## Manifest.json Overview

These are the entries that appear after the `version` field in `manifest.json`, explained in plain language along with why each one is there:

1. `action.default_popup`: Tells Chrome which HTML file to show when the extension icon is clicked, so the cookie report UI opens instantly.
2. `permissions`: Grants access to cookies, the active tab, and extension `storage`, which are required to read cookie data, know which site is open, and remember local settings.
3. `host_permissions`: Allows the extension to interact with any `http` or `https` page so it can inspect cookies on whatever site the user visits.
4. `background.service_worker`: Points to the background script that keeps lightweight extension logic running and handles events even when the popup is closed.
5. `content_scripts`: Injects the listed script into every matching page so it can read `localStorage` and `sessionStorage` directly within the site context.

## Node type definitions

- `npm install @types/node --save-dev`: Adds the Node.js type declarations as a dev dependency so TypeScript knows about Node globals (e.g., `process`, `__dirname`, `fileURLToPath`) when editing build scripts or config files.
- `"types": ["vite/client", "node"]` in `tsconfig.json`: Instructs the compiler to load both the Vite client typings and the newly installed Node typings, which prevents IDE errors in files like `vite.config.ts` that rely on Node’s APIs.

*2025-02-15 – GPT-5 Codex – written by AI*
