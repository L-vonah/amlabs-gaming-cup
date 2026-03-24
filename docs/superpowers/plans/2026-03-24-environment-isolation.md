# Environment Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate production and development Firebase projects so that Netlify preview deployments and localhost never touch production Firestore data.

**Architecture:** A new `env.js` file (loaded first) detects the hostname and exposes `APP_ENV` and `IS_PROD`. `firebase-config.js` uses `IS_PROD` to pick between two Firebase project configs. `localStorage` keys get a `dev_` prefix outside of production. A visible banner appears in dev/staging.

**Tech Stack:** Vanilla JS, Firebase compat SDK (CDN), Netlify, no build step.

**Spec:** `docs/superpowers/specs/2026-03-24-environment-isolation-design.md` (Sections 1–4)

**Prerequisite:** Firebase dev project `amlabs-gaming-cup-dev` must already exist with Auth (Google) enabled, `netlify.app` authorized as a domain, and Firestore created. (Already done — config values are in the spec.)

---

## File Map

| File | Change |
|------|--------|
| `js/env.js` | **Create** — APP_ENV, IS_PROD, STORAGE_PREFIX |
| `index.html` | **Modify** — add `env.js` as first `<script>` tag |
| `js/firebase-config.js` | **Modify** — dual config object, select by IS_PROD |
| `js/state.js` | **Modify** — STATE_KEY and AUDIT_LOG_KEY use STORAGE_PREFIX |
| `js/firestore-service.js` | **Modify** — INSCRICOES_LOCAL_KEY uses STORAGE_PREFIX; hardcoded key in startListener updated |
| `js/app.js` | **Modify** — inject dev banner on DOMContentLoaded |
| `css/style.css` | **Modify** — add `.dev-banner` styles |

---

### Task 1: Create `js/env.js`

**Files:**
- Create: `js/env.js`

- [ ] **Step 1: Create the file**

```javascript
/**
 * Environment Detection — AMLabs Gaming Cup
 * Must be the first script loaded. Exposes APP_ENV, IS_PROD, STORAGE_PREFIX.
 */

const APP_ENV = (() => {
  const host = window.location.hostname;
  if (host === 'amlabs-cup.netlify.app' || host === 'l-vonah.github.io') {
    return 'production';
  }
  return 'development'; // localhost, *.netlify.app previews, file://
})();

const IS_PROD = APP_ENV === 'production';

// Prefix for localStorage keys. Prevents dev data from colliding with prod
// when the same browser has both environments open simultaneously.
const STORAGE_PREFIX = IS_PROD ? '' : 'dev_';
```

---

### Task 2: Add `env.js` as first script in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Find the Firebase SDK script block**

In `index.html`, locate the `<script>` tags near the bottom of `<body>`. They start with the Firebase CDN scripts.

- [ ] **Step 2: Insert `env.js` before everything else**

Add `<script src="js/env.js"></script>` as the first script tag, before any Firebase SDK tag:

```html
<!-- Environment detection — must be first -->
<script src="js/env.js"></script>

<!-- Firebase SDK (existing tags follow unchanged) -->
<script src="https://www.gstatic.com/firebasejs/...
```

- [ ] **Step 3: Verify load order**

Open browser DevTools → Network tab → reload page. Confirm `env.js` appears first in the JS waterfall before `firebase-config.js`.

Open Console. Run `APP_ENV`. Expected: `'development'` (locally).

---

### Task 3: Update `js/firebase-config.js` with dual config

**Files:**
- Modify: `js/firebase-config.js`

- [ ] **Step 1: Replace the file content**

```javascript
/**
 * Firebase Configuration — AMLabs Gaming Cup
 * Selects production or development project based on APP_ENV (set by env.js).
 */

const FIREBASE_CONFIGS = {
  production: {
    apiKey: "AIzaSyDvTVmgRVS_0u3-ThhXdUJRe4gkN9Ys3-o",
    authDomain: "amlabs-gaming-cup-df736.firebaseapp.com",
    projectId: "amlabs-gaming-cup-df736",
    storageBucket: "amlabs-gaming-cup-df736.firebasestorage.app",
    messagingSenderId: "554464614822",
    appId: "1:554464614822:web:07647c72d6cb33be04d767"
  },
  development: {
    apiKey: "AIzaSyA7lxhScgr1IcGhhZNCcW3bGAvszs40D-c",
    authDomain: "amlabs-gaming-cup-dev.firebaseapp.com",
    projectId: "amlabs-gaming-cup-dev",
    storageBucket: "amlabs-gaming-cup-dev.firebasestorage.app",
    messagingSenderId: "5643738291",
    appId: "1:5643738291:web:a88ef530cb8e588acca4c6"
  }
};

const firebaseConfig = IS_PROD
  ? FIREBASE_CONFIGS.production
  : FIREBASE_CONFIGS.development;

// Detect if Firebase is configured (not placeholder)
const FIREBASE_CONFIGURED = true;

if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} else {
  console.info('[AMLabs Gaming Cup] Firebase not configured. Running in localStorage mode.');
}
```

- [ ] **Step 2: Verify correct project in console**

Open locally. In console run:
```javascript
firebase.app().options.projectId
```
Expected: `'amlabs-gaming-cup-dev'`

Open Netlify production URL. Same command.
Expected: `'amlabs-gaming-cup-df736'`

---

### Task 4: Update localStorage keys in `js/state.js`

**Files:**
- Modify: `js/state.js` (lines 6–7)

- [ ] **Step 1: Replace the two key constants**

Replace:
```javascript
const STATE_KEY = 'campeonato_amlabs_v1';
const AUDIT_LOG_KEY = 'campeonato_amlabs_audit_v1';
```

With:
```javascript
const STATE_KEY = STORAGE_PREFIX + 'campeonato_amlabs_v1';
const AUDIT_LOG_KEY = STORAGE_PREFIX + 'campeonato_amlabs_audit_v1';
```

- [ ] **Step 2: Verify key isolation**

Open locally. In console run:
```javascript
AppState.save(AppState.load()); // triggers a save
Object.keys(localStorage).filter(k => k.includes('campeonato'))
```
Expected: `['dev_campeonato_amlabs_v1']` (with `dev_` prefix, not `campeonato_amlabs_v1`).

---

### Task 5: Update localStorage keys in `js/firestore-service.js`

**Files:**
- Modify: `js/firestore-service.js` (lines 11, 40)

- [ ] **Step 1: Update the INSCRICOES_LOCAL_KEY constant**

Replace line 11:
```javascript
const INSCRICOES_LOCAL_KEY = 'campeonato_amlabs_inscricoes_v1';
```
With:
```javascript
const INSCRICOES_LOCAL_KEY = STORAGE_PREFIX + 'campeonato_amlabs_inscricoes_v1';
```

- [ ] **Step 2: Update the hardcoded key in `startListener`**

In `startListener`, find the line (around line 40):
```javascript
localStorage.setItem('campeonato_amlabs_v1', JSON.stringify(legacyState));
```
Replace with:
```javascript
localStorage.setItem(STATE_KEY, JSON.stringify(legacyState));
```

> Note: `STATE_KEY` is defined in `state.js`, loaded before `firestore-service.js`. This reference is valid.

- [ ] **Step 3: Verify**

In console (locally):
```javascript
Object.keys(localStorage).filter(k => k.includes('campeonato'))
```
Expected: all keys start with `dev_`.

---

### Task 6: Add dev banner in `js/app.js` and `css/style.css`

**Files:**
- Modify: `js/app.js`
- Modify: `css/style.css`

- [ ] **Step 1: Add CSS for the banner**

Add at the end of `css/style.css`:
```css
/* ---------------------------------------------------------------
   Dev Environment Banner
   --------------------------------------------------------------- */
.dev-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: #f59e0b;
  color: #1a1a1a;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 6px 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

body.has-dev-banner {
  padding-top: 32px;
}
```

- [ ] **Step 2: Inject banner in `app.js` DOMContentLoaded**

Inside the `DOMContentLoaded` handler in `app.js`, add at the very beginning, before `initAuth()`:

```javascript
// Dev banner — only shown outside production
if (!IS_PROD) {
  const banner = document.createElement('div');
  banner.className = 'dev-banner';
  banner.textContent = '⚠ AMBIENTE DE DESENVOLVIMENTO — Dados aqui são apenas para testes!';
  document.body.prepend(banner);
  document.body.classList.add('has-dev-banner');
}
```

- [ ] **Step 3: Verify banner**

Open locally. Expected: amber banner at top of page: "⚠ AMBIENTE DE DESENVOLVIMENTO — Dados aqui são apenas para testes!"

Open production URL (`amlabs-cup.netlify.app`). Expected: no banner.

---

### Task 7: Commit and push

- [ ] **Step 1: Stage and commit**

```bash
git add js/env.js js/firebase-config.js js/state.js js/firestore-service.js js/app.js css/style.css index.html
git commit -m "feat: environment isolation — dual Firebase config, localStorage prefix, dev banner"
```

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Verify production deploy**

Wait for Netlify deploy (~1 minute). Open `https://amlabs-cup.netlify.app`.
- No dev banner visible
- Console: `firebase.app().options.projectId` → `'amlabs-gaming-cup-df736'`

- [ ] **Step 4: Verify staging**

Create a PR or use a preview branch push. Open the Netlify preview URL.
- Dev banner visible
- Console: `firebase.app().options.projectId` → `'amlabs-gaming-cup-dev'`
