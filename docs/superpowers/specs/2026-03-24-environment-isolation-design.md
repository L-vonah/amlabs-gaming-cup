# Design Spec: Environment Isolation + Multi-Tournament

**Date:** 2026-03-24
**Status:** Approved
**Author:** vonah + Claude

---

## Problem

The site currently has a single Firebase project and hardcoded config. Any code change tested on a Netlify preview deploy or locally (with Firebase configured) writes directly to production Firestore. There is no way to safely develop and test features without risking real tournament data.

Additionally, the system is hardcoded for a single tournament (`amlabs-2026`), with no path toward hosting multiple coexisting tournaments.

---

## Goals

- Zero risk to production data during development
- Zero extra cost (Firebase Spark plan for both projects)
- Netlify preview deploys behave as a staging environment automatically
- Multiple tournaments can coexist on the same site
- Schema changes don't break existing data

---

## Non-Goals

- URL-based routing per tournament (e.g. `/uuid/bracket`)
- Seed data generation script
- Multiple admins
- Tournament archiving/deletion UI

---

## Design

### 1. Environment Detection (`js/env.js`)

A new file, loaded before all other scripts, detects the current environment by hostname and exports two constants used throughout the app.

```javascript
const APP_ENV = (() => {
  const host = window.location.hostname;
  if (host === 'amlabs-cup.netlify.app' || host === 'l-vonah.github.io') {
    return 'production';
  }
  return 'development'; // localhost, *.netlify.app preview, file://
})();

const IS_PROD = APP_ENV === 'production';
```

**Script load order change** — `env.js` is inserted first:
```
env.js → firebase-config.js → auth.js → firestore-service.js → state.js → ...
```

No build step required. Detection is purely client-side.

---

### 2. Firebase Config by Environment (`js/firebase-config.js`)

Two Firebase projects, both on the free Spark plan. The config is selected at runtime based on `IS_PROD`.

**Production project:** `amlabs-gaming-cup-df736` (existing, unchanged)
**Development project:** `amlabs-gaming-cup-dev` (new)

```javascript
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
```

**Firebase Dev project setup (one-time manual steps):**
1. Create project `amlabs-gaming-cup-dev` at Firebase Console
2. Enable Authentication > Google sign-in
3. Add `netlify.app` as an authorized domain (covers all preview URLs)
4. Create Firestore database in production mode
5. Deploy the same `firestore.rules` from this repository

---

### 3. localStorage Keys by Environment (`js/state.js`, `js/firestore-service.js`)

Keys are prefixed in non-production environments to prevent data collisions when the same browser has both environments open.

```javascript
const KEY_PREFIX = IS_PROD ? '' : 'dev_';

const STATE_KEY       = `${KEY_PREFIX}campeonato_amlabs_v1`;
const AUDIT_LOG_KEY   = `${KEY_PREFIX}campeonato_amlabs_audit_v1`;
const INSCRICOES_KEY  = `${KEY_PREFIX}campeonato_amlabs_inscricoes_v1`;
```

> **Note:** With the multi-tournament UUID approach (Section 5), keys will further include the tournament ID. Final key format: `{prefix}campeonato_{uuid}_v1`. This is handled together in implementation.

---

### 4. Visual Environment Banner (`js/app.js`, `index.html`)

When `!IS_PROD`, a fixed banner is injected at the top of the page during bootstrap:

```
⚠ AMBIENTE DE DESENVOLVIMENTO — Dados aqui são apenas para testes!
```

- Fixed position, full width, high z-index
- Distinct color (amber/orange) — unambiguous against the AMLabs theme
- Injected via `app.js` at `DOMContentLoaded`, not hardcoded in HTML
- Zero impact on production (conditional on `!IS_PROD`)

---

### 5. Multi-Tournament Architecture

#### 5.1 Tournament ID

`TOURNAMENT_ID` in `firestore-service.js` becomes a runtime value set from the active tournament in `sessionStorage`, rather than a hardcoded constant. All Firestore references (`campeonatos/{id}`, `auditLog` filter, `inscricoes` filter) already use `TOURNAMENT_ID` as a variable — no structural change to queries.

Each tournament is identified by a UUID (v4) generated at creation time. The UUID is the Firestore document ID. Human-readable names are metadata only.

#### 5.2 Firestore Structure

```
campeonatos/
  {uuid-1}/          ← 1º Campeonato EA Sports FC AMLabs 2026
  {uuid-2}/          ← 2º Campeonato EA Sports FC AMLabs 2027
  ...

auditLog/            ← unchanged, already has torneiId field, ensure that it uses the new UUID as a discriminator.
inscricoes/          ← unchanged, already has torneiId field, ensure that it uses the new UUID as a discriminator.
```

The existing `firestore.rules` uses `match /{document=**} { allow read: if true; }` — a recursive wildcard that covers both document reads (`get`) and collection listing (`list`). UUID documents and collection queries are both covered without rule changes.

#### 5.3 Tournament Selector (Home Screen)

The site opens on a **tournament selector** when no active tournament is loaded in `sessionStorage`. It lists all tournaments from Firestore (`campeonatos/` collection, ordered by `metadata.criadoEm` desc).

- Visitors see all tournaments, click to open
- Admin sees a **"+ Novo Campeonato"** button
- A "Trocar campeonato" link in the header returns to the selector

Once a tournament is selected, its UUID is stored in `sessionStorage` under key `active_tournament_id`. On new tab, the selector shows again.

**Bootstrap integration in `app.js`:**

The existing `DOMContentLoaded` handler gains a pre-tournament phase:

```
DOMContentLoaded:
  1. initAuth()                         ← unchanged (Google auth works before tournament)
  2. getActiveTournamentId() === null?
     YES → renderTournamentSelector()   ← new selector screen, stop here
     NO  → initTournament()             ← existing bootstrap continues
```

`initTournament()` wraps the existing flow: start Firestore listener, `initNavFromHash()`, render active section. The rest of `app.js` is unchanged.

While in the selector screen, `AppState.load()` must not be called (there is no active tournament to load). The selector only reads from Firestore's `campeonatos/` collection list, which is handled by a new `FirestoreService.listTournaments()` method.

#### 5.4 Tournament Creation

Admin-only form on the selector screen:

| Field | Required | Notes |
|-------|----------|-------|
| Nome do campeonato | ✓ | ex: "2º Campeonato EA Sports FC AMLabs 2027" |
| Jogo | ✓ | ex: "EA Sports FC" |

On submit:
1. Generate UUID (via `crypto.randomUUID()`)
2. Create Firestore document `campeonatos/{uuid}` with `DEFAULT_STATE` structure + metadata
3. Set `sessionStorage.active_tournament_id = uuid`
4. Navigate into the tournament at `status: configuracao`

#### 5.5 localStorage Keys with Tournament UUID

Because `TOURNAMENT_ID` is a runtime value (read from `sessionStorage` after tournament selection), localStorage keys **cannot be module-level constants**. They become getter functions in `state.js` and `firestore-service.js`:

```javascript
const KEY_PREFIX = IS_PROD ? '' : 'dev_';

function getStateKey()      { return `${KEY_PREFIX}campeonato_${getActiveTournamentId()}_v1`; }
function getAuditKey()      { return `${KEY_PREFIX}campeonato_${getActiveTournamentId()}_audit_v1`; }
function getInscricoesKey() { return `${KEY_PREFIX}campeonato_${getActiveTournamentId()}_inscricoes_v1`; }
```

These functions replace the current constants `STATE_KEY`, `AUDIT_LOG_KEY`, `INSCRICOES_LOCAL_KEY` everywhere they are used.

#### 5.6 TOURNAMENT_ID Ownership

`TOURNAMENT_ID` is no longer a module-level constant in `firestore-service.js`. A single shared getter in `env.js` owns the canonical value:

```javascript
// env.js
function getActiveTournamentId() {
  return sessionStorage.getItem('active_tournament_id');
}

function setActiveTournamentId(uuid) {
  sessionStorage.setItem('active_tournament_id', uuid);
}
```

Both `state.js` and `firestore-service.js` call `getActiveTournamentId()` directly. No module re-exports or passes it as a parameter — it is a shared ambient value read on demand, consistent with how the codebase already treats globals like `currentUser`.

This isolates each tournament's local cache even within the same environment.

---

### 6. Conversion Functions and Schema Version Round-Trip

The existing `convertStateToFirestore()` and `convertFirestoreToState()` functions translate between the localStorage "legacy" format and the Firestore format. `_schemaVersion` must survive this round-trip.

- `convertStateToFirestore()` — must include `_schemaVersion` as a top-level field in the Firestore document
- `convertFirestoreToState()` — must copy `_schemaVersion` from the Firestore document back to the state object

Tournament `metadata` (name, game) is already a top-level field in the Firestore format. It is **not** stored in localStorage state — it only lives in Firestore. The selector screen reads it directly from the Firestore document, not through `AppState`.

### 7. Schema Versioning (`js/state.js`)

`DEFAULT_STATE` gains a `_schemaVersion` field. On every `_ensureCache()` call, the loaded state passes through `migrateState()` before being returned.

```javascript
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_STATE = {
  _schemaVersion: CURRENT_SCHEMA_VERSION,
  campeonato: { ... },
  // ...
};

function migrateState(state) {
  const version = state._schemaVersion || 0;

  if (version < 1) {
    // Example: v0 → v1 migration
    // state.someNewField = state.someNewField ?? defaultValue;
  }

  state._schemaVersion = CURRENT_SCHEMA_VERSION;
  return state;
}
```

**Convention for future changes:**
- Bump `CURRENT_SCHEMA_VERSION`
- Add a migration block for the new version
- Document the change in `docs/ARCHITECTURE.md`

---

### 8. GitHub Pages Backup

`l-vonah.github.io` is hardcoded as `production` in `env.js`. GitHub Pages deploys only from `master` branch (configured in the repository settings) — feature branches do not trigger GitHub Pages deploys. There is no risk of a dev branch accidentally writing to production Firestore via GitHub Pages.

---

## Affected Files

| File | Change type | Notes |
|------|-------------|-------|
| `js/env.js` | **New** | Environment detection, `getActiveTournamentId()`, `setActiveTournamentId()` |
| `js/firebase-config.js` | **Modified** | Dual config object, selects by `IS_PROD` |
| `js/state.js` | **Modified** | Key getters (replace constants), `migrateState()`, `_schemaVersion` in DEFAULT_STATE |
| `js/firestore-service.js` | **Modified** | `getActiveTournamentId()` instead of constant, `listTournaments()`, `createTournament()` |
| `js/app.js` | **Modified** | Dev banner injection, pre-tournament bootstrap phase |
| `js/renderers.js` | **Modified** | Tournament selector renderer |
| `js/actions.js` | **Modified** | Tournament creation action |
| `js/renderers-home.js` | **No change** | — |
| `js/renderers-matches.js` | **No change** | — |
| `js/ui.js` | **No change** | — |
| `js/auth.js` | **No change** | — |
| `index.html` | **Modified** | `env.js` script tag added first, selector section HTML |
| `firestore.rules` | **No change** | Wildcard read rule already covers collection listing |

Ensure that all documentation and readme files are properly updated.
---

## Workflow After This Change

```
Developer creates feature branch
  → git push → Netlify preview auto-deploys
  → Preview URL connects to Firebase DEV (isolated)
  → Dev banner visible — impossible to confuse with prod
  → Test thoroughly with fictional data
  → Merge to master
  → Production deploy connects to Firebase PROD
  → Real tournament data untouched
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `crypto.randomUUID()` not available in old browsers | It's supported in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+). If needed, a simple polyfill can be added. |
| Dev Firebase Spark quota shared with testing | Spark gives 50k reads/day — more than enough for a small internal tournament site under active development |
| Admin accidentally creates tournament in wrong environment | Dev banner makes the environment obvious; dev and prod have separate Firestore databases |
| Existing localStorage data from `campeonato_amlabs_v1` becomes orphaned | No real data exists yet (site is under construction). Old key is simply ignored. |
