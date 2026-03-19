/**
 * App Bootstrap — 1o Campeonato EA Sports FC AMLabs
 * Navigation, score modal, mobile bar, and initialization
 */

// ------------------------------------------------------------------
// Partidas tab switching (grupos/playoffs)
// ------------------------------------------------------------------

function switchPartidaTab(tab) {
  const g = document.getElementById('partidaTabGrupos');
  const p = document.getElementById('partidaTabPlayoffs');
  const bg = document.getElementById('tabPartGrupos');
  const bp = document.getElementById('tabPartPlayoffs');
  if (g) g.style.display = tab === 'grupos' ? 'block' : 'none';
  if (p) p.style.display = tab === 'playoffs' ? 'block' : 'none';
  if (bg) bg.classList.toggle('active', tab === 'grupos');
  if (bp) bp.classList.toggle('active', tab === 'playoffs');
}
window.switchPartidaTab = switchPartidaTab;

// ------------------------------------------------------------------
// Score modal
// ------------------------------------------------------------------

function openScoreModal(matchId, teamA, teamB, isGrandFinal) {
  document.getElementById('modalScoreMatchId').value = matchId;
  document.getElementById('modalScoreIsGrandFinal').value = isGrandFinal ? '1' : '0';
  document.getElementById('modalScoreTeamA').textContent = teamA;
  document.getElementById('modalScoreTeamB').textContent = teamB;
  document.getElementById('modalScoreTitle').textContent = isGrandFinal ? 'Grande Final' : 'Registrar Resultado';
  document.getElementById('modalScoreHint').style.display = (matchId.startsWith('rr_') || matchId.startsWith('insc')) ? 'none' : 'block';

  // Pre-fill if match has an existing concluded score; leave empty for new matches
  const state = AppState.loadReadOnly();
  let golsA = null, golsB = null;
  if (isGrandFinal) {
    const gf = state.playoffs.grandFinal;
    if (gf.vencedor) { golsA = gf.golsUpper; golsB = gf.golsLower; }
  } else {
    const grp = state.faseGrupos.partidas.find(p => p.id === matchId);
    if (grp && grp.status === 'concluida') {
      golsA = grp.golsA;
      golsB = grp.golsB;
    } else {
      const ub = state.playoffs.upperBracket;
      const lb = state.playoffs.lowerBracket;
      const allP = [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final];
      const pm = allP.find(m => m.id === matchId);
      if (pm && pm.vencedor) { golsA = pm.golsA; golsB = pm.golsB; }
    }
  }
  document.getElementById('modalScoreGolsA').value = golsA !== null ? golsA : '';
  document.getElementById('modalScoreGolsB').value = golsB !== null ? golsB : '';

  UI.openModal('modalScore');
  setTimeout(() => document.getElementById('modalScoreGolsA').focus(), 100);
}
window.openScoreModal = openScoreModal;

function _executeScoreSave(matchId, isGF, golsA, golsB) {
  _scoreSubmitting = true;
  UI.closeModal('modalScore');

  if (isGF) {
    const state = AppState.load();
    AppState.registrarResultadoGrandFinal(state, golsA, golsB);
    AppState.save(state);
    AppState.addAuditLog(getAuditUser(), 'Registrou resultado da Grande Final: ' + golsA + ' x ' + golsB);
    Renderers.bracket();
    Renderers.home();
  } else {
    const state = AppState.load();
    const grp = state.faseGrupos.partidas.find(p => p.id === matchId);
    if (grp) {
      saveInlineResult(matchId, golsA, golsB);
    } else {
      savePlayoffResult(matchId, golsA, golsB);
    }
  }

  setTimeout(() => { Renderers.partidas(); _scoreSubmitting = false; }, 100);
}

let _scoreSubmitting = false;
function submitScoreModal() {
  if (_scoreSubmitting) return;
  const matchId = document.getElementById('modalScoreMatchId').value;
  const isGF = document.getElementById('modalScoreIsGrandFinal').value === '1';
  const inputA = document.getElementById('modalScoreGolsA');
  const inputB = document.getElementById('modalScoreGolsB');
  const golsA = parseInt(inputA.value);
  const golsB = parseInt(inputB.value);

  // Clear previous error highlights
  inputA.style.borderColor = '';
  inputB.style.borderColor = '';

  if (isNaN(golsA) || isNaN(golsB) || golsA < 0 || golsB < 0) {
    if (isNaN(golsA) || golsA < 0) inputA.style.borderColor = 'var(--color-loss)';
    if (isNaN(golsB) || golsB < 0) inputB.style.borderColor = 'var(--color-loss)';
    UI.showToast('Informe placar v\u00e1lido.', 'error');
    return;
  }

  // Check if editing an existing playoff result — show modal confirmation
  let needsConfirm = false;
  const state = AppState.loadReadOnly();
  if (isGF && state.playoffs.grandFinal.vencedor) {
    needsConfirm = true;
  } else if (!isGF && !matchId.startsWith('rr_')) {
    const ub = state.playoffs.upperBracket;
    const lb = state.playoffs.lowerBracket;
    const pm = [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final].find(m => m.id === matchId);
    if (pm && pm.vencedor) needsConfirm = true;
  }

  if (needsConfirm) {
    UI.closeModal('modalScore');
    UI.openModal('modalPlayoffEdit');
    const confirmBtn = document.getElementById('btnConfirmPlayoffEdit');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', function() {
      UI.closeModal('modalPlayoffEdit');
      _executeScoreSave(matchId, isGF, golsA, golsB);
    });
    return;
  }

  _executeScoreSave(matchId, isGF, golsA, golsB);
}
window.submitScoreModal = submitScoreModal;

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------

const VALID_SECTIONS = ['home', 'inscricoes', 'times', 'classificacao', 'partidas', 'bracket', 'estatisticas', 'regras', 'historico'];

function initNavFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash && VALID_SECTIONS.includes(hash)) {
    UI.navigateTo(hash);
  } else {
    UI.navigateTo('home');
  }
}

// ------------------------------------------------------------------
// Mobile bottom tab bar
// ------------------------------------------------------------------

function mobileNavigate(section) {
  closeMobileMore();
  UI.navigateTo(section);
  updateMobileTabBar(section);
}

function updateMobileTabBar(section) {
  document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mobile-more-item').forEach(t => t.classList.remove('active'));
  const tabBtn = document.querySelector('.mobile-tab[data-nav="' + section + '"]');
  const moreBtn = document.querySelector('.mobile-more-item[data-nav="' + section + '"]');
  if (tabBtn) {
    tabBtn.classList.add('active');
  } else if (moreBtn) {
    moreBtn.classList.add('active');
    document.getElementById('mobileMoreBtn').classList.add('active');
  }
  const logoutBtn = document.getElementById('mobileLogoutBtn');
  if (logoutBtn) logoutBtn.style.display = (UI.checkAdmin()) ? '' : 'none';
}

function toggleMobileMore() {
  const overlay = document.getElementById('mobileMoreOverlay');
  overlay.classList.toggle('open');
  if (overlay.classList.contains('open') && typeof updateAdminUI === 'function') {
    updateAdminUI();
  }
}

function closeMobileMore() {
  const overlay = document.getElementById('mobileMoreOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Sync mobile tab bar when desktop nav is used
const _origNavigateTo = UI.navigateTo;
UI.navigateTo = function(section) {
  closeMobileMore();
  _origNavigateTo(section);
  updateMobileTabBar(section);
  const st = AppState.loadReadOnly();
  UI.updateHeaderBadge(st.campeonato.status);
  UI.updateLifecycleBar(st.campeonato.status);
};

// ------------------------------------------------------------------
// Renderer wrappers
// ------------------------------------------------------------------

function updateInscricoesVisibility() {
  const state = AppState.loadReadOnly();
  const show = state.campeonato.status === 'configuracao';
  document.querySelectorAll('.inscricoes-only').forEach(el => {
    el.style.display = show ? '' : 'none';
  });
}

const _origHome2 = Renderers.home;
Renderers.home = function() { _origHome2(); updateInscricoesVisibility(); };

const _origRenderClassificacao = Renderers.classificacao;
Renderers.classificacao = function() {
  _origRenderClassificacao();
  const state = AppState.loadReadOnly();
  const btnPlayoffs = document.getElementById('btnIniciarPlayoffs');
  if (btnPlayoffs) {
    const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
    const tabela = AppState.calcularClassificacao(state);
    btnPlayoffs.style.display = (pending === 0 && tabela.length >= 4 && state.campeonato.status === 'grupos') ? 'block' : 'none';
  }
};

// ------------------------------------------------------------------
// Delegated click handler for score buttons (XSS-safe)
// ------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-score-action');
  if (!btn) return;
  const matchId = btn.getAttribute('data-match-id');
  const isGF = btn.getAttribute('data-gf') === '1';
  const state = AppState.loadReadOnly();

  let teamA = '?', teamB = '?';
  if (isGF) {
    const gf = state.playoffs.grandFinal;
    const tU = AppState.getTimeById(state, gf.timeUpper);
    const tL = AppState.getTimeById(state, gf.timeLower);
    teamA = tU ? tU.nome : '?';
    teamB = tL ? tL.nome : '?';
  } else {
    const grp = state.faseGrupos.partidas.find(p => p.id === matchId);
    if (grp) {
      const tA = AppState.getTimeById(state, grp.timeA);
      const tB = AppState.getTimeById(state, grp.timeB);
      teamA = tA ? tA.nome : '?';
      teamB = tB ? tB.nome : '?';
    } else {
      const ub = state.playoffs.upperBracket;
      const lb = state.playoffs.lowerBracket;
      const pm = [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final].find(m => m.id === matchId);
      if (pm) {
        const tA = AppState.getTimeById(state, pm.timeA);
        const tB = AppState.getTimeById(state, pm.timeB);
        teamA = tA ? tA.nome : '?';
        teamB = tB ? tB.nome : '?';
      }
    }
  }
  openScoreModal(matchId, teamA, teamB, isGF);
});

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavFromHash();
  updateInscricoesVisibility();

  // Set random default colors on color inputs
  const inputCorTimo = document.getElementById('inputCorTimo');
  const inputInscCor = document.getElementById('inputInscCor');
  if (inputCorTimo) inputCorTimo.value = UI.getRandomColor();
  if (inputInscCor) inputInscCor.value = UI.getRandomColor();

  // Start Firestore listener if configured
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
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && VALID_SECTIONS.includes(hash)) {
    UI.navigateTo(hash);
  }
});
