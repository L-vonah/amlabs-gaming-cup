# Phase 1: Critical Fixes & Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs that affect tournament integrity, improve UX with quick wins, and remove dead code.

**Architecture:** All changes in existing files. No restructuring. Focus on correctness and polish.

**Tech Stack:** Vanilla JS, Firebase Firestore, HTML/CSS

---

## File Map

| File | Changes |
|------|---------|
| `js/state.js` | Fix confronto direto, add playoff reset propagation, add state cache |
| `js/renderers.js` | Fix bracket mobile, add stats with playoffs, add loading states, remove potes renderer |
| `js/actions.js` | Add confirmation modal, fix score validation, remove potes action |
| `js/firestore-service.js` | Fix Firestore sync (listener updates localStorage) |
| `js/ui.js` | Remove toggleMobileMenu reference |
| `index.html` | Remove registrar section/nav, remove potes config, add confirm modal, fix mobile bracket, fix hamburger button |
| `css/style.css` | Mobile bracket styles, loading spinner |

---

### Task 1: Remove dead code (registrar page, potes config, hamburger button)

**Files:**
- Modify: `index.html`
- Modify: `js/renderers.js`
- Modify: `js/actions.js`

- [ ] **Step 1: Remove section-registrar from index.html**

Delete the entire `<section id="section-registrar">` block and its contents (the tab bar, gruposFormContainer, playoffResultsContainer).

- [ ] **Step 2: Remove 'registrar' from VALID_SECTIONS array in index.html**

Change the array to remove `'registrar'`.

- [ ] **Step 3: Remove switchResultTab function and its override from index.html boot script**

Delete the `switchResultTab` function and the `_origRenderRegistrar` override block.

- [ ] **Step 4: Remove potesConfigContainer HTML from regras section in index.html**

The potes config card was already removed in a prior PR. Verify it's gone. If any references remain, remove them.

- [ ] **Step 5: Remove renderPotesConfig function from renderers.js**

Delete `renderPotesConfig` function and remove the call from `renderRegras`.

- [ ] **Step 6: Remove savePotesConfig from actions.js**

Delete the `savePotesConfig` function.

- [ ] **Step 7: Remove the hamburger button from header in index.html**

Delete the `<button class="mobile-menu-toggle" id="mobileMenuToggle" onclick="toggleMobileMenu()">` element.

- [ ] **Step 8: Commit**

```bash
git add index.html js/renderers.js js/actions.js
git commit -m "chore: remove dead code — registrar page, potes config, hamburger button"
```

---

### Task 2: Fix Firestore sync — visitor sees real data

**Files:**
- Modify: `js/firestore-service.js`
- Modify: `js/state.js`

- [ ] **Step 1: Update startListener in firestore-service.js**

When Firestore data arrives via onSnapshot, convert it to legacy format and save to localStorage so that `AppState.load()` returns fresh data for all visitors:

```javascript
// In startListener callback:
_firestoreListenerUnsubscribe = docRef.onSnapshot((doc) => {
  if (doc.exists) {
    _firestoreCache = doc.data();
    // Sync to localStorage so AppState.load() returns fresh data
    const legacyState = window.AppState && window.AppState.convertFirestoreToState
      ? window.AppState.convertFirestoreToState(_firestoreCache)
      : null;
    if (legacyState) {
      localStorage.setItem('campeonato_amlabs_v1', JSON.stringify(legacyState));
    }
  } else {
    _firestoreCache = null;
  }
  if (onUpdate) onUpdate(_firestoreCache);
}, (error) => {
  console.error('Firestore listener error:', error);
});
```

- [ ] **Step 2: Add state cache to state.js to avoid repeated JSON.parse**

Add a simple in-memory cache that invalidates on save:

```javascript
let _stateCache = null;

function loadState() {
  if (_stateCache) return JSON.parse(JSON.stringify(_stateCache));
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    _stateCache = JSON.parse(raw);
    return JSON.parse(JSON.stringify(_stateCache));
  } catch (e) {
    console.error('Erro ao carregar estado:', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState(state) {
  _stateCache = state; // update cache
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    // ... existing Firestore sync code ...
```

Also invalidate cache when localStorage is updated externally (by Firestore listener):

```javascript
// Add to state.js
function invalidateCache() { _stateCache = null; }
// Export it
window.AppState = { ..., invalidateCache };
```

Call `AppState.invalidateCache()` in the Firestore listener after writing to localStorage.

- [ ] **Step 3: Commit**

```bash
git add js/firestore-service.js js/state.js
git commit -m "fix: Firestore sync updates localStorage for visitors, add state cache"
```

---

### Task 3: Fix confronto direto (tiebreaker)

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Implement head-to-head tiebreaker in calcularClassificacao**

After the existing sort, add a second pass that resolves ties using confronto direto. When two teams have identical pontos, vitorias, saldoGols, and golsMarcados, check their direct match result:

```javascript
// After the existing tabela.sort(...), add:
// Resolve remaining ties by confronto direto
for (let i = 0; i < tabela.length - 1; i++) {
  let j = i + 1;
  // Find the group of tied teams (same pontos, vitorias, saldoGols, golsMarcados)
  while (j < tabela.length &&
    tabela[j].pontos === tabela[i].pontos &&
    tabela[j].vitorias === tabela[i].vitorias &&
    tabela[j].saldoGols === tabela[i].saldoGols &&
    tabela[j].golsMarcados === tabela[i].golsMarcados) {
    j++;
  }
  if (j - i === 2) {
    // Exactly 2 teams tied — check direct match
    const a = tabela[i];
    const b = tabela[i + 1];
    const directMatch = partidas.find(p =>
      (p.timeA === a.id && p.timeB === b.id) ||
      (p.timeA === b.id && p.timeB === a.id)
    );
    if (directMatch) {
      const aIsHome = directMatch.timeA === a.id;
      const aGols = aIsHome ? directMatch.golsA : directMatch.golsB;
      const bGols = aIsHome ? directMatch.golsB : directMatch.golsA;
      if (bGols > aGols) {
        // Swap
        [tabela[i], tabela[i + 1]] = [tabela[i + 1], tabela[i]];
      }
    }
  }
  // Skip to end of tied group
  i = j - 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "fix: implement head-to-head tiebreaker in classification"
```

---

### Task 4: Fix playoff result editing (reset downstream propagation)

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add reset logic to _propagarResultadoPlayoff**

Before propagating, clear any downstream data that was based on the previous result. Add a function `_resetDownstreamPlayoff`:

```javascript
function _resetDownstreamPlayoff(state, matchId) {
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  function clearMatch(m) {
    m.golsA = null; m.golsB = null;
    m.vencedor = null; m.perdedor = null;
  }
  function clearGF() {
    gf.golsUpper = null; gf.golsLower = null;
    gf.vencedor = null;
    gf.timeUpper = null; gf.timeLower = null;
  }

  // If editing an upper semi, reset: UB final, LB semi, LB final, GF
  if (matchId === 'ub-sf1' || matchId === 'ub-sf2') {
    clearMatch(ub.final);
    ub.final.timeA = null; ub.final.timeB = null;
    clearMatch(lb.sf);
    lb.sf.timeA = null; lb.sf.timeB = null;
    clearMatch(lb.final);
    lb.final.timeA = null; lb.final.timeB = null;
    clearGF();
  }
  // If editing UB final, reset: LB final (loser side), GF
  if (matchId === 'ub-final') {
    clearMatch(lb.final);
    lb.final.timeA = null; lb.final.timeB = null;
    clearGF();
  }
  // If editing LB semi, reset: LB final, GF (lower side)
  if (matchId === 'lb-sf') {
    clearMatch(lb.final);
    lb.final.timeA = null; lb.final.timeB = null;
    gf.timeLower = null; gf.golsLower = null; gf.golsUpper = null; gf.vencedor = null;
  }
  // If editing LB final, reset GF lower side
  if (matchId === 'lb-final') {
    gf.timeLower = null; gf.golsLower = null; gf.golsUpper = null; gf.vencedor = null;
  }
}
```

- [ ] **Step 2: Call _resetDownstreamPlayoff before propagation in registrarResultadoPlayoff**

```javascript
function registrarResultadoPlayoff(state, matchId, golsA, golsB) {
  // ... existing match finding code ...
  // Reset downstream BEFORE setting new result
  _resetDownstreamPlayoff(state, matchId);
  // ... then set result and propagate as before ...
}
```

- [ ] **Step 3: Also handle re-editing Grand Final**

In `registrarResultadoGrandFinal`, if the GF already has a result, allow re-editing by resetting status:

```javascript
function registrarResultadoGrandFinal(state, golsUpper, golsLower) {
  // ... existing validation ...
  // Reset encerrado status if re-editing
  if (state.campeonato.status === 'encerrado') {
    state.campeonato.status = 'playoffs';
    state.playoffs.status = 'andamento';
  }
  // ... rest of existing code ...
}
```

- [ ] **Step 4: Commit**

```bash
git add js/state.js
git commit -m "fix: reset downstream playoff bracket when editing earlier results"
```

---

### Task 5: Score input UX — confirmation modal + validation

**Files:**
- Modify: `index.html`
- Modify: `js/actions.js`

- [ ] **Step 1: Add confirmation step in submitScoreModal (index.html)**

Before saving, show the score back to the user:

```javascript
function submitScoreModal() {
  // ... existing validation ...
  const teamA = document.getElementById('modalScoreTeamA').textContent;
  const teamB = document.getElementById('modalScoreTeamB').textContent;

  if (!confirm('Confirma o resultado?\n\n' + teamA + ' ' + golsA + ' x ' + golsB + ' ' + teamB)) {
    return;
  }
  // ... rest of existing save logic ...
}
```

- [ ] **Step 2: Add max validation in saveInlineResult and savePlayoffResult**

In all score processing functions, clamp values to 0-99:

```javascript
const golsA = Math.min(99, Math.max(0, parseInt(golsAEl.value) || 0));
const golsB = Math.min(99, Math.max(0, parseInt(golsBEl.value) || 0));
```

- [ ] **Step 3: Change default score input value from 0 to empty**

In the score modal HTML, change `value="0"` to `value=""` and add `placeholder="0"` on both score inputs. This forces the user to actively type a number.

- [ ] **Step 4: Commit**

```bash
git add index.html js/actions.js
git commit -m "fix: add score confirmation, max validation, empty default inputs"
```

---

### Task 6: Statistics include playoffs

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Update calcularEstatisticas to include playoff matches**

```javascript
function calcularEstatisticas(state) {
  const grupoPartidas = state.faseGrupos.partidas.filter(p => p.status === 'concluida');

  // Collect playoff matches
  const playoffPartidas = [];
  if (state.playoffs.status !== 'aguardando') {
    const ub = state.playoffs.upperBracket;
    const lb = state.playoffs.lowerBracket;
    const gf = state.playoffs.grandFinal;
    [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final].forEach(m => {
      if (m.vencedor) {
        playoffPartidas.push({ timeA: m.timeA, timeB: m.timeB, golsA: m.golsA, golsB: m.golsB, fase: 'playoff' });
      }
    });
    if (gf.vencedor) {
      playoffPartidas.push({ timeA: gf.timeUpper, timeB: gf.timeLower, golsA: gf.golsUpper, golsB: gf.golsLower, fase: 'grand-final' });
    }
  }

  const allPartidas = [...grupoPartidas, ...playoffPartidas];
  const totalPartidas = allPartidas.length;
  const totalGols = allPartidas.reduce((s, p) => s + p.golsA + p.golsB, 0);
  const mediaGols = totalPartidas > 0 ? (totalGols / totalPartidas).toFixed(2) : 0;

  // Biggest win across all matches
  const maiorGoleada = allPartidas.reduce((best, p) => {
    const diff = Math.abs(p.golsA - p.golsB);
    return diff > best.diff ? { diff, partida: p } : best;
  }, { diff: 0, partida: null });

  const tabela = calcularClassificacao(state);
  const topGoleadores = [...tabela].sort((a, b) => b.golsMarcados - a.golsMarcados).slice(0, 5);
  const menosVazados = [...tabela].sort((a, b) => a.golsSofridos - b.golsSofridos).slice(0, 5);

  return {
    totalPartidas,
    totalPartidasGrupos: grupoPartidas.length,
    totalPartidasPlayoffs: playoffPartidas.length,
    totalGols,
    mediaGols,
    maiorGoleada,
    topGoleadores,
    menosVazados
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "feat: statistics now include playoff matches"
```

---

### Task 7: Mobile bracket — vertical layout

**Files:**
- Modify: `css/style.css`
- Modify: `js/renderers.js`

- [ ] **Step 1: Add mobile bracket styles in CSS**

```css
@media (max-width: 768px) {
  /* ... existing mobile rules ... */

  /* Bracket: vertical stacked layout */
  .bracket-container { overflow-x: visible; }
  .bracket-mobile-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bracket-mobile-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .bracket-mobile-section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
  }
  .bracket-mobile-match {
    margin-bottom: 8px;
  }
}
```

- [ ] **Step 2: In renderBracket, detect mobile and render stacked version**

Add at the start of renderBracket:

```javascript
const isMobile = window.innerWidth <= 768;
if (isMobile) {
  container.innerHTML = renderBracketMobile(state);
  return;
}
```

Then add `renderBracketMobile(state)` that renders a simple vertical list of bracket sections:
- Chave Superior: Semifinais, Final
- Chave Inferior: Semifinal, Final
- Grande Final
Each section uses the existing `renderBracketMatch` component.

- [ ] **Step 3: Commit**

```bash
git add css/style.css js/renderers.js
git commit -m "feat: mobile bracket vertical stacked layout"
```

---

### Task 8: Loading states for async operations

**Files:**
- Modify: `css/style.css`
- Modify: `js/actions.js`

- [ ] **Step 1: Add CSS spinner**

```css
.btn-loading {
  position: relative;
  pointer-events: none;
  opacity: 0.7;
}
.btn-loading::after {
  content: '';
  position: absolute;
  width: 14px; height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  right: 8px; top: 50%;
  transform: translateY(-50%);
}
@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
```

- [ ] **Step 2: Add helper functions for loading state**

```javascript
function setLoading(btnEl, loading) {
  if (!btnEl) return;
  if (loading) {
    btnEl.classList.add('btn-loading');
    btnEl.disabled = true;
  } else {
    btnEl.classList.remove('btn-loading');
    btnEl.disabled = false;
  }
}
```

- [ ] **Step 3: Apply to submitPublicRegistration and approveRegistration**

Wrap the async calls with setLoading on the button that was clicked.

- [ ] **Step 4: Commit**

```bash
git add css/style.css js/actions.js
git commit -m "feat: add loading spinner for async operations"
```

---

### Task 9: Remove potes from state and renderers

**Files:**
- Modify: `js/state.js`
- Modify: `js/renderers.js`
- Modify: `js/actions.js`

- [ ] **Step 1: Remove loadPotes, savePotes, DEFAULT_POTES from state.js**

Remove the functions and constants. Keep the localStorage key removal in `resetState` for backward compat.

- [ ] **Step 2: Remove any potes references from renderers.js**

Remove `renderPotesConfig` if not already removed in Task 1. Remove potes loading from `renderRegras`.

- [ ] **Step 3: Remove savePotesConfig from actions.js if not already removed**

- [ ] **Step 4: Remove potes from AppState export**

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/renderers.js js/actions.js
git commit -m "chore: remove potes system entirely"
```

---

### Task 10: Extract inline styles to CSS classes (renderers.js)

**Files:**
- Modify: `css/style.css`
- Modify: `js/renderers.js`

- [ ] **Step 1: Create CSS classes for common inline patterns in renderers**

Identify the most repeated inline style patterns and create classes:

```css
/* Match inline row */
.match-inline-row {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px 16px;
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 12px;
  transition: all var(--transition);
}
.match-inline-row:hover {
  border-color: var(--color-border-light);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* Score input inline */
.score-inline-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.score-inline-input {
  width: 52px;
  text-align: center;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  padding: 6px 4px;
  font-size: 1.1rem;
  font-weight: 800;
  font-family: var(--font-main);
}
.score-inline-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-glow);
  outline: none;
}

/* Team name with participant */
.team-name-with-part {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}
.team-participant {
  font-size: 0.65rem;
  color: var(--color-text-dim);
  font-weight: 400;
}

/* Round header */
.round-header {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-dim);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

/* Status dot */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.done { background: var(--color-win); }
.status-dot.pending { background: var(--color-border); }

/* Registration status banner */
.status-banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 24px;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-banner.open { background: var(--color-win-bg); border: 1px solid rgba(0,184,148,0.3); color: var(--color-win); }
.status-banner.closed { background: var(--color-loss-bg); border: 1px solid rgba(232,67,147,0.3); color: var(--color-loss); }

/* Stats counter row */
.stats-counter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
```

- [ ] **Step 2: Replace inline styles in renderInlineMatchRow, renderRegistrationCard, renderInscricoes, renderPartidasGrupos with the new CSS classes**

This is the most tedious step. Go function by function replacing `style="..."` with `class="..."`.

- [ ] **Step 3: Commit**

```bash
git add css/style.css js/renderers.js
git commit -m "refactor: extract inline styles to CSS classes in renderers"
```

---

### Task 11: Final commit — push and create PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/phase1-critical-fixes
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "fix: phase 1 — critical bugs, UX improvements, cleanup" --body "..."
```
