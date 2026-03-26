# Page Separation — Landing + Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the SPA into two separate HTML pages — `index.html` (clean landing/portal) and `campeonato.html` (tournament dashboard) — so that landing page never shows tournament content and each page has only what it needs.

**Architecture:** `index.html` is a clean landing page: hero, tournament cards (3 + "ver mais"), creation modal, footer with admin login. `campeonato.html` is the current tournament dashboard (all sections, modals, mobile bar). Both share `css/style.css` and common JS (`env.js`, `firebase-config.js`, `auth.js`, `firestore-service.js`, `ui.js`). The landing has its own `portal.js`. The tournament page loads all existing JS. Navigation: card click → `campeonato.html`; logo click → `index.html`.

**Tech Stack:** Vanilla JS, Firebase compat SDK (CDN), no build step.

---

## File Map

| File | Change |
|------|--------|
| `index.html` | **Rewrite** — clean landing page only (hero, cards, modal, footer) |
| `campeonato.html` | **Create** — move all tournament content from old `index.html` |
| `js/portal.js` | **Create** — landing page logic (render cards, "ver mais", create tournament, enter tournament) |
| `js/app.js` | **Modify** — remove portal/selector logic, remove `openTournamentSelector`, remove dropdown; add redirect guard (no sessionStorage → redirect to `index.html`) |
| `js/actions.js` | **Modify** — `enterTournament()` navigates to `campeonato.html` instead of `reload()` |
| `js/renderers.js` | **Modify** — remove `renderSeletor()` (moved to `portal.js`) |
| `css/style.css` | **Modify** — clean up portal-mode CSS (no longer needed), ensure landing styles work standalone |

---

### Task 1: Create `campeonato.html`

**Files:**
- Create: `campeonato.html`

- [ ] **Step 1: Copy current `index.html` to `campeonato.html`**

```bash
cp index.html campeonato.html
```

- [ ] **Step 2: Remove the selector section from `campeonato.html`**

Delete the entire `<section id="sectionSeletor">` block (lines 69-91 approximately). This section belongs only to the landing page.

- [ ] **Step 3: Remove the `modalCreateTournament` from `campeonato.html`**

The creation modal stays in `index.html` only. Delete the entire `<div class="modal-overlay" id="modalCreateTournament">` block. The dropdown in the header has "+ Novo Campeonato" but on `campeonato.html` it should navigate to `index.html` instead of opening a modal.

- [ ] **Step 4: Update the header in `campeonato.html`**

The header keeps the two-line layout (Proposta A) but with these changes:

```html
<header class="site-header">
  <div class="header-top-bar">
    <a class="site-logo" href="index.html" style="cursor:pointer" title="Voltar aos campeonatos">
      <img src="assets/logo-amlabs.png" alt="AMLabs" class="logo-img">
      <span class="logo-text">Campeonatos <span>AMLabs</span></span>
    </a>

    <div class="tournament-trigger" id="tournamentTrigger" onclick="toggleTournamentDropdown()">
      <span class="tournament-trigger-name" id="tournamentTriggerName">Campeonato</span>
      <span class="tournament-trigger-chevron">&#9660;</span>
    </div>

    <div class="tournament-dropdown" id="tournamentDropdown" style="display:none;">
      <div class="dropdown-title">Campeonatos</div>
      <div id="dropdownTorneioList"></div>
      <hr class="dropdown-divider">
      <a class="dropdown-create admin-only" href="index.html">
        <span>+</span> Novo Campeonato
      </a>
      <a class="dropdown-link" href="index.html">Ver todos os campeonatos</a>
    </div>
  </div>

  <div class="header-nav-bar" id="navBar">
    <nav class="main-nav" id="mainNav">
      <!-- same nav links as current, unchanged -->
    </nav>
  </div>
</header>
```

Key changes:
- Logo is a normal `<a href="index.html">` — no JS, no reload, just a link
- Tournament trigger visible by default (no `style="display:none"`)
- Nav bar visible by default (no `style="display:none"`)
- "Novo Campeonato" → `<a href="index.html">` (navigates to landing where modal exists)
- "Ver todos" → `<a href="index.html">`
- Remove `onclick="clearActiveTournamentId()..."` from logo — the landing page handles the sessionStorage check itself

- [ ] **Step 5: Update `<title>` in `campeonato.html`**

Keep `<title>Campeonatos AMLabs</title>` — will be updated dynamically by JS.

- [ ] **Step 6: Remove `btn-new-tournament` button from `campeonato.html`**

This button was in the selector section which is already removed. Verify it's gone.

- [ ] **Step 7: Verify script tags in `campeonato.html`**

The script block stays the same — all JS files loaded. `portal.js` is NOT loaded in `campeonato.html`.

---

### Task 2: Rewrite `index.html` as clean landing page

**Files:**
- Rewrite: `index.html`

- [ ] **Step 1: Write the complete new `index.html`**

The file should contain ONLY:
- `<head>` with same meta, CSS, fonts
- Header: single line, just logo (no trigger, no dropdown, no nav bar)
- Main: hero + tournament list + "Ver mais" button
- Modal: create tournament
- Footer: text + admin login button
- Toast container
- Scripts: only `env.js`, Firebase SDK, `firebase-config.js`, `auth.js`, `firestore-service.js`, `ui.js`, `portal.js`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campeonatos AMLabs</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚽</text></svg>">
  <link rel="stylesheet" href="css/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>

<header class="site-header">
  <div class="header-top-bar">
    <a class="site-logo" href="index.html">
      <img src="assets/logo-amlabs.png" alt="AMLabs" class="logo-img">
      <span class="logo-text">Campeonatos <span>AMLabs</span></span>
    </a>
  </div>
</header>

<main class="main-content">
  <div class="container">
    <div class="selector-hero">
      <img src="assets/logo-amlabs.png" alt="AMLabs" class="selector-hero-logo">
      <h1 class="selector-title">Campeonatos AMLabs</h1>
      <p class="selector-subtitle">Organize e acompanhe os campeonatos internos da empresa</p>
    </div>

    <div class="selector-section-header">
      <h2 class="selector-section-title">Campeonatos</h2>
      <button class="btn btn-primary btn-new-tournament admin-only"
        onclick="UI.openModal('modalCreateTournament')">+ Novo Campeonato</button>
    </div>

    <div id="portalTorneioList" class="selector-list">
      <!-- Rendered by portal.js -->
    </div>

    <div id="portalVerMais" style="display:none; text-align:center; margin-top:16px;">
      <button class="btn btn-secondary" onclick="portalShowMore()">Ver mais campeonatos</button>
    </div>
  </div>
</main>

<!-- Modal: Create Tournament -->
<div class="modal-overlay" id="modalCreateTournament">
  <div class="modal" style="max-width:460px">
    <div class="modal-header">
      <span class="modal-title">Novo Campeonato</span>
      <button class="btn-icon" onclick="UI.closeModal('modalCreateTournament')">&#x2715;</button>
    </div>
    <div class="modal-body">
      <form id="formCreateTournament" onsubmit="portalCreateTournament(event)">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label">Nome do campeonato *</label>
            <input class="form-input" type="text" id="inputTournamentNome"
              placeholder="Ex: 2&ordm; Campeonato EA Sports FC AMLabs 2027"
              maxlength="100" required>
          </div>
          <div class="form-group">
            <label class="form-label">Jogo *</label>
            <input class="form-input" type="text" id="inputTournamentJogo"
              placeholder="Ex: EA Sports FC" maxlength="60" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" onclick="UI.closeModal('modalCreateTournament')">Cancelar</button>
          <button class="btn btn-primary" type="submit">Criar</button>
        </div>
      </form>
    </div>
  </div>
</div>

<footer class="site-footer">
  <div class="footer-inner">
    <span class="footer-text">Campeonatos AMLabs</span>
    <div class="footer-admin">
      <button id="adminLoginBtn" class="btn-admin-login" onclick="loginAdmin()">&#128274; Admin</button>
      <div id="adminInfo" style="display:none" class="admin-info-bar">
        <span class="admin-email"></span>
        <button class="btn-admin-logout" onclick="logoutAdmin()">Sair</button>
      </div>
    </div>
  </div>
</footer>

<div class="toast-container" id="toastContainer"></div>

<!-- Scripts: only what the landing needs -->
<script src="js/env.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="js/firebase-config.js"></script>
<script src="js/auth.js"></script>
<script src="js/firestore-service.js"></script>
<script src="js/ui.js"></script>
<script src="js/portal.js"></script>

</body>
</html>
```

> **Note:** No `state.js`, `playoff-formats.js`, `renderers*.js`, `actions.js`, `app.js` — these are tournament-only.

---

### Task 3: Create `js/portal.js`

**Files:**
- Create: `js/portal.js`

- [ ] **Step 1: Write the complete file**

```javascript
/**
 * Portal — Campeonatos AMLabs
 * Landing page logic: list tournaments, "ver mais", create tournament.
 */

const PORTAL_PAGE_SIZE = 3;
let _allTournaments = [];
let _visibleCount = PORTAL_PAGE_SIZE;

async function portalRenderList() {
  const container = document.getElementById('portalTorneioList');
  if (!container) return;

  container.innerHTML = '<p class="selector-loading">Carregando campeonatos...</p>';

  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    _allTournaments = await FirestoreService.listTournaments();
  } else {
    _allTournaments = [];
  }

  _visibleCount = PORTAL_PAGE_SIZE;
  portalRenderCards();
}

function portalRenderCards() {
  const container = document.getElementById('portalTorneioList');
  const btnVerMais = document.getElementById('portalVerMais');
  if (!container) return;

  if (_allTournaments.length === 0) {
    container.innerHTML = `
      <div class="selector-empty-state">
        <div class="selector-empty-icon">🏆</div>
        <p class="selector-empty-title">Nenhum campeonato criado ainda</p>
        <p class="selector-empty-text">Faça login como administrador para criar o primeiro campeonato.</p>
      </div>`;
    if (btnVerMais) btnVerMais.style.display = 'none';
    return;
  }

  const statusLabel = {
    configuracao: 'Inscrições abertas',
    grupos: 'Fase de Grupos',
    playoffs: 'Playoffs',
    encerrado: 'Encerrado'
  };

  const visible = _allTournaments.slice(0, _visibleCount);

  container.innerHTML = visible.map(t => {
    const date = t.criadoEm ? new Date(t.criadoEm).toLocaleDateString('pt-BR') : '';
    return `
    <div class="selector-card" onclick="portalEnterTournament('${UI.escapeHtml(t.id)}')">
      <div class="selector-card-info">
        <span class="selector-card-name">${UI.escapeHtml(t.nome)}</span>
        <span class="selector-card-meta">${UI.escapeHtml(t.jogo)}${date ? ' · ' + date : ''}</span>
      </div>
      <div class="selector-card-right">
        <span class="badge badge-${UI.escapeHtml(t.status)}">${statusLabel[t.status] || t.status}</span>
        <span class="selector-card-arrow">→</span>
      </div>
    </div>`;
  }).join('');

  if (btnVerMais) {
    btnVerMais.style.display = _visibleCount < _allTournaments.length ? '' : 'none';
  }
}

function portalShowMore() {
  _visibleCount += PORTAL_PAGE_SIZE;
  portalRenderCards();
}

function portalEnterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.href = 'campeonato.html';
}

async function portalCreateTournament(event) {
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
  portalEnterTournament(uuid);
}

// Boot
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
  portalRenderList();
});

window.portalShowMore = portalShowMore;
window.portalEnterTournament = portalEnterTournament;
window.portalCreateTournament = portalCreateTournament;
```

---

### Task 4: Update `js/app.js` — remove portal logic, add redirect guard

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Remove all portal/selector functions**

Delete these functions entirely:
- `openTournamentSelector()` and its `window.openTournamentSelector` export
- `openTournamentDropdown()`, `closeTournamentDropdown()`, `toggleTournamentDropdown()` and their window exports
- The `document.addEventListener('click', ...)` handler for closing dropdown outside

These move to `portal.js` (card rendering) or stay simplified in `app.js` (dropdown for `campeonato.html`).

- [ ] **Step 2: Add redirect guard at the top of DOMContentLoaded**

If no tournament is in sessionStorage, redirect to `index.html`:

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

  // No tournament selected → redirect to landing
  if (!getActiveTournamentId()) {
    window.location.href = 'index.html';
    return;
  }

  initTournament();
});
```

- [ ] **Step 3: Keep dropdown functions for `campeonato.html`**

The tournament dropdown still exists in `campeonato.html` header. Keep `toggleTournamentDropdown`, `openTournamentDropdown`, `closeTournamentDropdown` but update `enterTournament`:

In the dropdown rendering, clicking a tournament calls `enterTournament(uuid)`. Update it to navigate:

```javascript
function enterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.href = 'campeonato.html';
}
```

Wait — this function is in `actions.js`. Update there instead.

- [ ] **Step 4: Remove `body.portal-mode` class toggling**

Delete all references to `portal-mode` class in `app.js` — no longer needed since portal is a separate page.

---

### Task 5: Update `js/actions.js` — enterTournament navigates

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 1: Update `enterTournament()`**

```javascript
function enterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.href = 'campeonato.html';
}
```

- [ ] **Step 2: Remove `submitCreateTournament()`**

This function is now `portalCreateTournament()` in `portal.js`. Remove it from `actions.js` and its `window.submitCreateTournament` export.

> **Note:** The `campeonato.html` dropdown has "Novo Campeonato" as a link to `index.html`, so no modal is needed in `campeonato.html`.

---

### Task 6: Update `js/renderers.js` — remove `renderSeletor`

**Files:**
- Modify: `js/renderers.js`

- [ ] **Step 1: Remove `renderSeletor()` function and its window export**

Delete the entire `renderSeletor` function and `window.renderSeletor = renderSeletor;` line.

- [ ] **Step 2: Remove `seletor` from `window.Renderers` object**

```javascript
window.Renderers = {
  // seletor: renderSeletor,  ← DELETE this line
  home: renderHome,
  // ... rest unchanged
};
```

---

### Task 7: Clean up CSS — remove portal-mode rules

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Remove all `.portal-mode` CSS rules**

Delete all rules that reference `.portal-mode` — this class no longer exists since portal is a separate page:

```css
/* DELETE all of these: */
.portal-mode .section:not(#sectionSeletor) { ... }
.portal-mode #lifecycleBar { ... }
.portal-mode .header-nav-bar { ... }
.portal-mode #mobileBottomBar { ... }
.portal-mode .mobile-more-overlay { ... }
.portal-mode .site-footer { ... }
```

- [ ] **Step 2: Verify selector styles still work**

The `.selector-*` CSS classes are still used by `portal.js` in `index.html`. Verify these styles remain:
- `.selector-hero`, `.selector-hero-logo`, `.selector-title`, `.selector-subtitle`
- `.selector-section-header`, `.selector-section-title`
- `.selector-list`, `.selector-card`, `.selector-card-*`
- `.selector-empty-state`, `.selector-empty-*`
- `.badge`, `.badge-configuracao`, `.badge-grupos`, `.badge-playoffs`, `.badge-encerrado`

- [ ] **Step 3: Remove `.btn-new-tournament` inline `style="display:none"`**

In the new `index.html`, the button should NOT have `style="display:none;"`. The `.admin-only` class handles visibility via `updateAdminUI()`. Verify this in the HTML from Task 2.

---

### Task 8: Update `js/app.js` — keep dropdown for `campeonato.html`

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Keep simplified dropdown functions**

The dropdown in `campeonato.html` header needs these functions. Keep them in `app.js` but simplified:

```javascript
async function openTournamentDropdown() {
  const dropdown = document.getElementById('tournamentDropdown');
  if (!dropdown) return;
  dropdown.style.display = 'block';

  const listContainer = document.getElementById('dropdownTorneioList');
  if (!listContainer) return;
  listContainer.innerHTML = '<p style="padding:8px 12px;font-size:0.8rem;color:var(--color-text-muted);">Carregando...</p>';

  const activeId = getActiveTournamentId();
  let torneiros = [];
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    torneiros = await FirestoreService.listTournaments();
  }

  const statusLabel = { configuracao: 'Inscrições', grupos: 'Grupos', playoffs: 'Playoffs', encerrado: 'Encerrado' };
  const statusClass = { configuracao: 'badge-configuracao', grupos: 'badge-grupos', playoffs: 'badge-playoffs', encerrado: 'badge-encerrado' };

  if (torneiros.length === 0) {
    listContainer.innerHTML = '<p style="padding:8px 12px;font-size:0.8rem;color:var(--color-text-muted);">Nenhum campeonato.</p>';
    return;
  }

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

function toggleTournamentDropdown() {
  const dropdown = document.getElementById('tournamentDropdown');
  if (!dropdown) return;
  dropdown.style.display === 'block' ? closeTournamentDropdown() : openTournamentDropdown();
}

window.toggleTournamentDropdown = toggleTournamentDropdown;
window.closeTournamentDropdown = closeTournamentDropdown;

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('tournamentDropdown');
  const trigger = document.getElementById('tournamentTrigger');
  if (dropdown && dropdown.style.display === 'block') {
    if (!dropdown.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
      closeTournamentDropdown();
    }
  }
});
```

- [ ] **Step 2: Simplify `initTournament()` — remove portal-mode references**

Remove `document.body.classList.remove('portal-mode')` and any code that shows/hides elements that only exist in `index.html` (like `sectionSeletor`).

The nav bar and tournament trigger are visible by default in `campeonato.html` HTML (no `style="display:none"`), so `initTournament()` doesn't need to show them.

---

### Task 9: Verify and test

- [ ] **Step 1: Verify no broken references**

```bash
grep -rn "sectionSeletor\|openTournamentSelector\|portal-mode\|submitCreateTournament" js/ index.html campeonato.html
```

Expected: `sectionSeletor` only in `index.html`. `openTournamentSelector` nowhere. `portal-mode` nowhere. `submitCreateTournament` nowhere (replaced by `portalCreateTournament` in `portal.js`).

- [ ] **Step 2: Verify `index.html` loads only portal scripts**

Check that `index.html` does NOT load `state.js`, `playoff-formats.js`, `renderers*.js`, `actions.js`, `app.js`.

- [ ] **Step 3: Verify `campeonato.html` does NOT load `portal.js`**

- [ ] **Step 4: Verify navigation flows**

1. Open `index.html` → landing page, no tournament content
2. Click card → navigates to `campeonato.html`, tournament loads
3. Click logo in `campeonato.html` → navigates to `index.html`
4. Open `campeonato.html` directly without sessionStorage → redirects to `index.html`
5. Dropdown in `campeonato.html` → switch tournament → reloads with new UUID
6. Dropdown "Ver todos" → navigates to `index.html`
7. "Ver mais" on landing → shows 3 more cards

---

### Task 10: Commit and push

- [ ] **Step 1: Stage all files**

```bash
git add index.html campeonato.html js/portal.js js/app.js js/actions.js js/renderers.js css/style.css
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: split into index.html (landing) + campeonato.html (dashboard)

BREAKING: SPA split into two separate HTML pages.

- index.html: clean landing page — hero, tournament cards (3 + ver mais),
  creation modal, footer with admin login. Loads only portal.js + shared JS.
- campeonato.html: full tournament dashboard — all sections, modals, mobile bar.
  Loads all existing JS. Redirect guard if no tournament in sessionStorage.
- portal.js: new — landing page logic (render cards, pagination, create tournament)
- app.js: remove portal/selector logic, add redirect guard, keep dropdown
- actions.js: enterTournament() navigates to campeonato.html
- renderers.js: remove renderSeletor (moved to portal.js)
- style.css: remove portal-mode CSS (no longer needed)"
```

- [ ] **Step 3: Push**

```bash
git push origin feat/multi-tournament
```
