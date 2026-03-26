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
