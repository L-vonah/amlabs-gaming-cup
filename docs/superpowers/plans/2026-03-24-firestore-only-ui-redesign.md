# Firestore-Only Architecture + UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove localStorage as persistence layer, make Firestore the single source of truth, redesign the header to a two-line layout (Proposal A) with tournament dropdown, fix mobile responsiveness, and align the DDD data model.

**Architecture:** Firestore becomes the only data store. `state.js` keeps an in-memory cache fed by the Firestore real-time listener (no localStorage reads/writes). `sessionStorage` holds only `active_tournament_id`. The header splits into two lines: top bar (logo + tournament dropdown trigger) and nav bar (horizontal navigation). A dropdown component lists tournaments for switching without leaving the current page. Firebase failures show an error state instead of silently falling back.

**Tech Stack:** Vanilla JS, Firebase compat SDK (CDN), no build step.

**Depends on:** `feat/multi-tournament` branch (current working branch with env isolation + multi-tournament selector already implemented).

---

## File Map

| File | Change |
|------|--------|
| `js/env.js` | **Modify** — remove `STORAGE_PREFIX` (no longer needed) |
| `js/state.js` | **Modify** — remove all localStorage, in-memory cache fed by Firestore, generic DEFAULT_STATE, DDD model fixes (add `jogo`, remove `edicao`/`temporada`), converters alignment |
| `js/firestore-service.js` | **Modify** — remove localStorage fallbacks, listener syncs for ALL users (not just visitors), add `initializeState()` that resolves on first snapshot, remove `getInscricoesKey()`/`getStateKey()` references |
| `js/app.js` | **Modify** — `initTournament()` shows loading then waits for Firestore, error state on failure, two-line header logic, dropdown open/close, portal mode fixes for mobile |
| `js/renderers.js` | **Modify** — `renderSeletor()` reuse for dropdown rendering |
| `js/actions.js` | **Modify** — playoff format saves to Firestore, rewrite `importData()`/`exportData()` for Firestore-only |
| `js/ui.js` | **Modify** — remove dead `updateHeaderBadge()` function |
| `index.html` | **Modify** — two-line header (top bar + nav bar), dropdown container HTML, remove lifecycle bar from between lines |
| `css/style.css` | **Modify** — two-line header styles, dropdown styles, mobile portal-mode fixes, responsive selector |
| `docs/ARCHITECTURE.md` | **Modify** — document new persistence model, header layout, mobile patterns |

---

### Task 1: Clean up `js/env.js`

**Files:**
- Modify: `js/env.js`

- [ ] **Step 1: Remove STORAGE_PREFIX**

`STORAGE_PREFIX` was used for localStorage key prefixing. With localStorage removed, it's no longer needed. Remove lines 16-18:

```javascript
// DELETE these lines:
// Prefix for localStorage keys. Prevents dev data from colliding with prod
// when the same browser has both environments open simultaneously.
const STORAGE_PREFIX = IS_PROD ? '' : 'dev_';
```

The file should now contain only: `APP_ENV`, `IS_PROD`, and the three sessionStorage functions (`getActiveTournamentId`, `setActiveTournamentId`, `clearActiveTournamentId`).

- [ ] **Step 2: Verify no other files reference STORAGE_PREFIX**

```bash
grep -rn "STORAGE_PREFIX" js/
```

If any hits remain, they'll be cleaned in subsequent tasks.

---

### Task 2: Refactor `js/state.js` — remove localStorage, fix DDD model

**Files:**
- Modify: `js/state.js`

This is the largest change. The state module stops reading/writing localStorage entirely. The in-memory cache (`_stateCache`) is now the only runtime state, populated by the Firestore listener.

- [ ] **Step 1: Remove localStorage key getters**

Delete the `getStateKey()` and `getAuditKey()` functions (lines 6-13):

```javascript
// DELETE:
function getStateKey() { ... }
function getAuditKey() { ... }
```

- [ ] **Step 2: Update DEFAULT_STATE — generic, add jogo**

Replace the current DEFAULT_STATE with a generic version. Remove `edicao` and `temporada` (legacy single-tournament fields). Add `jogo`:

```javascript
const DEFAULT_STATE = {
  _schemaVersion: 1,
  campeonato: {
    nome: '',
    jogo: '',
    status: 'configuracao' // configuracao | grupos | playoffs | encerrado
  },
  config: {
    pontosPorVitoria: 3,
    pontosPorEmpate: 1,
    pontosPorDerrota: 0,
    classificadosPorGrupo: 4,
    criteriosDesempate: ['pontos', 'vitorias', 'saldoGols', 'golsMarcados', 'confrontoDireto']
  },
  times: [],
  faseGrupos: {
    status: 'aguardando',
    partidas: []
  },
  playoffs: {
    formato: 'double-elim-4',
    status: 'aguardando',
    matches: {}
  }
};
```

- [ ] **Step 3: Rewrite `_ensureCache` — no localStorage**

The cache is now only populated by `_feedFromFirestore()` (new function, added in step 5). On first call before Firestore has loaded, return a deep clone of DEFAULT_STATE:

```javascript
function _ensureCache() {
  if (!_stateCache) {
    _stateCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  return _stateCache;
}
```

- [ ] **Step 4: Rewrite `saveState` — Firestore only**

Remove localStorage write. Keep in-memory cache update and Firestore sync:

```javascript
function saveState(state) {
  try {
    _classificacaoCache = null;
    _stateCache = JSON.parse(JSON.stringify(state));

    // Sync to Firestore if configured and admin
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive() && UI.checkAdmin()) {
      const firestoreData = convertStateToFirestore(state);
      FirestoreService.saveTournament(firestoreData).then(ok => {
        if (!ok && typeof UI !== 'undefined') {
          UI.showToast('Erro ao salvar no servidor. Tente novamente.', 'error');
        }
      });
    }

    return true;
  } catch (e) {
    console.error('Erro ao salvar estado:', e);
    return false;
  }
}
```

- [ ] **Step 5: Add `_feedFromFirestore` — called by listener**

New function that replaces the old listener→localStorage→cache flow. The Firestore listener calls this directly to update the in-memory cache:

```javascript
/**
 * Feed state cache from Firestore snapshot data.
 * Called by FirestoreService.startListener on every update.
 */
function feedFromFirestore(firestoreData) {
  if (!firestoreData) return;
  const legacyState = convertFirestoreToState(firestoreData);
  if (legacyState) {
    _stateCache = migrateState(legacyState);
    _classificacaoCache = null;
  }
}
```

Export it on `window.AppState`:
```javascript
window.AppState = {
  // ... existing exports ...
  feedFromFirestore,
};
```

- [ ] **Step 6: Rewrite `resetState` — no localStorage**

```javascript
function resetState() {
  _stateCache = null;
  _classificacaoCache = null;
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
```

- [ ] **Step 7: Rewrite `addAuditLog` — Firestore only**

Remove localStorage read/write for audit log. Keep only the Firestore write:

```javascript
function addAuditLog(usuario, acao, detalhes) {
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    FirestoreService.addAuditLog(acao, detalhes);
  }
}
```

- [ ] **Step 8: Rewrite `loadAuditLog` — Firestore only**

Remove localStorage fallback. This is now async:

```javascript
async function loadAuditLog() {
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    return FirestoreService.loadAuditLog();
  }
  return [];
}
```

Update the export: `loadAuditLog` is now async.

- [ ] **Step 9: Fix `convertStateToFirestore` — DDD alignment**

Remove hardcoded `jogo` and `ano`. Read `jogo` from state. Remove `ano`:

```javascript
function convertStateToFirestore(state) {
  return {
    id: getActiveTournamentId(),
    _schemaVersion: state._schemaVersion || 1,
    metadata: {
      nome: state.campeonato.nome,
      jogo: state.campeonato.jogo || '',
      status: state.campeonato.status,
      criadoEm: state._criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    },
    config: {
      formato: 'grupos+playoffs',
      classificadosPorGrupo: state.config.classificadosPorGrupo || 4,
      regrasClassificacao: {
        vitoria: state.config.pontosPorVitoria,
        empate: state.config.pontosPorEmpate,
        derrota: state.config.pontosPorDerrota,
        criteriosDesempate: state.config.criteriosDesempate
      }
    },
    times: state.times,
    faseGrupos: state.faseGrupos,
    playoffs: state.playoffs,
    campeao: _getCampeao(state)
  };
}
```

- [ ] **Step 10: Fix `convertFirestoreToState` — DDD alignment**

Remove `edicao` and `temporada`. Add `jogo`:

```javascript
function convertFirestoreToState(data) {
  if (!data) return null;
  return {
    _schemaVersion: data._schemaVersion || 0,
    campeonato: {
      nome: data.metadata.nome,
      jogo: data.metadata.jogo || '',
      status: data.metadata.status
    },
    config: {
      pontosPorVitoria: data.config.regrasClassificacao.vitoria,
      pontosPorEmpate: data.config.regrasClassificacao.empate,
      pontosPorDerrota: data.config.regrasClassificacao.derrota,
      classificadosPorGrupo: (data.config && data.config.classificadosPorGrupo) || 4,
      criteriosDesempate: data.config.regrasClassificacao.criteriosDesempate
    },
    times: data.times || [],
    faseGrupos: data.faseGrupos || { status: 'aguardando', partidas: [] },
    playoffs: data.playoffs || JSON.parse(JSON.stringify(DEFAULT_STATE.playoffs)),
    _criadoEm: data.metadata.criadoEm
  };
}
```

---

### Task 3: Refactor `js/firestore-service.js` — remove localStorage, sync for all users

**Files:**
- Modify: `js/firestore-service.js`

- [ ] **Step 1: Remove `getInscricoesKey` and localStorage constants**

Delete the `getInscricoesKey()` function (lines 11-13 approximately).

- [ ] **Step 2: Rewrite `startListener` — feed cache for ALL users, return Promise for first snapshot**

Remove the admin skip logic. The listener calls `AppState.feedFromFirestore()` for everyone. Returns a Promise that resolves on the first snapshot (eliminates need for a separate `initializeState` method and avoids double-subscription race):

```javascript
/**
 * Start real-time listener. Returns a Promise that resolves on first snapshot.
 * Subsequent snapshots trigger onUpdate callback.
 */
startListener(onUpdate) {
  if (!FIREBASE_CONFIGURED) return Promise.reject(new Error('Firebase not configured'));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout loading tournament data')), 10000);
    let firstSnapshot = true;

    const docRef = firebase.firestore()
      .collection(CAMPEONATOS_COLLECTION)
      .doc(getActiveTournamentId());

    _firestoreListenerUnsubscribe = docRef.onSnapshot((doc) => {
      if (doc.exists) {
        _firestoreCache = doc.data();
        if (window.AppState && window.AppState.feedFromFirestore) {
          window.AppState.feedFromFirestore(_firestoreCache);
        }
      } else {
        _firestoreCache = null;
      }

      if (firstSnapshot) {
        firstSnapshot = false;
        clearTimeout(timeout);
        if (doc.exists) {
          resolve(_firestoreCache);
        } else {
          reject(new Error('Tournament not found'));
        }
      }

      if (onUpdate) onUpdate(_firestoreCache);
    }, (error) => {
      console.error('Firestore listener error:', error);
      if (firstSnapshot) {
        firstSnapshot = false;
        clearTimeout(timeout);
        reject(error);
      }
      if (onUpdate) onUpdate(null, error);
    });
  });
},
```

> **Note:** No separate `initializeState()` method needed. `startListener()` itself returns the Promise for the first snapshot, keeping a single subscription.

- [ ] **Step 4: Remove localStorage fallbacks from inscricoes methods**

In `submitRegistration`: remove the `if (!FIREBASE_CONFIGURED)` localStorage branch. If Firebase is not configured, return null.

In `loadRegistrations`: remove localStorage fallback. If Firebase is not configured, return empty array.

In `updateRegistration`: remove localStorage fallback.

```javascript
async submitRegistration(data) {
  if (!FIREBASE_CONFIGURED) return null;
  const entry = {
    torneiId: getActiveTournamentId(),
    ...data,
    status: 'pendente',
    criadoEm: new Date().toISOString(),
    device: typeof getDeviceId === 'function' ? getDeviceId() : 'unknown',
    resolvidoEm: null,
    resolvidoPor: null
  };
  const docRef = await firebase.firestore().collection(INSCRICOES_COLLECTION).add(entry);
  return { id: docRef.id, ...entry };
},

async loadRegistrations() {
  if (!FIREBASE_CONFIGURED) return [];
  try {
    const snapshot = await firebase.firestore()
      .collection(INSCRICOES_COLLECTION)
      .where('torneiId', '==', getActiveTournamentId())
      .orderBy('criadoEm', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading registrations:', error);
    return [];
  }
},

async updateRegistration(id, data) {
  if (!FIREBASE_CONFIGURED) return;
  await firebase.firestore().collection(INSCRICOES_COLLECTION).doc(id).update(data);
},
```

---

### Task 4: Refactor `js/app.js` — loading state, error handling, header modes

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add loading and error state helpers**

Add before `openTournamentSelector()`:

```javascript
function showLoadingState() {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const main = document.querySelector('.main-content');
  if (!main) return;
  let loader = document.getElementById('appLoadingState');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'appLoadingState';
    loader.className = 'app-loading-state';
    loader.innerHTML = '<div class="loading-spinner"></div><p>Carregando campeonato...</p>';
    main.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function showErrorState(message) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const loader = document.getElementById('appLoadingState');
  if (loader) loader.style.display = 'none';
  const main = document.querySelector('.main-content');
  if (!main) return;
  let error = document.getElementById('appErrorState');
  if (!error) {
    error = document.createElement('div');
    error.id = 'appErrorState';
    error.className = 'app-error-state';
    main.appendChild(error);
  }
  error.innerHTML = `
    <div class="error-icon">⚠</div>
    <p class="error-title">Falha ao carregar</p>
    <p class="error-message">${UI.escapeHtml(message)}</p>
    <button class="btn btn-primary" onclick="clearActiveTournamentId(); location.reload();">Voltar aos campeonatos</button>
  `;
  error.style.display = 'flex';
}

function hideLoadingState() {
  const loader = document.getElementById('appLoadingState');
  if (loader) loader.style.display = 'none';
  const error = document.getElementById('appErrorState');
  if (error) error.style.display = 'none';
}
```

- [ ] **Step 2: Update `openTournamentSelector` — fix mobile bottom bar**

In `openTournamentSelector()`, fix the element references and add mobile bottom bar hiding:

```javascript
function openTournamentSelector() {
  document.body.classList.add('portal-mode');

  // Hide tournament-specific elements
  const mainNav = document.getElementById('mainNav');
  const navBar = document.getElementById('navBar');
  const mobileBottomBar = document.getElementById('mobileBottomBar');
  const mobileMoreOverlay = document.getElementById('mobileMoreOverlay');
  const lifecycleBar = document.getElementById('lifecycleBar');
  const tournamentTrigger = document.getElementById('tournamentTrigger');
  if (mainNav) mainNav.style.display = 'none';
  if (navBar) navBar.style.display = 'none';
  if (mobileBottomBar) mobileBottomBar.style.display = 'none';
  if (mobileMoreOverlay) mobileMoreOverlay.style.display = 'none';
  if (lifecycleBar) lifecycleBar.style.display = 'none';
  if (tournamentTrigger) tournamentTrigger.style.display = 'none';

  hideLoadingState();

  // Hide all content sections, show selector
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const seletor = document.getElementById('sectionSeletor');
  if (seletor) seletor.style.display = 'block';

  document.title = 'Campeonatos AMLabs';

  if (window.Renderers && window.Renderers.seletor) {
    window.Renderers.seletor();
  }
}
```

- [ ] **Step 3: Rewrite `initTournament` — async, waits for Firestore**

```javascript
async function initTournament() {
  document.body.classList.remove('portal-mode');

  // Show loading while Firestore loads
  showLoadingState();

  // Show nav bar, tournament trigger
  const navBar = document.getElementById('navBar');
  const lifecycleBar = document.getElementById('lifecycleBar');
  const tournamentTrigger = document.getElementById('tournamentTrigger');
  if (navBar) navBar.style.display = '';
  if (lifecycleBar) lifecycleBar.style.display = '';
  if (tournamentTrigger) tournamentTrigger.style.display = '';

  // Start listener — the returned Promise resolves on first snapshot
  try {
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
      await FirestoreService.startListener((data, error) => {
        if (error) return;
        // Update header on every subsequent snapshot
        if (data && data.metadata) {
          const tn = document.getElementById('tournamentTriggerName');
          if (tn) tn.textContent = data.metadata.nome;
          document.title = data.metadata.nome + ' — Campeonatos AMLabs';
        }
        const active = document.querySelector('.nav-link.active');
        if (active) {
          const section = active.getAttribute('data-nav');
          if (window.Renderers && window.Renderers[section]) {
            window.Renderers[section]();
          }
        }
      });
    } else {
      throw new Error('Firebase não configurado');
    }
  } catch (error) {
    console.error('Failed to load tournament:', error);
    showErrorState(error.message === 'Tournament not found'
      ? 'Campeonato não encontrado. Ele pode ter sido removido.'
      : 'Não foi possível conectar ao servidor. Verifique sua conexão.');
    return;
  }

  hideLoadingState();

  // Update header with tournament name from first snapshot
  const state = AppState.loadReadOnly();
  const tournamentName = document.getElementById('tournamentTriggerName');
  if (tournamentName) {
    tournamentName.textContent = state.campeonato.nome || 'Campeonato';
  }
  document.title = (state.campeonato.nome || 'Campeonato') + ' — Campeonatos AMLabs';

  updateInscricoesVisibility();

  const inputCorTimo = document.getElementById('inputCorTimo');
  const inputInscCor = document.getElementById('inputInscCor');
  if (inputCorTimo) inputCorTimo.value = UI.getRandomColor();
  if (inputInscCor) inputInscCor.value = UI.getRandomColor();

  initNavFromHash();
}
```

- [ ] **Step 4: Add tournament dropdown open/close logic**

```javascript
// Tournament dropdown
function toggleTournamentDropdown() {
  const dropdown = document.getElementById('tournamentDropdown');
  if (!dropdown) return;
  const isOpen = dropdown.style.display === 'block';
  if (isOpen) {
    closeTournamentDropdown();
  } else {
    openTournamentDropdown();
  }
}

async function openTournamentDropdown() {
  const dropdown = document.getElementById('tournamentDropdown');
  if (!dropdown) return;
  dropdown.style.display = 'block';

  // Render tournament list inside dropdown
  const listContainer = document.getElementById('dropdownTorneioList');
  if (!listContainer) return;
  listContainer.innerHTML = '<p style="padding:8px 12px;font-size:0.8rem;color:var(--color-text-muted);">Carregando...</p>';

  const activeId = getActiveTournamentId();
  let torneiros = [];
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    torneiros = await FirestoreService.listTournaments();
  }

  if (torneiros.length === 0) {
    listContainer.innerHTML = '<p style="padding:8px 12px;font-size:0.8rem;color:var(--color-text-muted);">Nenhum campeonato.</p>';
    return;
  }

  const statusLabel = {
    configuracao: 'Inscrições',
    grupos: 'Grupos',
    playoffs: 'Playoffs',
    encerrado: 'Encerrado'
  };

  const statusClass = {
    configuracao: 'badge-configuracao',
    grupos: 'badge-grupos',
    playoffs: 'badge-playoffs',
    encerrado: 'badge-encerrado'
  };

  listContainer.innerHTML = torneiros.map(t => `
    <div class="dropdown-item${t.id === activeId ? ' dropdown-item-active' : ''}"
         onclick="enterTournament('${UI.escapeHtml(t.id)}')">
      <div class="dropdown-item-info">
        <span class="dropdown-item-name">${UI.escapeHtml(t.nome)}</span>
        <span class="dropdown-item-meta">${UI.escapeHtml(t.jogo)}${t.criadoEm ? ' · ' + new Date(t.criadoEm).toLocaleDateString('pt-BR') : ''}</span>
      </div>
      <span class="dropdown-item-badge ${statusClass[t.status] || ''}">${statusLabel[t.status] || t.status}</span>
    </div>
  `).join('');
}

function closeTournamentDropdown() {
  const dropdown = document.getElementById('tournamentDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

window.toggleTournamentDropdown = toggleTournamentDropdown;
window.closeTournamentDropdown = closeTournamentDropdown;

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('tournamentDropdown');
  const trigger = document.getElementById('tournamentTrigger');
  if (dropdown && dropdown.style.display === 'block') {
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
      closeTournamentDropdown();
    }
  }
});
```

---

### Task 5: Redesign header HTML — two-line layout + dropdown

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the header block**

Replace the entire `<header>` block with the two-line layout:

```html
<header class="site-header">
  <!-- Line 1: Top bar — logo + tournament trigger -->
  <div class="header-top-bar" id="headerTopBar">
    <a class="site-logo" id="siteLogo" onclick="UI.navigateTo('home')" style="cursor:pointer">
      <img src="assets/logo-amlabs.png" alt="AMLabs" class="logo-img">
      <span class="logo-text">Campeonatos <span>AMLabs</span></span>
    </a>

    <!-- Tournament selector trigger -->
    <div class="tournament-trigger" id="tournamentTrigger" style="display:none;"
         onclick="toggleTournamentDropdown()">
      <span class="tournament-trigger-name" id="tournamentTriggerName">Campeonato</span>
      <span class="tournament-trigger-chevron" id="tournamentTriggerChevron">▼</span>
    </div>

    <!-- Tournament dropdown -->
    <div class="tournament-dropdown" id="tournamentDropdown" style="display:none;">
      <div class="dropdown-title">Campeonatos</div>
      <div id="dropdownTorneioList"></div>
      <hr class="dropdown-divider">
      <div class="dropdown-create admin-only" style="display:none;"
           onclick="closeTournamentDropdown(); UI.openModal('modalCreateTournament');">
        <span>+</span> Novo Campeonato
      </div>
    </div>
  </div>

  <!-- Line 2: Nav bar — horizontal navigation (hidden in portal mode) -->
  <div class="header-nav-bar" id="navBar" style="display:none;">
    <nav class="main-nav" id="mainNav">
      <button class="nav-link active" data-nav="home" onclick="UI.navigateTo('home')">Início</button>
      <button class="nav-link inscricoes-only" data-nav="inscricoes" onclick="UI.navigateTo('inscricoes')">Inscrições</button>
      <button class="nav-link" data-nav="times" onclick="UI.navigateTo('times')">Times</button>
      <button class="nav-link" data-nav="classificacao" onclick="UI.navigateTo('classificacao')">Classificação</button>
      <button class="nav-link" data-nav="partidas" onclick="UI.navigateTo('partidas')">Partidas</button>
      <button class="nav-link" data-nav="bracket" onclick="UI.navigateTo('bracket')">Chaveamento</button>
      <button class="nav-link" data-nav="estatisticas" onclick="UI.navigateTo('estatisticas')">Estatísticas</button>
      <button class="nav-link" data-nav="regras" onclick="UI.navigateTo('regras')">Regras</button>
      <button class="nav-link admin-only" data-nav="historico" onclick="UI.navigateTo('historico')">Histórico</button>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Remove the old `btn-trocar-torneio` and `header-badge` elements**

These are replaced by the tournament trigger dropdown.

- [ ] **Step 3: Update `<title>` tag**

```html
<title>Campeonatos AMLabs</title>
```

Already done in previous commit, verify it's still there.

---

### Task 6: CSS — two-line header, dropdown, loading/error states, mobile

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Replace header CSS**

Replace the existing `.site-header` / `.header-inner` styles with two-line layout:

```css
/* ---------------------------------------------------------------
   Header — Two-line layout
   --------------------------------------------------------------- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-surface);
  backdrop-filter: blur(8px);
}

.header-top-bar {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 56px;
  position: relative;
}

.header-nav-bar {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.header-nav-bar .main-nav {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 44px;
  overflow-x: auto;
  scrollbar-width: none;
}

.header-nav-bar .main-nav::-webkit-scrollbar { display: none; }
```

- [ ] **Step 2: Add tournament trigger and dropdown CSS**

```css
/* Tournament trigger */
.tournament-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  transition: all 0.15s;
}

.tournament-trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}

.tournament-trigger-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-trigger-chevron {
  font-size: 0.55rem;
  color: var(--color-text-muted);
}

/* Tournament dropdown */
.tournament-dropdown {
  position: absolute;
  top: 52px;
  left: 24px;
  width: 380px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  z-index: 200;
  padding: 8px;
}

.dropdown-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 12px 6px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.1s;
}

.dropdown-item:hover { background: var(--color-surface); }
.dropdown-item-active { background: var(--color-primary-glow); }

.dropdown-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dropdown-item-name {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item-meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.dropdown-item-badge {
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.badge-configuracao { background: rgba(253,203,110,0.25); color: #e67e22; }
.badge-grupos { background: var(--color-primary-glow); color: var(--color-primary); }
.badge-playoffs { background: var(--color-upper-bg); color: var(--color-upper); }
.badge-encerrado { background: rgba(0,184,148,0.15); color: #00b894; }

.dropdown-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 6px 0;
}

.dropdown-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.dropdown-create:hover { background: var(--color-primary-glow); }
```

- [ ] **Step 3: Add loading and error state CSS**

```css
/* Loading / Error states */
.app-loading-state,
.app-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  gap: 12px;
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-icon { font-size: 2rem; }
.error-title { font-size: 1rem; font-weight: 700; color: var(--color-text); }
.error-message { font-size: 0.85rem; margin-bottom: 8px; }
```

- [ ] **Step 4: Update mobile styles**

```css
@media (max-width: 768px) {
  /* Header compact */
  .header-top-bar { padding: 0 12px; height: 48px; gap: 8px; }
  .logo-text { font-size: 0.8rem; }
  .logo-img { height: 24px; }

  /* Hide nav bar on mobile — replaced by bottom bar */
  .header-nav-bar { display: none !important; }

  /* Tournament trigger compact */
  .tournament-trigger { padding: 4px 8px; gap: 6px; }
  .tournament-trigger-name { max-width: 160px; font-size: 0.72rem; }

  /* Dropdown full-width on mobile */
  .tournament-dropdown {
    left: 8px;
    right: 8px;
    width: auto;
  }

  /* Hide bottom bar in portal mode */
  .portal-mode #mobileBottomBar,
  .portal-mode .mobile-more-overlay { display: none !important; }
}
```

- [ ] **Step 5: Remove old header styles**

Remove the old `.header-inner`, `.header-badge`, `.btn-trocar-torneio`, `.header-tournament-name` CSS rules that are no longer used.

---

### Task 7: Fix audit log rendering (now async)

**Files:**
- Modify: `js/renderers.js`

- [ ] **Step 1: Update `renderHistorico` — async, remove dual-path**

The current `renderHistorico` in `renderers.js` has two branches:
```javascript
if (FirestoreService.isActive()) → load from Firestore directly
else → AppState.loadAuditLog()  // localStorage
```

Remove this dual-path. Since `AppState.loadAuditLog()` now internally delegates to `FirestoreService.loadAuditLog()`, the renderer should just call `AppState.loadAuditLog()`:

```javascript
async function renderHistorico() {
  const container = document.getElementById('historicoBody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="4" style="padding:16px;color:var(--color-text-muted);">Carregando...</td></tr>';

  const logs = await AppState.loadAuditLog();
  if (logs.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="padding:16px;color:var(--color-text-muted);">Nenhum registro de auditoria.</td></tr>';
    return;
  }

  // Render logs — same rendering logic as before, using `logs` array
  container.innerHTML = logs.map(log => {
    const date = new Date(log.timestamp);
    const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<tr>
      <td>${dateStr}</td>
      <td>${UI.escapeHtml(log.usuario || log.device || 'Anônimo')}</td>
      <td>${UI.escapeHtml(log.acao)}</td>
      <td>${log.detalhes ? '<pre style="margin:0;font-size:0.7rem;max-width:200px;overflow:auto;">' + UI.escapeHtml(JSON.stringify(log.detalhes)) + '</pre>' : '—'}</td>
    </tr>`;
  }).join('');
}
```

> **Important:** Verify the exact table structure in the current `renderHistorico` and match it. The code above is a reference — adapt column structure to match what exists.

---

### Task 8: Fix `js/actions.js` — playoff format, importData, exportData

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 1: Verify playoff format selection saves to Firestore**

Search for where the playoff format dropdown `onchange` is handled:

```bash
grep -rn "formato\|onFormatChange\|formatSelect" js/
```

Verify the flow calls `AppState.save()` after setting `state.playoffs.formato`. If not, add a save call.

- [ ] **Step 2: Rewrite `exportData()` — now async (loadAuditLog is async)**

`AppState.loadAuditLog()` is now async (returns a Promise). `exportData()` must await it:

```javascript
async function exportData() {
  const state = AppState.loadReadOnly();
  const auditLog = await AppState.loadAuditLog();

  const exportObj = {
    campeonato: state,
    auditLog: auditLog,
    exportDate: new Date().toISOString(),
    version: '2.0'
  };

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'campeonato-export-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  UI.showToast('Dados exportados!', 'success');
}
```

- [ ] **Step 3: Rewrite `importData()` — save to Firestore instead of localStorage**

The current `importData()` writes directly to localStorage with hardcoded keys. Rewrite to parse JSON and save via `AppState.save()` + `FirestoreService.saveTournament()`:

```javascript
async function importData() {
  if (!UI.checkAdmin()) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      UI.showToast('Arquivo muito grande (máx 5MB)', 'error');
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      const state = data.campeonato || data;
      if (!state.campeonato || !state.times || !state.faseGrupos) {
        UI.showToast('Arquivo inválido: estrutura não reconhecida.', 'error');
        return;
      }

      // Save to in-memory cache and Firestore
      AppState.save(state);
      AppState.invalidateCache();
      UI.showToast('Dados importados!', 'success');

      // Re-render
      const active = document.querySelector('.nav-link.active');
      if (active) {
        const section = active.getAttribute('data-nav');
        if (window.Renderers && window.Renderers[section]) {
          window.Renderers[section]();
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      UI.showToast('Erro ao importar: ' + err.message, 'error');
    }
  };
  input.click();
}
```

### Task 8b: Clean up dead code — `updateHeaderBadge`

**Files:**
- Modify: `js/ui.js`
- Modify: `js/app.js`
- Modify: `js/renderers-home.js`

- [ ] **Step 1: Remove `updateHeaderBadge` from `ui.js`**

The header no longer has a `#headerStatusBadge` element (replaced by the tournament trigger badge). Find and delete the `updateHeaderBadge` function in `ui.js`.

- [ ] **Step 2: Remove calls to `UI.updateHeaderBadge` in other files**

```bash
grep -rn "updateHeaderBadge" js/
```

Remove all calls. These are in:
- `js/app.js` — inside the `UI.navigateTo` wrapper
- `js/renderers-home.js` — at the top of `renderHome()`

Replace with nothing — just delete the call lines.

---

### Task 9: Update `docs/ARCHITECTURE.md`

> **Note:** Task numbering: 8b (header badge cleanup) runs after 8. Tasks 9-10 close out the work.

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update persistence model section**

Replace Section 8 (Fluxo de Dados e Persistência) to describe the new Firestore-only model:

- **Firestore** is the single source of truth
- **In-memory cache** (`_stateCache`) holds state during session
- **sessionStorage** holds `active_tournament_id` only
- **No localStorage** — removed entirely
- **Admin saves:** `AppState.save()` → updates cache + writes to Firestore
- **All users receive:** Firestore `onSnapshot` listener → `feedFromFirestore()` → updates cache → re-renders
- **Failure:** error state shown ("Falha ao carregar")

- [ ] **Step 2: Update header/navigation section**

Document the two-line header layout:
- Line 1: Logo + tournament dropdown trigger
- Line 2: Horizontal nav (desktop only, hidden on mobile)
- Mobile: bottom tab bar replaces nav line

- [ ] **Step 3: Update mobile section**

Add section 16.4 (or similar) documenting:
- Breakpoint: 768px
- Mobile header: compact (48px), no nav bar
- Mobile bottom bar: 5 tabs (Início, Partidas, Tabela, Chaveamento, Mais)
- "Mais" bottom sheet: grid of secondary nav items
- Portal mode hides bottom bar and more overlay

- [ ] **Step 4: Update DDD entity descriptions**

- Remove `edicao` and `temporada` from state entity
- Add `jogo` to `campeonato` in state entity
- Update localStorage key table → remove entirely, note data lives in Firestore only
- Update Firestore doc structure to match `createTournament()` output

---

### Task 10: Commit

- [ ] **Step 1: Stage all modified files**

```bash
git add js/env.js js/state.js js/firestore-service.js js/app.js js/renderers.js js/actions.js js/ui.js js/renderers-home.js index.html css/style.css docs/ARCHITECTURE.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: Firestore-only architecture, two-line header, tournament dropdown, mobile fixes

BREAKING: localStorage removed entirely. Firestore is the single source of truth.

- env.js: remove STORAGE_PREFIX (no longer needed)
- state.js: remove all localStorage reads/writes, in-memory cache fed by feedFromFirestore(), generic DEFAULT_STATE, DDD model fixes (add jogo, remove edicao/temporada), converter alignment
- firestore-service.js: remove localStorage fallbacks, listener syncs for ALL users, add initializeState() for async bootstrap, remove inscricoes localStorage fallback
- app.js: initTournament() async with loading/error states, tournament dropdown open/close, portal mode mobile fixes
- renderers.js: renderHistorico now async
- index.html: two-line header (top bar + nav bar), tournament dropdown HTML
- css/style.css: two-line header, dropdown, loading/error states, mobile portal-mode, responsive dropdown
- ARCHITECTURE.md: document Firestore-only model, two-line header, mobile patterns"
```

- [ ] **Step 3: Push**

```bash
git push origin feat/multi-tournament
```
