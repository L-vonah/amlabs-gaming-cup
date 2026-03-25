/**
 * App Bootstrap — Campeonatos AMLabs
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
  const isPlayoff = !matchId.startsWith('rr_') && !matchId.startsWith('insc');
  document.getElementById('modalScoreHint').style.display = isPlayoff ? 'block' : 'none';

  // Pre-fill if match has an existing concluded score; leave empty for new matches
  const state = AppState.loadReadOnly();
  let golsA = null, golsB = null;
  const grp = state.faseGrupos.partidas.find(p => p.id === matchId);
  if (grp && grp.status === 'concluida') {
    golsA = grp.golsA;
    golsB = grp.golsB;
  } else if (state.playoffs.matches && state.playoffs.matches[matchId]) {
    const pm = state.playoffs.matches[matchId];
    if (pm.vencedor) { golsA = pm.golsA; golsB = pm.golsB; }
  }
  document.getElementById('modalScoreGolsA').value = golsA !== null ? golsA : 0;
  document.getElementById('modalScoreGolsB').value = golsB !== null ? golsB : 0;

  // Penalty setup
  const penaltyEl = document.getElementById('penaltySelector');
  const penaltyInput = document.getElementById('modalScorePenaltyWinner');
  const penaltyBtnA = document.getElementById('penaltyBtnA');
  const penaltyBtnB = document.getElementById('penaltyBtnB');
  if (penaltyEl) penaltyEl.style.display = 'none';
  if (penaltyInput) penaltyInput.value = '';
  if (penaltyBtnA) { penaltyBtnA.textContent = teamA; penaltyBtnA.classList.remove('selected'); }
  if (penaltyBtnB) { penaltyBtnB.textContent = teamB; penaltyBtnB.classList.remove('selected'); }

  // Pre-fill penalty winner if exists
  if (isPlayoff) {
    let existingPenalty = null;
    if (state.playoffs.matches && state.playoffs.matches[matchId]) {
      existingPenalty = state.playoffs.matches[matchId].penaltyWinner;
    }
    if (existingPenalty && penaltyInput) {
      penaltyInput.value = existingPenalty;
      if (penaltyBtnA && existingPenalty === state.playoffs.matches[matchId].timeA) penaltyBtnA.classList.add('selected');
      if (penaltyBtnB && existingPenalty === state.playoffs.matches[matchId].timeB) penaltyBtnB.classList.add('selected');
    }
    // Show/hide penalty selector based on current scores
    _updatePenaltyVisibility();
  }

  UI.openModal('modalScore');
  setTimeout(() => document.getElementById('modalScoreGolsA').focus(), 100);
}
window.openScoreModal = openScoreModal;

function _executeScoreSave(matchId, isGF, golsA, golsB, penaltyWinner) {
  _scoreSubmitting = true;
  UI.closeModal('modalScore');

  if (isGF) {
    const state = AppState.load();
    AppState.registrarResultadoGrandFinal(state, golsA, golsB, penaltyWinner);
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
      savePlayoffResult(matchId, golsA, golsB, penaltyWinner);
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

  // Get penalty winner for playoff draws
  const isPlayoff = !matchId.startsWith('rr_');
  let penaltyWinner = null;
  if (isPlayoff && golsA === golsB) {
    penaltyWinner = document.getElementById('modalScorePenaltyWinner').value;
    if (!penaltyWinner) {
      UI.showToast('Empate! Selecione o vencedor dos p\u00eanaltis.', 'error');
      return;
    }
  }

  // Check if editing an existing playoff result — show modal confirmation
  let needsConfirm = false;
  const state = AppState.loadReadOnly();
  if (state.playoffs.matches && state.playoffs.matches[matchId]) {
    const pm = state.playoffs.matches[matchId];
    if (pm.vencedor) needsConfirm = true;
  }

  if (needsConfirm) {
    UI.closeModal('modalScore');
    UI.openModal('modalPlayoffEdit');
    const confirmBtn = document.getElementById('btnConfirmPlayoffEdit');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', function() {
      UI.closeModal('modalPlayoffEdit');
      _executeScoreSave(matchId, isGF, golsA, golsB, penaltyWinner);
    });
    return;
  }

  _executeScoreSave(matchId, isGF, golsA, golsB, penaltyWinner);
}
window.submitScoreModal = submitScoreModal;

// ------------------------------------------------------------------
// Penalty helpers
// ------------------------------------------------------------------

function _updatePenaltyVisibility() {
  const penaltyEl = document.getElementById('penaltySelector');
  if (!penaltyEl) return;
  const matchId = document.getElementById('modalScoreMatchId').value;
  const isPlayoff = !matchId.startsWith('rr_') && !matchId.startsWith('insc');
  if (!isPlayoff) { penaltyEl.style.display = 'none'; return; }
  const golsA = parseInt(document.getElementById('modalScoreGolsA').value);
  const golsB = parseInt(document.getElementById('modalScoreGolsB').value);
  penaltyEl.style.display = (!isNaN(golsA) && !isNaN(golsB) && golsA === golsB) ? '' : 'none';
  // Clear selection if no longer a draw
  if (golsA !== golsB) {
    const penaltyInput = document.getElementById('modalScorePenaltyWinner');
    if (penaltyInput) penaltyInput.value = '';
    document.querySelectorAll('.penalty-btn').forEach(b => b.classList.remove('selected'));
  }
}

function selectPenaltyWinner(side) {
  const matchId = document.getElementById('modalScoreMatchId').value;
  const state = AppState.loadReadOnly();
  const match = state.playoffs.matches ? state.playoffs.matches[matchId] : null;
  if (!match) return;
  const winnerId = side === 'A' ? match.timeA : match.timeB;
  document.getElementById('modalScorePenaltyWinner').value = winnerId;
  document.getElementById('penaltyBtnA').classList.toggle('selected', side === 'A');
  document.getElementById('penaltyBtnB').classList.toggle('selected', side === 'B');
}
window.selectPenaltyWinner = selectPenaltyWinner;

// Listen for score changes to show/hide penalty selector
document.addEventListener('input', (e) => {
  if (e.target.id === 'modalScoreGolsA' || e.target.id === 'modalScoreGolsB') {
    _updatePenaltyVisibility();
  }
});

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
  // Check group stage first, then playoff matches
  const grp = state.faseGrupos.partidas.find(p => p.id === matchId);
  if (grp) {
    const tA = AppState.getTimeById(state, grp.timeA);
    const tB = AppState.getTimeById(state, grp.timeB);
    teamA = tA ? tA.nome : '?';
    teamB = tB ? tB.nome : '?';
  } else if (state.playoffs.matches && state.playoffs.matches[matchId]) {
    const pm = state.playoffs.matches[matchId];
    const tA = AppState.getTimeById(state, pm.timeA);
    const tB = AppState.getTimeById(state, pm.timeB);
    teamA = tA ? tA.nome : '?';
    teamB = tB ? tB.nome : '?';
  }
  openScoreModal(matchId, teamA, teamB, isGF);
});

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------

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

/**
 * Show the tournament selector screen — portal mode.
 */
function openTournamentSelector() {
  document.body.classList.add('portal-mode');

  // Hide tournament-specific elements
  const navBar = document.getElementById('navBar');
  const mobileBottomBar = document.getElementById('mobileBottomBar');
  const mobileMoreOverlay = document.getElementById('mobileMoreOverlay');
  const lifecycleBar = document.getElementById('lifecycleBar');
  const tournamentTrigger = document.getElementById('tournamentTrigger');
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
window.openTournamentSelector = openTournamentSelector;

/**
 * Enter tournament mode — async, waits for Firestore data.
 */
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

  // Start listener — returns Promise that resolves on first snapshot
  try {
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
      await FirestoreService.startListener((data, error) => {
        if (error) return;
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

  // Update header with tournament name
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

// ------------------------------------------------------------------
// Tournament Dropdown
// ------------------------------------------------------------------

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
  if (dropdown.style.display === 'block') {
    closeTournamentDropdown();
  } else {
    openTournamentDropdown();
  }
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

// ------------------------------------------------------------------
// DOMContentLoaded
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Dev banner — only shown outside production
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

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && VALID_SECTIONS.includes(hash)) {
    UI.navigateTo(hash);
  }
});
