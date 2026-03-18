# Public Team Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow anonymous visitors to request team registration; admin approves/rejects requests.

**Architecture:** New Firestore collection `inscricoes/{auto-id}` stores pending requests. Anonymous users see a public registration form (same fields as admin: nome, abreviacao, cor). Admin sees a pending requests panel with approve/reject buttons. Approved teams are moved to the tournament's `times[]` array. Registration is blocked when tournament status != `configuracao`.

**Tech Stack:** Firebase Firestore (anonymous write to `inscricoes/`), existing HTML/CSS/JS stack.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `firestore.rules` | Modify | Add `inscricoes/` collection: anyone can create, only admin can update/delete |
| `js/firestore-service.js` | Modify | Add CRUD for inscricoes collection |
| `js/state.js` | Modify | Add local inscricoes helpers |
| `js/actions.js` | Modify | Add `submitPublicRegistration()`, `approveRegistration()`, `rejectRegistration()` |
| `js/renderers.js` | Modify | Add `renderInscricoes()` for public list + form, `renderPendingRegistrations()` for admin |
| `index.html` | Modify | Add "Inscricao" nav item + section with form and list |
| `css/style.css` | Modify | Add styles for registration cards and status badges |

---

## Firestore Rules Update

Inscricoes collection needs special rules — anyone can create (even without login), but only admin can approve/reject (update/delete):

```
match /inscricoes/{entry} {
  allow create: if true;
  allow read: if true;
  allow update, delete: if request.auth != null
                        && request.auth.token.email == "vonah.dev@gmail.com";
}
```

---

## Data Model

```json
// inscricoes/{auto-id}
{
  "torneiId": "amlabs-2026",
  "nome": "Real Madras",
  "abreviacao": "RMA",
  "cor": "#6c5ce7",
  "status": "pendente",        // pendente | aprovado | rejeitado
  "criadoEm": "2026-03-18T...",
  "device": "PC-A3F2B1C0",
  "resolvidoEm": null,
  "resolvidoPor": null
}
```

---

## Tasks

### Task 1: Firestore Rules — allow public writes to inscricoes

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add inscricoes rules**

Add before the closing braces in `firestore.rules`:

```
match /inscricoes/{entry} {
  allow create: if true;
  allow read: if true;
  allow update, delete: if request.auth != null
                        && request.auth.token.email == "vonah.dev@gmail.com";
}
```

- [ ] **Step 2: Publish rules in Firebase Console**

Copy the updated rules to Firebase Console > Firestore > Rules > Publish.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add firestore rules for public registration"
```

---

### Task 2: FirestoreService — inscricoes CRUD

**Files:**
- Modify: `js/firestore-service.js`

- [ ] **Step 1: Add inscricoes constants and methods to FirestoreService**

Add to `FirestoreService` object:

```javascript
const INSCRICOES_COLLECTION = 'inscricoes';

// Inside FirestoreService:

async submitRegistration(data) {
  // Works without auth — anyone can create
  if (!FIREBASE_CONFIGURED) {
    // localStorage fallback
    const key = 'campeonato_amlabs_inscricoes_v1';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = {
      id: 'insc_' + Date.now(),
      torneiId: TOURNAMENT_ID,
      ...data,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      device: typeof getDeviceId === 'function' ? getDeviceId() : 'local',
      resolvidoEm: null,
      resolvidoPor: null
    };
    list.push(entry);
    localStorage.setItem(key, JSON.stringify(list));
    return entry;
  }

  const entry = {
    torneiId: TOURNAMENT_ID,
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
  if (!FIREBASE_CONFIGURED) {
    const key = 'campeonato_amlabs_inscricoes_v1';
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  const snapshot = await firebase.firestore()
    .collection(INSCRICOES_COLLECTION)
    .where('torneiId', '==', TOURNAMENT_ID)
    .orderBy('criadoEm', 'desc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
},

async updateRegistration(id, data) {
  if (!FIREBASE_CONFIGURED) {
    const key = 'campeonato_amlabs_inscricoes_v1';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) Object.assign(list[idx], data);
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }
  await firebase.firestore().collection(INSCRICOES_COLLECTION).doc(id).update(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/firestore-service.js
git commit -m "feat: add inscricoes CRUD to FirestoreService"
```

---

### Task 3: Actions — public registration + admin approve/reject

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 1: Add submitPublicRegistration()**

```javascript
async function submitPublicRegistration() {
  const nome = UI.getFormValue('inputInscNome');
  let abrev = UI.getFormValue('inputInscAbrev');
  const cor = document.getElementById('inputInscCor')
    ? document.getElementById('inputInscCor').value
    : UI.getRandomColor();

  if (!nome) {
    UI.showToast('Informe o nome do time.', 'error');
    return;
  }
  if (!abrev) {
    abrev = nome.replace(/[aeiouAEIOU\s]/g, '').slice(0, 3).toUpperCase()
      || nome.slice(0, 3).toUpperCase();
  }

  const state = AppState.load();
  if (state.campeonato.status !== 'configuracao') {
    UI.showToast('Inscricoes encerradas. O campeonato ja comecou.', 'error');
    return;
  }

  // Check duplicates in existing teams and pending registrations
  const registrations = await FirestoreService.loadRegistrations();
  const allNames = [
    ...state.times.map(t => t.nome.toLowerCase()),
    ...registrations.filter(r => r.status === 'pendente').map(r => r.nome.toLowerCase())
  ];
  if (allNames.includes(nome.toLowerCase())) {
    UI.showToast('Ja existe um time ou solicitacao com esse nome.', 'error');
    return;
  }

  await FirestoreService.submitRegistration({
    nome,
    abreviacao: abrev.toUpperCase().slice(0, 4),
    cor
  });

  UI.clearForm('inputInscNome', 'inputInscAbrev');
  const colorInput = document.getElementById('inputInscCor');
  if (colorInput) colorInput.value = '#6c5ce7';

  UI.showToast('Solicitacao enviada! Aguarde aprovacao do administrador.', 'success');
  Renderers.inscricoes();
}
```

- [ ] **Step 2: Add approveRegistration() and rejectRegistration()**

```javascript
async function approveRegistration(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    UI.showToast('Apenas o admin pode aprovar.', 'error');
    return;
  }

  const registrations = await FirestoreService.loadRegistrations();
  const reg = registrations.find(r => r.id === id);
  if (!reg) return;

  // Add to tournament teams
  const state = AppState.load();
  AppState.addTime(state, { nome: reg.nome, abreviacao: reg.abreviacao, cor: reg.cor });
  AppState.save(state);

  // Update registration status
  await FirestoreService.updateRegistration(id, {
    status: 'aprovado',
    resolvidoEm: new Date().toISOString(),
    resolvidoPor: currentUser ? currentUser.email : 'admin'
  });

  AppState.addAuditLog(
    currentUser ? currentUser.email : getDeviceId(),
    'Aprovou inscricao: ' + reg.nome
  );

  UI.showToast('Time "' + reg.nome + '" aprovado e adicionado!', 'success');
  Renderers.inscricoes();
  Renderers.times();
}

async function rejectRegistration(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    UI.showToast('Apenas o admin pode rejeitar.', 'error');
    return;
  }

  const registrations = await FirestoreService.loadRegistrations();
  const reg = registrations.find(r => r.id === id);
  if (!reg) return;

  await FirestoreService.updateRegistration(id, {
    status: 'rejeitado',
    resolvidoEm: new Date().toISOString(),
    resolvidoPor: currentUser ? currentUser.email : 'admin'
  });

  AppState.addAuditLog(
    currentUser ? currentUser.email : getDeviceId(),
    'Rejeitou inscricao: ' + reg.nome
  );

  UI.showToast('Inscricao de "' + reg.nome + '" rejeitada.', 'info');
  Renderers.inscricoes();
}
```

- [ ] **Step 3: Commit**

```bash
git add js/actions.js
git commit -m "feat: add public registration and admin approve/reject actions"
```

---

### Task 4: Renderers — inscricoes page

**Files:**
- Modify: `js/renderers.js`

- [ ] **Step 1: Add renderInscricoes()**

This function renders:
- **For everyone:** list of approved teams + list of pending requests (read-only)
- **For admin:** approve/reject buttons on pending requests
- **Public form:** visible to everyone when status === 'configuracao'
- **Blocked message:** when campeonato already started

```javascript
async function renderInscricoes() {
  const state = AppState.load();
  const container = document.getElementById('inscricoesContainer');
  if (!container) return;

  const registrations = await FirestoreService.loadRegistrations();
  const pendentes = registrations.filter(r => r.status === 'pendente');
  const aprovados = registrations.filter(r => r.status === 'aprovado');
  const rejeitados = registrations.filter(r => r.status === 'rejeitado');
  const isOpen = state.campeonato.status === 'configuracao';
  const admin = typeof isAdmin === 'function' && isAdmin();

  let html = '';

  // Status banner
  if (isOpen) {
    html += '<div style="background:var(--color-win-bg);border:1px solid rgba(0,184,148,0.3);border-radius:var(--radius);padding:12px 16px;margin-bottom:24px;font-size:.875rem;color:var(--color-win);font-weight:600;display:flex;align-items:center;gap:8px"><span>&#9989;</span> Inscricoes abertas! Cadastre seu time abaixo.</div>';
  } else {
    html += '<div style="background:var(--color-loss-bg);border:1px solid rgba(232,67,147,0.3);border-radius:var(--radius);padding:12px 16px;margin-bottom:24px;font-size:.875rem;color:var(--color-loss);font-weight:600;display:flex;align-items:center;gap:8px"><span>&#128683;</span> Inscricoes encerradas. O campeonato ja comecou.</div>';
  }

  // Pending requests (admin sees approve/reject, visitors see status)
  if (pendentes.length > 0) {
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-yellow">&#9203;</span> Aguardando Aprovacao (' + pendentes.length + ')</h3></div>';
    html += '<div class="matches-grid mb-24">';
    html += pendentes.map(r => renderRegistrationCard(r, 'pendente', admin)).join('');
    html += '</div>';
  }

  // Approved teams
  if (aprovados.length > 0 || state.times.length > 0) {
    const total = state.times.length;
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-green">&#9989;</span> Times Inscritos (' + total + ')</h3></div>';
    html += '<div class="teams-grid mb-24">';
    html += state.times.map(t => '<div class="team-card"><div style="display:flex;align-items:center;gap:12px">' + UI.renderAvatar(t, 36) + '<div><div class="team-card-name">' + t.nome + '</div><div class="team-card-abbr">' + t.abreviacao + '</div></div></div></div>').join('');
    html += '</div>';
  }

  // Rejected (only admin sees)
  if (admin && rejeitados.length > 0) {
    html += '<div class="section-header"><h3 class="section-title" style="font-size:.9rem;color:var(--color-text-dim)">Rejeitados (' + rejeitados.length + ')</h3></div>';
    html += '<div class="matches-grid mb-24">';
    html += rejeitados.map(r => renderRegistrationCard(r, 'rejeitado', false)).join('');
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderRegistrationCard(r, status, showActions) {
  const statusColors = {
    pendente: { bg: 'var(--color-draw-bg)', color: '#b8860b', border: 'rgba(253,203,110,0.4)', label: 'Aguardando' },
    aprovado: { bg: 'var(--color-win-bg)', color: 'var(--color-win)', border: 'rgba(0,184,148,0.3)', label: 'Aprovado' },
    rejeitado: { bg: 'var(--color-loss-bg)', color: 'var(--color-loss)', border: 'rgba(232,67,147,0.3)', label: 'Rejeitado' }
  };
  const s = statusColors[status];
  const avatar = { nome: r.nome, abreviacao: r.abreviacao, cor: r.cor };

  return '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:14px 18px;display:flex;align-items:center;gap:14px">'
    + UI.renderAvatar(avatar, 36)
    + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.9rem">' + r.nome + '</div><div style="font-size:.75rem;color:var(--color-text-dim)">' + r.abreviacao + ' &bull; ' + new Date(r.criadoEm).toLocaleDateString('pt-BR') + '</div></div>'
    + '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:10px;background:' + s.bg + ';color:' + s.color + ';border:1px solid ' + s.border + '">' + s.label + '</span>'
    + (showActions ? '<button class="btn btn-sm btn-success" onclick="approveRegistration(\'' + r.id + '\')" style="margin-left:4px">Aprovar</button><button class="btn btn-sm btn-secondary" onclick="rejectRegistration(\'' + r.id + '\')" style="margin-left:4px">Rejeitar</button>' : '')
    + '</div>';
}
```

- [ ] **Step 2: Register in Renderers export**

Add `inscricoes: renderInscricoes` to `window.Renderers`.

- [ ] **Step 3: Commit**

```bash
git add js/renderers.js
git commit -m "feat: add inscricoes renderer with public list and admin controls"
```

---

### Task 5: HTML — inscricoes section + nav

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add nav button**

After the "Times" nav button, add:

```html
<button class="nav-link" data-nav="inscricoes" onclick="UI.navigateTo('inscricoes')">Inscri&ccedil;&otilde;es</button>
```

- [ ] **Step 2: Add section**

After section-times closing tag, add:

```html
<section id="section-inscricoes" class="page-section">
  <div class="section-header">
    <h2 class="section-title">
      <span class="section-title-icon icon-bg-purple">&#128221;</span>
      Inscri&ccedil;&otilde;es
    </h2>
  </div>

  <div class="manage-layout">
    <div id="inscricoesContainer"></div>

    <!-- Public registration form -->
    <div class="card" id="inscricaoFormCard" style="position:sticky;top:80px">
      <div class="card-header">
        <span class="card-title">Inscrever meu Time</span>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="form-group">
            <label class="form-label" for="inputInscNome">Nome do Time *</label>
            <input class="form-input" type="text" id="inputInscNome" placeholder="Ex: Real Madras"
              onkeydown="if(event.key==='Enter')submitPublicRegistration()">
          </div>
          <div class="form-group">
            <label class="form-label" for="inputInscAbrev">Abrevia&ccedil;&atilde;o (3-4 letras)</label>
            <input class="form-input" type="text" id="inputInscAbrev" placeholder="Ex: RMA" maxlength="4"
              style="text-transform:uppercase"
              onkeydown="if(event.key==='Enter')submitPublicRegistration()">
          </div>
          <div class="form-group">
            <label class="form-label">Cor do Time</label>
            <div class="color-picker-wrapper">
              <input type="color" id="inputInscCor" value="#6c5ce7">
              <span style="font-size:.8rem;color:var(--color-text-muted)">Escolha a cor do escudo</span>
            </div>
          </div>
          <button class="btn btn-primary w-full" onclick="submitPublicRegistration()">Enviar Inscri&ccedil;&atilde;o</button>
          <p style="font-size:.75rem;color:var(--color-text-dim);text-align:center;margin-top:-4px">Sua inscri&ccedil;&atilde;o ser&aacute; analisada pelo administrador</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Add 'inscricoes' to VALID_SECTIONS array**

In the inline script, add `'inscricoes'` to the VALID_SECTIONS array.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add inscricoes section and navigation"
```

---

### Task 6: Integration — admin direct add skips approval

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 1: Ensure admin's submitAddTime() in Times page continues working without approval**

No changes needed — `submitAddTime()` already adds directly to `state.times[]`. This is the intended behavior: admin adds skip approval.

- [ ] **Step 2: Hide public form when campeonato started**

In `renderInscricoes()`, hide the form card when `state.campeonato.status !== 'configuracao'`:

Add at the end of `renderInscricoes()`:
```javascript
const formCard = document.getElementById('inscricaoFormCard');
if (formCard) {
  formCard.style.display = isOpen ? '' : 'none';
}
```

- [ ] **Step 3: Commit**

```bash
git add js/renderers.js js/actions.js
git commit -m "feat: hide registration form when tournament started"
```

---

### Task 7: Final commit and push

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/public-registration
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "feat: public team registration with admin approval" --body "..."
```
