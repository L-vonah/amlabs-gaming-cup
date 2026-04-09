/**
 * Portal — Campeonatos AMLabs
 * Landing page logic: list tournaments, "ver mais", create tournament.
 */

const PORTAL_PAGE_SIZE = 3;
let _allTournaments = [];
let _visibleCount = PORTAL_PAGE_SIZE;
let _pendingDeleteUuid = null;
let _pendingDeleteName = '';
let _deleteInFlight = false;

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
  portalRenderHistorico();
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
        <span class="selector-card-meta">${(() => { const gt = getGameType(t.gameType); return gt.icon + ' ' + gt.name; })()}${date ? ' · ' + date : ''}</span>
      </div>
      <div class="selector-card-right">
        <span class="badge badge-${UI.escapeHtml(t.status)}">${statusLabel[t.status] || t.status}</span>
        ${deleteBtn}
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

function portalRenderHistorico() {
  const section = document.getElementById('historicoSection');
  const container = document.getElementById('historicoCampeoes');
  if (!section || !container) return;

  const campeoes = _allTournaments.filter(t => t.status === 'encerrado' && t.campeao);

  if (campeoes.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  container.innerHTML = campeoes.map(t => {
    const gt = getGameType(t.gameType);
    const ano = t.criadoEm ? new Date(t.criadoEm).getFullYear() : '';
    return `
    <div class="historico-card" onclick="portalEnterTournament('${UI.escapeHtml(t.id)}')">
      <div class="historico-trophy">🏆</div>
      <div class="historico-info">
        <span class="historico-campeao">${UI.escapeHtml(t.campeao)}</span>
        <span class="historico-meta">${UI.escapeHtml(t.nome)} · ${gt.icon} ${gt.name}${ano ? ' · ' + ano : ''}</span>
      </div>
      <span class="selector-card-arrow">→</span>
    </div>`;
  }).join('');
}

function portalRequestDelete(uuid, nome, timesCount) {
  if (!UI.checkAdmin()) return;
  _pendingDeleteUuid = uuid;
  _pendingDeleteName = nome;

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
  if (!_pendingDeleteUuid || !UI.checkAdmin() || _deleteInFlight) return;

  const uuid = _pendingDeleteUuid;
  const nome = _pendingDeleteName;
  const confirmBtn = document.querySelector('#modalDeleteTournament .btn-danger');
  const cancelBtn = document.querySelector('#modalDeleteTournament .btn-secondary');
  const msg = document.getElementById('deleteModalMessage');

  _deleteInFlight = true;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.dataset.originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Deletando...';
  }
  if (cancelBtn) cancelBtn.disabled = true;
  if (msg) {
    msg.innerHTML = `Deletando <strong>${UI.escapeHtml(nome)}</strong> e os dados relacionados. Isso pode levar alguns segundos.`;
  }

  try {
    const ok = await FirestoreService.deleteTournament(uuid, ({ stage, deletedCount }) => {
      if (!msg) return;

      const stageLabel = {
        inscricoes: 'inscrições',
        auditLog: 'entradas do histórico',
        campeonato: 'campeonato'
      };

      if (stage === 'campeonato') {
        msg.innerHTML = `Finalizando a remoção de <strong>${UI.escapeHtml(nome)}</strong>.`;
        return;
      }

      msg.innerHTML = `Deletando <strong>${UI.escapeHtml(nome)}</strong>: ${deletedCount} ${stageLabel[stage] || 'registros'} removidos até agora.`;
    });
    if (ok) {
      UI.closeModal('modalDeleteTournament');
      UI.showToast('Campeonato deletado.', 'success');
      _allTournaments = _allTournaments.filter(t => t.id !== uuid);
      portalRenderCards();
      portalRenderHistorico();
      _pendingDeleteUuid = null;
      _pendingDeleteName = '';
    } else {
      UI.showToast('Erro ao deletar campeonato. Tente novamente.', 'error');
    }
  } finally {
    _deleteInFlight = false;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = confirmBtn.dataset.originalText || 'Deletar';
    }
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

function portalEnterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.href = 'campeonato.html';
}

async function portalCreateTournament(event) {
  event.preventDefault();
  if (!UI.checkAdmin()) return;

  const nome = document.getElementById('inputTournamentNome').value.trim();
  const gameType = document.getElementById('inputTournamentGameType').value;
  const teamMode = document.getElementById('inputTournamentTeamMode').value || 'individual';

  if (!nome) {
    UI.showToast('Preencha o nome do campeonato.', 'error');
    return;
  }

  const uuid = await FirestoreService.createTournament({ nome, gameType, teamMode });
  if (!uuid) {
    UI.showToast('Erro ao criar campeonato. Tente novamente.', 'error');
    return;
  }

  UI.showToast('Campeonato criado!', 'success');
  portalEnterTournament(uuid);
}

function portalSelectGameType(gameTypeId) {
  document.getElementById('inputTournamentGameType').value = gameTypeId;
  document.querySelectorAll('#gameTypeSelector .game-type-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.gameType === gameTypeId);
  });
}

function portalSelectTeamMode(teamModeId) {
  document.getElementById('inputTournamentTeamMode').value = teamModeId;
  document.querySelectorAll('#teamModeSelector .game-type-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.teamMode === teamModeId);
  });
}

// Service Worker
if ('serviceWorker' in navigator && typeof getServiceWorkerPath === 'function') {
  const swPath = getServiceWorkerPath();
  const swScope = getServiceWorkerScope();
  if (swPath && swScope) {
    navigator.serviceWorker.register(swPath, { scope: swScope }).catch(() => {});
  }
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

  // Render game type selector in creation modal
  const selectorEl = document.getElementById('gameTypeSelector');
  if (selectorEl) {
    selectorEl.innerHTML = Object.values(GAME_TYPES).map(gt => `
      <button type="button" class="game-type-card ${gt.id === DEFAULT_GAME_TYPE ? 'selected' : ''}"
        onclick="portalSelectGameType('${gt.id}')" data-game-type="${gt.id}">
        <span class="game-type-icon">${gt.icon}</span>
        <span class="game-type-name">${gt.name}</span>
      </button>
    `).join('');
  }

  portalRenderList();
});

window.portalShowMore = portalShowMore;
window.portalEnterTournament = portalEnterTournament;
window.portalCreateTournament = portalCreateTournament;
window.portalRequestDelete = portalRequestDelete;
window.portalExecuteDelete = portalExecuteDelete;
window.portalSelectGameType = portalSelectGameType;
window.portalSelectTeamMode = portalSelectTeamMode;
