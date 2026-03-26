# Delete Tournament + Mobile Admin Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to delete tournaments in `configuracao` status from the landing page, and fix the inaccessible admin login/logout on mobile in both pages.

**Architecture:** The delete feature lives entirely in `portal.js` + `firestore-service.js` — a trash icon appears on eligible cards, opens a confirmation modal, then triggers a Firestore batch delete of the tournament and all its related `inscricoes` and `auditLog` documents. The mobile admin fix in `campeonato.html` is a two-line change (add ID + update `updateAdminUI()`); the landing page fix exposes the existing footer on mobile via a single CSS class.

**Tech Stack:** Vanilla JS, Firebase Firestore compat SDK (batch writes), existing `.modal-overlay` + `.btn-danger` CSS patterns already in `style.css`.

---

## File Map

| File | Change |
|------|--------|
| `campeonato.html` | Add `id="mobileLoginBtn"` to login button in "Mais" sheet |
| `js/auth.js` | `updateAdminUI()` — handle `mobileLoginBtn` + `mobileLogoutBtn` |
| `index.html` | Add `landing-footer` class to `<footer>` + add `#modalDeleteTournament` |
| `css/style.css` | Show `.landing-footer` on mobile + `.selector-card-delete` styles |
| `js/firestore-service.js` | Add `timesCount` to `listTournaments()` + add `deleteTournament(uuid)` |
| `js/portal.js` | Delete icon in card template + `portalRequestDelete()` + `portalExecuteDelete()` |
| `docs/ARCHITECTURE.md` | Document new method, mobile behavior, delete rules |

---

## Task 1: Fix Mobile Admin on `campeonato.html`

**Context:** The "Mais" sheet has a login button with no ID and a logout button (`#mobileLogoutBtn`) that `updateAdminUI()` never references. After login, the login button stays visible and logout stays hidden. Fix: add `id="mobileLoginBtn"`, then handle both in `updateAdminUI()`.

**Files:**
- Modify: `campeonato.html` (line ~654 — mobile login button in "Mais" sheet)
- Modify: `js/auth.js` (line ~68 — `updateAdminUI()`)

- [ ] **Step 1: Add `id="mobileLoginBtn"` to the mobile login button in `campeonato.html`**

Find this block (around line 654):
```html
      <button class="mobile-more-item" onclick="loginAdmin()">
        <span class="mobile-more-icon">&#128274;</span>
        <span>Admin</span>
      </button>
```
Replace with:
```html
      <button class="mobile-more-item" onclick="loginAdmin()" id="mobileLoginBtn">
        <span class="mobile-more-icon">&#128274;</span>
        <span>Admin</span>
      </button>
```

- [ ] **Step 2: Update `updateAdminUI()` in `js/auth.js` to handle mobile buttons**

Replace the entire `updateAdminUI()` function:

```javascript
function updateAdminUI() {
  const adminElements = document.querySelectorAll('.admin-only');
  const visitorElements = document.querySelectorAll('.visitor-only');
  const adminBtn = document.getElementById('adminLoginBtn');
  const adminInfo = document.getElementById('adminInfo');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

  if (isAdmin()) {
    adminElements.forEach(el => el.style.display = '');
    visitorElements.forEach(el => el.style.display = 'none');
    if (adminBtn) adminBtn.style.display = 'none';
    if (adminInfo) {
      adminInfo.style.display = 'flex';
      const emailEl = adminInfo.querySelector('.admin-email');
      if (emailEl) emailEl.textContent = currentUser.email;
    }
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
    if (mobileLogoutBtn) mobileLogoutBtn.style.display = '';
  } else {
    adminElements.forEach(el => el.style.display = 'none');
    visitorElements.forEach(el => el.style.display = '');
    if (adminBtn) adminBtn.style.display = '';
    if (adminInfo) adminInfo.style.display = 'none';
    if (mobileLoginBtn) mobileLoginBtn.style.display = '';
    if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
  }
}
```

- [ ] **Step 3: Verify manually**

Open `campeonato.html` on mobile (DevTools device mode, ≤768px). Open the "Mais" sheet:
- Logged out: "Admin" button visible, "Sair" button hidden ✓
- After login: "Admin" button hidden, "Sair" button visible ✓
- After logout: back to original state ✓

- [ ] **Step 4: Commit**

```bash
git add campeonato.html js/auth.js
git commit -m "fix: mobile admin login/logout buttons reactive in Mais sheet"
```

---

## Task 2: Fix Mobile Admin on `index.html` (Landing)

**Context:** `.site-footer { display: none }` hides the footer globally on mobile. The landing page has no bottom bar or sheet as alternative. The fix: add class `landing-footer` to the footer in `index.html` and override `display: none` for that class in the mobile media query. `updateAdminUI()` already manages `#adminLoginBtn` and `#adminInfo` — no changes needed in JS.

**Files:**
- Modify: `index.html` (line ~90 — `<footer>` tag)
- Modify: `css/style.css` (mobile media query ~line 1980)

- [ ] **Step 1: Add `landing-footer` class to the footer in `index.html`**

Find:
```html
<footer class="site-footer">
```
Replace with:
```html
<footer class="site-footer landing-footer">
```

- [ ] **Step 2: Add CSS override in the mobile media query in `css/style.css`**

Find this rule (inside `@media (max-width: 768px)`, around line 1980):
```css
  /* ----- Footer: hide on mobile (admin goes in "More") ----- */
  .site-footer { display: none; }
```
Replace with:
```css
  /* ----- Footer: hide on mobile (admin goes in "More") ----- */
  .site-footer { display: none; }
  /* Exception: landing page footer stays visible on mobile (no bottom bar there) */
  .landing-footer { display: block; }
```

- [ ] **Step 3: Verify manually**

Open `index.html` on mobile (DevTools ≤768px):
- Footer is visible at the bottom ✓
- "Admin" button shows and triggers Google login ✓
- After login: admin info bar shows, "+ Novo Campeonato" button appears ✓
- Open `campeonato.html` on mobile: footer is still hidden (bottom bar present) ✓

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "fix: show admin login footer on mobile in landing page"
```

---

## Task 3: Add `deleteTournament()` to FirestoreService

**Context:** Deleting a tournament requires cleaning 3 Firestore locations: the `campeonatos/{uuid}` document + all `inscricoes` with `torneiId == uuid` + all `auditLog` with `torneiId == uuid`. Use a single WriteBatch for atomicity. Also add `timesCount` to `listTournaments()` — needed to show team count in the confirmation dialog.

**Files:**
- Modify: `js/firestore-service.js`

- [ ] **Step 1: Add `timesCount` to `listTournaments()` return mapping**

Find the return inside `listTournaments()`:
```javascript
      return snapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().metadata?.nome || 'Campeonato',
        jogo: doc.data().metadata?.jogo || '',
        status: doc.data().metadata?.status || 'configuracao',
        criadoEm: doc.data().metadata?.criadoEm || null
      }));
```
Replace with:
```javascript
      return snapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().metadata?.nome || 'Campeonato',
        jogo: doc.data().metadata?.jogo || '',
        status: doc.data().metadata?.status || 'configuracao',
        criadoEm: doc.data().metadata?.criadoEm || null,
        timesCount: (doc.data().times || []).length
      }));
```

- [ ] **Step 2: Add `deleteTournament(uuid)` method to the `FirestoreService` object**

Add after the `createTournament` method, before the closing `};` of `FirestoreService`:

```javascript
  /**
   * Permanently delete a tournament and all its related data.
   * Cleans: campeonatos/{uuid}, inscricoes (by torneiId), auditLog (by torneiId).
   */
  async deleteTournament(uuid) {
    if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return false;

    try {
      const db = firebase.firestore();
      const batch = db.batch();

      // Delete tournament document
      batch.delete(db.collection(CAMPEONATOS_COLLECTION).doc(uuid));

      // Delete related inscricoes
      const inscricoes = await db.collection(INSCRICOES_COLLECTION)
        .where('torneiId', '==', uuid)
        .get();
      inscricoes.docs.forEach(doc => batch.delete(doc.ref));

      // Delete related auditLog entries
      const auditEntries = await db.collection(AUDIT_COLLECTION)
        .where('torneiId', '==', uuid)
        .get();
      auditEntries.docs.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting tournament:', error);
      return false;
    }
  }
```

- [ ] **Step 3: Verify manually**

In the browser console (on a page that loads `firestore-service.js`):
- `FirestoreService.deleteTournament` should be a function ✓
- Creating a test tournament and calling `deleteTournament(uuid)` should remove the doc from Firestore ✓

- [ ] **Step 4: Commit**

```bash
git add js/firestore-service.js
git commit -m "feat: add deleteTournament() to FirestoreService with batch cleanup"
```

---

## Task 4: Delete Confirmation Modal in `index.html`

**Context:** The modal uses the existing `.modal-overlay` pattern. The title is pink (`var(--color-loss)`) — consistent with `.btn-danger` which also uses that color. The body message is set dynamically by `portal.js`. The confirm button calls `portalExecuteDelete()` (defined in Task 5).

**Files:**
- Modify: `index.html` (add modal before `</body>` close, after existing modal)

- [ ] **Step 1: Add the delete confirmation modal to `index.html`**

Add after the closing `</div>` of `#modalCreateTournament` (around line 85), before the `<!-- FOOTER -->` comment:

```html
<!-- ===============================================================
     MODAL: DELETE TOURNAMENT
     =============================================================== -->
<div class="modal-overlay" id="modalDeleteTournament">
  <div class="modal" style="max-width:400px">
    <div class="modal-header">
      <span class="modal-title" style="color:var(--color-loss)">&#128465; Deletar Campeonato</span>
      <button class="btn-icon" onclick="UI.closeModal('modalDeleteTournament')">&#x2715;</button>
    </div>
    <div class="modal-body">
      <p id="deleteModalMessage" style="line-height:1.6"></p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="UI.closeModal('modalDeleteTournament')">Cancelar</button>
      <button class="btn btn-danger" onclick="portalExecuteDelete()">Deletar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify modal opens and closes**

In DevTools console: `UI.openModal('modalDeleteTournament')` → modal appears. Click overlay or Cancelar → modal closes ✓

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add delete tournament confirmation modal to landing page"
```

---

## Task 5: Delete Icon on Cards + Logic in `portal.js` + CSS

**Context:** The trash icon is injected into `selector-card-right` only when `t.status === 'configuracao'` AND admin is logged in (`UI.checkAdmin()`). `stopPropagation` prevents triggering `portalEnterTournament`. The module-level `_pendingDeleteUuid` holds the UUID between the request and the confirmation click.

**Files:**
- Modify: `js/portal.js`
- Modify: `css/style.css` (add `.selector-card-delete` styles)

- [ ] **Step 1: Add `_pendingDeleteUuid` variable and two new functions to `portal.js`**

After `let _visibleCount = PORTAL_PAGE_SIZE;` (line 8), add:

```javascript
let _pendingDeleteUuid = null;
```

Add these two functions after `portalShowMore()`:

```javascript
function portalRequestDelete(uuid, nome, timesCount) {
  if (!UI.checkAdmin()) return;
  _pendingDeleteUuid = uuid;

  const msg = document.getElementById('deleteModalMessage');
  if (timesCount > 0) {
    const plural = timesCount > 1 ? 's' : '';
    msg.innerHTML = `<strong>${UI.escapeHtml(nome)}</strong> possui <strong>${timesCount} time${plural}</strong> cadastrado${plural}. Esta ação é permanente e não pode ser desfeita.`;
  } else {
    msg.innerHTML = `Deletar <strong>${UI.escapeHtml(nome)}</strong>? Esta ação é permanente e não pode ser desfeita.`;
  }

  UI.openModal('modalDeleteTournament');
}

async function portalExecuteDelete() {
  if (!_pendingDeleteUuid || !UI.checkAdmin()) return;

  const uuid = _pendingDeleteUuid;
  _pendingDeleteUuid = null;
  UI.closeModal('modalDeleteTournament');

  const ok = await FirestoreService.deleteTournament(uuid);
  if (ok) {
    UI.showToast('Campeonato deletado.', 'success');
    _allTournaments = _allTournaments.filter(t => t.id !== uuid);
    portalRenderCards();
  } else {
    UI.showToast('Erro ao deletar campeonato. Tente novamente.', 'error');
  }
}
```

- [ ] **Step 2: Add delete icon to card template in `portalRenderCards()`**

Find the existing card template inside the `.map()` call:

```javascript
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
```

Replace with:

```javascript
  container.innerHTML = visible.map(t => {
    const date = t.criadoEm ? new Date(t.criadoEm).toLocaleDateString('pt-BR') : '';
    const deleteBtn = t.status === 'configuracao' && UI.checkAdmin()
      ? `<button class="selector-card-delete admin-only"
           onclick="event.stopPropagation(); portalRequestDelete('${UI.escapeHtml(t.id)}', '${UI.escapeHtml(t.nome).replace(/'/g, "\\'")}', ${t.timesCount || 0})"
           title="Deletar campeonato">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="3 6 5 6 21 6"></polyline>
             <path d="M19 6l-1 14H6L5 6"></path>
             <path d="M10 11v6M14 11v6"></path>
             <path d="M9 6V4h6v2"></path>
           </svg>
         </button>`
      : '';
    return `
    <div class="selector-card" onclick="portalEnterTournament('${UI.escapeHtml(t.id)}')">
      <div class="selector-card-info">
        <span class="selector-card-name">${UI.escapeHtml(t.nome)}</span>
        <span class="selector-card-meta">${UI.escapeHtml(t.jogo)}${date ? ' · ' + date : ''}</span>
      </div>
      <div class="selector-card-right">
        <span class="badge badge-${UI.escapeHtml(t.status)}">${statusLabel[t.status] || t.status}</span>
        ${deleteBtn}
        <span class="selector-card-arrow">→</span>
      </div>
    </div>`;
  }).join('');
```

- [ ] **Step 3: Export new functions to `window` at the bottom of `portal.js`**

Find the existing exports block:
```javascript
window.portalShowMore = portalShowMore;
window.portalEnterTournament = portalEnterTournament;
window.portalCreateTournament = portalCreateTournament;
```
Replace with:
```javascript
window.portalShowMore = portalShowMore;
window.portalEnterTournament = portalEnterTournament;
window.portalCreateTournament = portalCreateTournament;
window.portalRequestDelete = portalRequestDelete;
window.portalExecuteDelete = portalExecuteDelete;
```

- [ ] **Step 4: Add `.selector-card-delete` styles to `css/style.css`**

After `.selector-card:hover .selector-card-arrow` (around line 2931), add:

```css
.selector-card-delete {
  background: none;
  border: none;
  padding: 6px;
  border-radius: var(--radius);
  color: var(--color-text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.selector-card-delete:hover {
  color: var(--color-loss);
  background: var(--color-loss-bg);
}
```

- [ ] **Step 5: Verify the full flow manually**

As admin on the landing page:
- Card with `configuracao` status shows trash icon ✓
- Card with `grupos`/`playoffs`/`encerrado` shows no trash icon ✓
- Not logged in: no trash icon on any card ✓
- Click trash: confirmation modal opens with correct message ✓
  - With teams: "X possui N time(s) cadastrado(s)..." ✓
  - Without teams: "Deletar X? Esta ação..." ✓
- Click Cancelar: modal closes, list unchanged ✓
- Click Deletar: modal closes, toast "Campeonato deletado.", card disappears from list ✓
- On mobile: trash icon has adequate tap area (6px padding around 14px icon = ~26px total, acceptable) ✓

- [ ] **Step 6: Commit**

```bash
git add js/portal.js css/style.css
git commit -m "feat: delete tournament with confirmation dialog on landing page"
```

---

## Task 6: Update ARCHITECTURE.md

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update Section 6 — add tournament deletion rule**

In Section 6 (Regras de Negócio), after the last subsection, add:

```markdown
### 6.6 Deleção de Campeonato

- Permitida SOMENTE durante `configuracao` (campeonato não iniciado)
- Exclusiva do admin
- Remove permanentemente: documento `campeonatos/{uuid}`, todas as `inscricoes` com `torneiId == uuid`, todos os `auditLog` com `torneiId == uuid`
- Operação atômica via `WriteBatch` do Firestore
- Não há "soft delete" — a ação é irreversível
```

- [ ] **Step 2: Update Section 7.2 — add `portal.js` to module table and update `firestore-service.js`**

In the table in Section 7.2, add a row for `portal.js` and update `firestore-service.js`:

For `firestore-service.js`, append to the Exports column: `, deleteTournament(uuid)`

Add new row:
```
| `portal.js` | Landing page: listar torneios, criar, deletar, paginação | `portalShowMore`, `portalEnterTournament`, `portalCreateTournament`, `portalRequestDelete`, `portalExecuteDelete` |
```

- [ ] **Step 3: Update Section 10.2 — document mobile admin fix**

In Section 10.2 (Controle de UI), update the last bullet:

```markdown
- `updateAdminUI()` em `auth.js` gerencia:
  - Desktop: `#adminLoginBtn` e `#adminInfo` (footer de ambas as páginas)
  - Mobile (`campeonato.html`): `#mobileLoginBtn` e `#mobileLogoutBtn` (sheet "Mais")
  - Mobile (`index.html`): o footer fica visível via classe `.landing-footer` — os mesmos `#adminLoginBtn` e `#adminInfo` do desktop são usados
```

- [ ] **Step 4: Update Section 16.5 — update footer row in mobile table**

Find the footer row in the mobile table:
```
| Footer | Visível | Oculta (admin vai no "Mais") |
```
Replace with:
```
| Footer (`campeonato.html`) | Visível | Oculta (admin vai no "Mais") |
| Footer (`index.html`) | Visível | Visível — classe `.landing-footer` sobrescreve o `display:none` global |
```

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: document delete tournament feature and mobile admin behavior"
```

---

## Verificação Final

Após todas as tasks, verificar:

1. **Mobile `campeonato.html`** — "Mais" sheet: login/logout reagem corretamente ao estado de auth
2. **Mobile `index.html`** — footer visível, botão "Admin" funcional
3. **Delete flow completo** — ícone aparece só em `configuracao` + só para admin; modal correto; Firestore limpo após delete
4. **Não-admin** — nenhum ícone de delete visível em nenhuma condição
5. **Campeonatos não deletáveis** (`grupos`, `playoffs`, `encerrado`) — sem ícone de lixeira
