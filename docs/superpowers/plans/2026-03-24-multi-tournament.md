# Multi-Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple tournaments to coexist on the same site — each with a UUID, accessible via a selector screen — with schema versioning to protect future data migrations.

**Architecture:** `env.js` gains `getActiveTournamentId()` / `setActiveTournamentId()` backed by `sessionStorage`. localStorage keys become getter functions including the tournament UUID. `firestore-service.js` exposes `listTournaments()` and `createTournament()`. `app.js` bootstrap checks for an active tournament before entering the existing flow — showing a selector screen if none is set. Schema versioning added to `DEFAULT_STATE` with a `migrateState()` function run on every cache load.

**Tech Stack:** Vanilla JS, Firebase compat SDK (CDN), `crypto.randomUUID()`, no build step.

**Spec:** `docs/superpowers/specs/2026-03-24-environment-isolation-design.md` (Sections 5–8)

**Depends on:** `2026-03-24-environment-isolation.md` must be fully implemented first (requires `IS_PROD` and `STORAGE_PREFIX` from `env.js`).

---

## File Map

| File | Change |
|------|--------|
| `js/env.js` | **Modify** — add `getActiveTournamentId()`, `setActiveTournamentId()`, `clearActiveTournamentId()` |
| `js/state.js` | **Modify** — key constants → getter functions; `_schemaVersion` in DEFAULT_STATE; `migrateState()`; update `resetState()`; update converters |
| `js/firestore-service.js` | **Modify** — replace `TOURNAMENT_ID` constant with `getActiveTournamentId()`; add `listTournaments()`, `createTournament()`; update `startListener` to use key getter |
| `index.html` | **Modify** — add `#sectionSeletor` as first section inside `<main>` |
| `js/renderers.js` | **Modify** — add `renderSeletor()`, register in `Renderers` |
| `js/actions.js` | **Modify** — add `submitCreateTournament()` |
| `js/app.js` | **Modify** — pre-tournament bootstrap phase; extract `initTournament()`; add `openTournamentSelector()` |
| `css/style.css` | **Modify** — add selector screen styles |
| `docs/ARCHITECTURE.md` | **Modify** — update localStorage keys, script load order, Firestore doc path, multi-tournament section |

---

### Task 1: Extend `js/env.js` with tournament session functions

**Files:**
- Modify: `js/env.js`

- [ ] **Step 1: Add session functions at the end of the file**

```javascript
// ------------------------------------------------------------------
// Active Tournament Session
// ------------------------------------------------------------------

const ACTIVE_TOURNAMENT_SESSION_KEY = 'active_tournament_id';

function getActiveTournamentId() {
  return sessionStorage.getItem(ACTIVE_TOURNAMENT_SESSION_KEY);
}

function setActiveTournamentId(uuid) {
  sessionStorage.setItem(ACTIVE_TOURNAMENT_SESSION_KEY, uuid);
}

function clearActiveTournamentId() {
  sessionStorage.removeItem(ACTIVE_TOURNAMENT_SESSION_KEY);
}
```

- [ ] **Step 2: Verify in console**

Open locally. Console:
```javascript
setActiveTournamentId('test-uuid-123');
getActiveTournamentId(); // → 'test-uuid-123'
clearActiveTournamentId();
getActiveTournamentId(); // → null
```

---

### Task 2: Update `js/state.js` — key getters, schema versioning, converters

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Replace key constants with getter functions**

Replace lines 6–7:
```javascript
const STATE_KEY = STORAGE_PREFIX + 'campeonato_amlabs_v1';
const AUDIT_LOG_KEY = STORAGE_PREFIX + 'campeonato_amlabs_audit_v1';
```

With:
```javascript
function getStateKey() {
  return STORAGE_PREFIX + 'campeonato_' + getActiveTournamentId() + '_v1';
}

function getAuditKey() {
  return STORAGE_PREFIX + 'campeonato_' + getActiveTournamentId() + '_audit_v1';
}
```

- [ ] **Step 2: Update all usages of STATE_KEY and AUDIT_LOG_KEY**

Search for every occurrence of `STATE_KEY` and `AUDIT_LOG_KEY` in `state.js` and replace with the function calls `getStateKey()` and `getAuditKey()`. There are approximately 6 occurrences total.

To find them:
```bash
grep -n "STATE_KEY\|AUDIT_LOG_KEY" js/state.js
```

Each occurrence like `localStorage.getItem(STATE_KEY)` becomes `localStorage.getItem(getStateKey())`.

- [ ] **Step 3: Add `_schemaVersion` to DEFAULT_STATE**

Add `_schemaVersion: 1` as the first field in `DEFAULT_STATE`:

```javascript
const DEFAULT_STATE = {
  _schemaVersion: 1,
  campeonato: {
  // ... rest unchanged
```

- [ ] **Step 4: Add `migrateState()` and call it in `_ensureCache`**

Add this function before `_ensureCache`:
```javascript
const CURRENT_SCHEMA_VERSION = 1;

function migrateState(state) {
  const version = state._schemaVersion || 0;

  if (version < 1) {
    // v0 → v1: initial versioning introduction, no structural changes needed.
    // Template for future migrations: add fields, rename keys, etc.
  }

  // Add future migration blocks here:
  // if (version < 2) { state.someNewField = state.someNewField ?? defaultValue; }

  state._schemaVersion = CURRENT_SCHEMA_VERSION;
  return state;
}
```

In `_ensureCache`, after parsing the raw state, call `migrateState`:

```javascript
function _ensureCache() {
  if (!_stateCache) {
    try {
      const raw = localStorage.getItem(getStateKey());
      const parsed = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_STATE));
      _stateCache = migrateState(parsed);
    } catch (e) {
      console.error('Erro ao carregar estado:', e);
      _stateCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }
  return _stateCache;
}
```

- [ ] **Step 5: Update `resetState()`**

Replace:
```javascript
function resetState() {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(AUDIT_LOG_KEY);
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
```

With:
```javascript
function resetState() {
  localStorage.removeItem(getStateKey());
  localStorage.removeItem(getAuditKey());
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
```

- [ ] **Step 6: Update `convertStateToFirestore` to include `_schemaVersion`**

In `convertStateToFirestore`, add `_schemaVersion` to the returned object:

```javascript
function convertStateToFirestore(state) {
  return {
    id: getActiveTournamentId(),
    _schemaVersion: state._schemaVersion || 1,
    metadata: {
      // ... rest unchanged
```

- [ ] **Step 7: Update `convertFirestoreToState` to restore `_schemaVersion`**

In `convertFirestoreToState`, add `_schemaVersion` to the returned object:

```javascript
function convertFirestoreToState(data) {
  if (!data) return null;
  return {
    _schemaVersion: data._schemaVersion || 0,
    campeonato: {
      // ... rest unchanged
```

- [ ] **Step 8: Verify**

Open locally, set an active tournament: `setActiveTournamentId('my-test-uuid')`.
Reload. In console:
```javascript
AppState.load()._schemaVersion  // → 1
Object.keys(localStorage).filter(k => k.includes('campeonato'))
// → ['dev_campeonato_my-test-uuid_v1']
```

---

### Task 3: Update `js/firestore-service.js`

**Files:**
- Modify: `js/firestore-service.js`

- [ ] **Step 1: Remove `TOURNAMENT_ID` constant and replace all usages**

Delete line 7:
```javascript
const TOURNAMENT_ID = 'amlabs-2026';
```

All occurrences of `TOURNAMENT_ID` in this file (there are ~6) must be replaced with `getActiveTournamentId()`. To find them:
```bash
grep -n "TOURNAMENT_ID" js/firestore-service.js
```

Replace each occurrence. Examples:
- `.doc(TOURNAMENT_ID)` → `.doc(getActiveTournamentId())`
- `torneiId: TOURNAMENT_ID` → `torneiId: getActiveTournamentId()`

- [ ] **Step 2: Update INSCRICOES_LOCAL_KEY to a getter function**

Replace:
```javascript
const INSCRICOES_LOCAL_KEY = STORAGE_PREFIX + 'campeonato_amlabs_inscricoes_v1';
```

With:
```javascript
function getInscricoesKey() {
  return STORAGE_PREFIX + 'campeonato_' + getActiveTournamentId() + '_inscricoes_v1';
}
```

Update all occurrences of `INSCRICOES_LOCAL_KEY` to `getInscricoesKey()`. There are ~4 occurrences:
```bash
grep -n "INSCRICOES_LOCAL_KEY" js/firestore-service.js
```

- [ ] **Step 3: Update `startListener` hardcoded key**

In `startListener`, find the line that writes to localStorage (the one that syncs Firestore data to localStorage for visitors). After Task 2 removed `STATE_KEY`, this line now reads:
```javascript
localStorage.setItem(STATE_KEY, JSON.stringify(legacyState));
```
`STATE_KEY` no longer exists. Update it to:
```javascript
localStorage.setItem(getStateKey(), JSON.stringify(legacyState));
```

- [ ] **Step 4: Add `listTournaments()` method to `FirestoreService`**

Add inside the `FirestoreService` object, after `getCachedData()`:

```javascript
/**
 * List all tournaments ordered by creation date (newest first).
 * Returns lightweight metadata only.
 */
async listTournaments() {
  if (!FIREBASE_CONFIGURED) return [];
  try {
    const snapshot = await firebase.firestore()
      .collection(CAMPEONATOS_COLLECTION)
      .orderBy('metadata.criadoEm', 'desc')
      .get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      nome: doc.data().metadata?.nome || 'Campeonato',
      jogo: doc.data().metadata?.jogo || '',
      status: doc.data().metadata?.status || 'configuracao',
      criadoEm: doc.data().metadata?.criadoEm || null
    }));
  } catch (error) {
    console.error('Error listing tournaments:', error);
    return [];
  }
},
```

- [ ] **Step 5: Add `createTournament()` method to `FirestoreService`**

Add after `listTournaments()`:

```javascript
/**
 * Create a new tournament document in Firestore.
 * Returns the generated UUID on success, null on failure.
 */
async createTournament({ nome, jogo }) {
  if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return null;

  const uuid = crypto.randomUUID();
  const now = new Date().toISOString();

  const doc = {
    id: uuid,
    _schemaVersion: 1,
    metadata: {
      nome,
      jogo,
      status: 'configuracao',
      criadoEm: now,
      atualizadoEm: now
    },
    config: {
      formato: 'grupos+playoffs',
      classificadosPorGrupo: 4,
      regrasClassificacao: {
        vitoria: 3,
        empate: 1,
        derrota: 0,
        criteriosDesempate: ['pontos', 'vitorias', 'saldoGols', 'golsMarcados', 'confrontoDireto']
      }
    },
    times: [],
    faseGrupos: { status: 'aguardando', partidas: [] },
    playoffs: { formato: 'double-elim-4', status: 'aguardando', matches: {} },
    campeao: null
  };

  try {
    await firebase.firestore()
      .collection(CAMPEONATOS_COLLECTION)
      .doc(uuid)
      .set(doc);
    return uuid;
  } catch (error) {
    console.error('Error creating tournament:', error);
    return null;
  }
},
```

- [ ] **Step 6: Verify (console)**

```javascript
// Test listTournaments (will be empty on new dev project)
FirestoreService.listTournaments().then(list => console.log(list));
```
Expected: `[]` (empty array on fresh dev project, no error).

---

### Task 4: Add selector section HTML to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Find the opening `<main class="main-content">` tag**

- [ ] **Step 2: Insert selector section as the first child of `<main>`**

```html
<!-- ===============================================================
     TOURNAMENT SELECTOR (shown when no tournament is active)
     =============================================================== -->
<section id="sectionSeletor" class="section" style="display:none;">
  <div class="container">
    <div class="selector-header">
      <h1 class="selector-title">AMLabs Gaming Cup</h1>
      <p class="selector-subtitle">Selecione um campeonato para continuar</p>
    </div>

    <div id="selectorTorneioList" class="selector-list">
      <!-- Rendered by Renderers.seletor() -->
    </div>

    <!-- Admin only: create new tournament -->
    <div class="admin-only selector-create-area" style="display:none;">
      <hr class="selector-divider">
      <h3 class="selector-create-title">Novo Campeonato</h3>
      <form id="formCreateTournament" onsubmit="submitCreateTournament(event)">
        <div class="form-group">
          <label for="inputTournamentNome">Nome do campeonato</label>
          <input type="text" id="inputTournamentNome" class="form-control"
            placeholder="Ex: 2º Campeonato EA Sports FC AMLabs 2027"
            maxlength="100" required>
        </div>
        <div class="form-group">
          <label for="inputTournamentJogo">Jogo</label>
          <input type="text" id="inputTournamentJogo" class="form-control"
            placeholder="Ex: EA Sports FC" maxlength="60" required>
        </div>
        <button type="submit" class="btn btn-primary">Criar Campeonato</button>
      </form>
    </div>
  </div>
</section>
```

---

### Task 5: Add `renderSeletor()` to `js/renderers.js`

**Files:**
- Modify: `js/renderers.js`

- [ ] **Step 1: Add the render function**

Add this function near the top of `renderers.js` (before or after the first existing renderer):

```javascript
async function renderSeletor() {
  const container = document.getElementById('selectorTorneioList');
  if (!container) return;

  container.innerHTML = '<p class="selector-loading">Carregando campeonatos...</p>';

  let torneiros = [];
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    torneiros = await FirestoreService.listTournaments();
  }

  if (torneiros.length === 0) {
    container.innerHTML = '<p class="selector-empty">Nenhum campeonato encontrado.</p>';
    return;
  }

  const statusLabel = {
    configuracao: 'Configuração',
    grupos: 'Fase de Grupos',
    playoffs: 'Playoffs',
    encerrado: 'Encerrado'
  };

  container.innerHTML = torneiros.map(t => `
    <div class="selector-card" onclick="enterTournament('${UI.escapeHtml(t.id)}')">
      <div class="selector-card-info">
        <span class="selector-card-name">${UI.escapeHtml(t.nome)}</span>
        <span class="selector-card-game">${UI.escapeHtml(t.jogo)}</span>
      </div>
      <span class="selector-card-status badge badge-${UI.escapeHtml(t.status)}">
        ${statusLabel[t.status] || t.status}
      </span>
    </div>
  `).join('');
}
window.renderSeletor = renderSeletor;
```

- [ ] **Step 2: Register in `Renderers` object**

Find where the `window.Renderers` object is assembled at the bottom of `renderers.js`. Add `seletor`:

```javascript
window.Renderers = {
  seletor: renderSeletor,
  home: renderHome,
  // ... rest unchanged
};
```

---

### Task 6: Add tournament actions to `js/actions.js`

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 1: Add `enterTournament()` function**

Add near the top of `actions.js`, after the existing imports/globals section:

```javascript
/**
 * Enter a tournament by UUID. Sets session and boots the app.
 */
function enterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.reload();
}
window.enterTournament = enterTournament;
```

- [ ] **Step 2: Add `submitCreateTournament()` function**

```javascript
/**
 * Handle the "Criar Campeonato" form submission.
 */
async function submitCreateTournament(event) {
  event.preventDefault();
  if (!UI.checkAdmin()) return;

  const nome = document.getElementById('inputTournamentNome').value.trim();
  const jogo = document.getElementById('inputTournamentJogo').value.trim();

  if (!nome || !jogo) {
    UI.showToast('Preencha o nome e o jogo do campeonato.', 'error');
    return;
  }

  const uuid = await FirestoreService.createTournament({ nome, jogo });
  if (!uuid) {
    UI.showToast('Erro ao criar campeonato. Tente novamente.', 'error');
    return;
  }

  UI.showToast('Campeonato criado!', 'success');
  enterTournament(uuid);
}
window.submitCreateTournament = submitCreateTournament;
```

---

### Task 7: Update `js/app.js` bootstrap

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add `openTournamentSelector()` function**

Add before the `DOMContentLoaded` handler:

```javascript
/**
 * Show the tournament selector screen and hide the main app shell.
 */
function openTournamentSelector() {
  // Hide app nav and status badge
  const mainNav = document.getElementById('mainNav');
  const badge = document.getElementById('headerStatusBadge');
  const mobileBar = document.querySelector('.mobile-nav-bar');
  if (mainNav) mainNav.style.display = 'none';
  if (badge) badge.style.display = 'none';
  if (mobileBar) mobileBar.style.display = 'none';

  // Hide all content sections, show selector
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const seletor = document.getElementById('sectionSeletor');
  if (seletor) seletor.style.display = 'block';

  // Show admin create area if admin.
  // NOTE: auth is async — isAdmin() may return false on first render if the
  // Google auth callback hasn't fired yet. updateAdminUI() (called by auth.js
  // after login resolves) will re-run and show/hide .admin-only elements,
  // including .selector-create-area, once auth settles.
  const createArea = document.querySelector('.selector-create-area');
  if (createArea) createArea.style.display = isAdmin() ? 'block' : 'none';

  if (window.Renderers && window.Renderers.seletor) {
    window.Renderers.seletor();
  }
}
window.openTournamentSelector = openTournamentSelector;
```

- [ ] **Step 2: Extract `initTournament()` from DOMContentLoaded**

The existing body of `DOMContentLoaded` (after the dev banner block and `initAuth()`) becomes `initTournament()`:

```javascript
function initTournament() {
  updateInscricoesVisibility();

  const inputCorTimo = document.getElementById('inputCorTimo');
  const inputInscCor = document.getElementById('inputInscCor');
  if (inputCorTimo) inputCorTimo.value = UI.getRandomColor();
  if (inputInscCor) inputInscCor.value = UI.getRandomColor();

  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    FirestoreService.startListener((data) => {
      const active = document.querySelector('.nav-link.active');
      if (active) {
        const section = active.getAttribute('data-nav');
        if (window.Renderers && window.Renderers[section]) {
          window.Renderers[section]();
        }
      }
    });
  }

  initNavFromHash();
}
```

- [ ] **Step 3: Update `DOMContentLoaded` handler**

Replace the current handler body with the pre-tournament check:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Dev banner
  if (!IS_PROD) {
    const banner = document.createElement('div');
    banner.className = 'dev-banner';
    banner.textContent = '⚠ AMBIENTE DE DESENVOLVIMENTO — Dados aqui são apenas para testes!';
    document.body.prepend(banner);
    document.body.classList.add('has-dev-banner');
  }

  initAuth();

  // Pre-tournament phase: if no tournament selected, show selector
  if (!getActiveTournamentId()) {
    openTournamentSelector();
    return;
  }

  initTournament();
});
```

- [ ] **Step 4: Add "Trocar campeonato" button to the header**

In `index.html`, inside the header, add a button visible only after a tournament is selected. Add after the `<div class="header-badge">` block:

```html
<button class="btn-trocar-torneio" onclick="clearActiveTournamentId(); location.reload();"
  title="Trocar campeonato">&#8592; Trocar</button>
```

Add CSS in `style.css`:
```css
.btn-trocar-torneio {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  cursor: pointer;
}
.btn-trocar-torneio:hover {
  color: var(--color-text);
  border-color: var(--color-text);
}
```

- [ ] **Step 5: Verify full flow**

1. Open locally, clear sessionStorage: `sessionStorage.clear()`, reload
2. Expected: selector screen shown, nav hidden
3. (If Firebase dev has no tournaments yet, shows "Nenhum campeonato encontrado" + admin create form if logged in)
4. Create a tournament, fill form, submit
5. Expected: page reloads, tournament loads normally, banner visible
6. Click "Trocar" in header
7. Expected: selector screen again

---

### Task 8: Add selector CSS to `css/style.css`

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add selector styles**

Add after the dev banner styles:

```css
/* ---------------------------------------------------------------
   Tournament Selector Screen
   --------------------------------------------------------------- */
.selector-header {
  text-align: center;
  padding: 48px 0 32px;
}

.selector-title {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.selector-subtitle {
  color: var(--color-text-muted);
  font-size: 1rem;
}

.selector-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto 40px;
}

.selector-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.selector-card:hover {
  border-color: var(--color-primary);
}

.selector-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selector-card-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.selector-card-game {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.selector-loading,
.selector-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: 32px 0;
}

.selector-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 40px 0 32px;
}

.selector-create-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.selector-create-area {
  max-width: 600px;
  margin: 0 auto;
}
```

---

### Task 9: Update `docs/ARCHITECTURE.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update script load order**

In section "Ordem de Carregamento dos Scripts", add `env.js` as the first entry:
```
env.js → firebase-config.js → auth.js → ...
```

- [ ] **Step 2: Update localStorage key section**

Replace the static key table with the dynamic key format:

```
{prefix}campeonato_{uuid}_v1         ← state
{prefix}campeonato_{uuid}_audit_v1   ← audit log
{prefix}campeonato_{uuid}_inscricoes_v1 ← inscrições
```

Where `prefix` is `''` in production, `'dev_'` elsewhere.

- [ ] **Step 3: Update Firestore doc path**

Replace `campeonatos/amlabs-2026` with `campeonatos/{uuid}` throughout.

- [ ] **Step 4: Add multi-tournament and environment sections**

Add a brief section describing:
- Environment detection (`env.js`, `APP_ENV`, `IS_PROD`)
- Tournament selector flow (sessionStorage, `getActiveTournamentId()`)
- Schema versioning (`_schemaVersion`, `migrateState()`, convention for future migrations)

---

### Task 10: Commit and push

- [ ] **Step 1: Stage all modified files**

```bash
git add js/env.js js/state.js js/firestore-service.js js/app.js js/renderers.js js/actions.js index.html css/style.css docs/ARCHITECTURE.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: multi-tournament support — selector screen, UUID IDs, schema versioning"
```

- [ ] **Step 3: Push**

```bash
git push origin master
```

- [ ] **Step 4: End-to-end verify on production**

> Both prod and dev start with no tournaments. The selector will show "Nenhum campeonato encontrado" until the admin creates one.

1. Open `https://amlabs-cup.netlify.app` in a fresh tab (no sessionStorage)
2. Expected: selector screen visible, no banner, nav hidden
3. Log in as admin → admin create form appears below the list
4. Create a tournament (ex: "1º Campeonato EA Sports FC AMLabs 2026", "EA Sports FC")
5. Expected: page reloads, tournament loads normally into `configuracao` status
6. Navigate through all sections — app works normally
7. Click "Trocar" in header → returns to selector
8. Selector now shows the created tournament → click it → loads again

- [ ] **Step 5: Verify dev environment**

Open a Netlify preview URL:
1. Same selector flow as above
2. Dev banner visible
3. Tournament created here appears only in `amlabs-gaming-cup-dev` Firestore
4. Production Firestore untouched
