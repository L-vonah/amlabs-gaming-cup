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
⚠ AMBIENTE DE DESENVOLVIMENTO — dados aqui não são produção
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

auditLog/            ← unchanged, already has torneiId field
inscricoes/          ← unchanged, already has torneiId field
```

The existing `firestore.rules` already uses `campeonatos/{id}` (wildcard), so UUID documents are covered without rule changes.

#### 5.3 Tournament Selector (Home Screen)

The site opens on a **tournament selector** when no active tournament is loaded in `sessionStorage`. It lists all tournaments from Firestore (`campeonatos/` collection, ordered by `metadata.criadoEm` desc).

- Visitors see all tournaments, click to open
- Admin sees a **"+ Novo Campeonato"** button
- A "Trocar campeonato" link in the header returns to the selector

Once a tournament is selected, its UUID is stored in `sessionStorage` under key `active_tournament_id`. On new tab, the selector shows again.

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

Final localStorage key format:

```javascript
const KEY_PREFIX = IS_PROD ? '' : 'dev_';
const STATE_KEY = `${KEY_PREFIX}campeonato_${TOURNAMENT_ID}_v1`;
```

This isolates each tournament's local cache even within the same environment.

---

### 6. Schema Versioning (`js/state.js`)

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

## Affected Files

| File | Change type |
|------|-------------|
| `js/env.js` | **New** — environment detection |
| `js/firebase-config.js` | **Modified** — dual config, uses `IS_PROD` |
| `js/state.js` | **Modified** — dynamic localStorage keys, schema versioning |
| `js/firestore-service.js` | **Modified** — dynamic keys + tournament ID, tournament CRUD |
| `js/app.js` | **Modified** — dev banner injection, tournament selector bootstrap |
| `js/renderers.js` | **Modified** — tournament selector renderer |
| `js/actions.js` | **Modified** — tournament creation action |
| `index.html` | **Modified** — add `env.js` script tag (first), selector section |
| `firestore.rules` | **No change** — already uses wildcard `{id}` |

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
