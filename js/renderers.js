/**
 * Renderers — Teams, Classification, Stats, Rules, History, Registration
 * Also exports the unified Renderers object
 */

// ------------------------------------------------------------------
// TEAMS
// ------------------------------------------------------------------

function renderTimes() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('timesGrid');
  const count = document.getElementById('timesCount');

  if (count) count.textContent = `${state.times.length} time${state.times.length !== 1 ? 's' : ''}`;

  if (!container) return;

  if (state.times.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">&#128101;</div>
        <div class="empty-title">Nenhum time cadastrado</div>
        <div class="empty-desc">Adicione os times participantes usando o formulário ao lado.</div>
      </div>`;
    return;
  }

  container.innerHTML = state.times.map(t => `
    <div class="team-card">
      ${UI.renderAvatar(t, 44, 'team-card-avatar')}
      <div class="team-card-info">
        <div class="team-card-name">${UI.escapeHtml(t.nome)}</div>
        <div class="team-card-abbr">${UI.escapeHtml(t.participante || '')}</div>
      </div>
      <div class="team-card-actions admin-only">
        <button class="btn-icon" onclick="openEditTeamModal('${t.id}')" title="Editar time">&#9998;</button>
        <button class="btn-icon" onclick="deleteTime('${t.id}')" title="Remover time">&#x2715;</button>
      </div>
    </div>`).join('');

  // Update generate button state
  const genBtn = document.getElementById('btnGerarGrupos');
  if (genBtn) {
    genBtn.disabled = state.times.length < 5 || state.campeonato.status !== 'configuracao';
    genBtn.title = state.times.length < 5 ? 'Minimo de 5 times para iniciar' : '';
  }

  if (typeof updateAdminUI === 'function') updateAdminUI();
}

// ------------------------------------------------------------------
// CLASSIFICATION TABLE
// ------------------------------------------------------------------

function renderClassificacao() {
  const state = AppState.loadReadOnly();
  const tabela = AppState.calcularClassificacao(state);
  const container = document.getElementById('tabelaClassificacao');
  if (!container) return;

  // Get classification tiers from selected format
  const formatId = typeof getSelectedPlayoffFormatId === 'function' ? getSelectedPlayoffFormatId() : (state.playoffs.formato || PlayoffFormats.DEFAULT);
  const format = PlayoffFormats.get(formatId);
  const tiers = format.classificationTiers;
  const qualify = format.classified;

  function getTierForPosition(pos) {
    return tiers.find(t => pos >= t.from && pos <= t.to) || null;
  }

  if (tabela.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128202;</div>
        <div class="empty-title">Tabela vazia</div>
        <div class="empty-desc">Cadastre times e inicie a fase de grupos para ver a classificação.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="classification-table-wrapper">
      <table class="classification-table">
        <thead>
          <tr>
            <th colspan="2">Time</th>
            <th class="text-center">J</th>
            <th class="text-center">V</th>
            <th class="text-center">E</th>
            <th class="text-center">D</th>
            <th class="text-center">GP</th>
            <th class="text-center">GC</th>
            <th class="text-center">SG</th>
            <th class="text-center">Pts</th>
            <th>Forma</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tabela.map((t, i) => {
            const pos = i + 1;
            const tier = getTierForPosition(pos);
            const tierClass = tier ? tier.cssClass : '';
            const sgClass = t.saldoGols > 0 ? 'stat-positive' : t.saldoGols < 0 ? 'stat-negative' : 'stat-neutral';
            return `
              <tr class="${tierClass}">
                <td>
                  <div class="pos-cell">
                    <span class="pos-number ${tier ? 'top' : ''}" ${tier ? 'style="color:' + tier.color + '"' : ''}>${pos}</span>
                  </div>
                </td>
                <td>
                  <div class="team-name-cell">
                    ${UI.renderAvatar(t, 28)}
                    <div>
                      <div class="team-name-text">${UI.escapeHtml(t.nome)}</div>
                      ${t.participante ? '<div class="team-participant-sub">' + UI.escapeHtml(t.participante) + '</div>' : ''}
                    </div>
                  </div>
                </td>
                <td class="text-center text-muted">${t.jogos}</td>
                <td class="text-center stat-positive" style="font-weight:700">${t.vitorias}</td>
                <td class="text-center stat-neutral">${t.empates}</td>
                <td class="text-center stat-negative">${t.derrotas}</td>
                <td class="text-center">${t.golsMarcados}</td>
                <td class="text-center">${t.golsSofridos}</td>
                <td class="text-center ${sgClass}" style="font-weight:700">${UI.signedNumber(t.saldoGols)}</td>
                <td class="text-center"><span class="stat-pts">${t.pontos}</span></td>
                <td>
                  <div class="form-badges">
                    ${t.forma.map(f => `<span class="form-badge ${f}">${f}</span>`).join('')}
                  </div>
                </td>
                <td>${tier ? '<span class="qualified-label" style="color:' + tier.color + ';border-color:' + tier.color + '">' + UI.escapeHtml(tier.label) + '</span>' : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="classification-tier-legend">
      ${tiers.map(tier => `<div class="tier-legend-item"><span class="tier-legend-dot" style="background:${tier.color}"></span>${UI.escapeHtml(tier.label)} (${tier.from === tier.to ? tier.from + '&ordm;' : tier.from + '&ordm;-' + tier.to + '&ordm;'})</div>`).join('')}
      <span>&bull; Desempate: Pontos &rarr; Vit&oacute;rias &rarr; Saldo de Gols &rarr; Gols Marcados</span>
    </div>`;
}

// ------------------------------------------------------------------
// STATS
// ------------------------------------------------------------------

function renderEstatisticas() {
  const state = AppState.loadReadOnly();
  const stats = AppState.calcularEstatisticas(state);

  // Overview cards
  const els = {
    totalPartidas: document.getElementById('statTotalPartidas'),
    totalGols: document.getElementById('statTotalGols'),
    mediaGols: document.getElementById('statMediaGols'),
    totalTimes: document.getElementById('statTotalTimes')
  };
  if (els.totalPartidas) els.totalPartidas.textContent = stats.totalPartidas;
  if (els.totalGols) els.totalGols.textContent = stats.totalGols;
  if (els.mediaGols) els.mediaGols.textContent = stats.mediaGols;
  if (els.totalTimes) els.totalTimes.textContent = state.times.length;

  // Top scorers (by team)
  const topGolsEl = document.getElementById('statTopGols');
  if (topGolsEl) {
    if (stats.topGoleadores.length === 0) {
      topGolsEl.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-title">Sem dados ainda</div></div>';
    } else {
      topGolsEl.innerHTML = stats.topGoleadores.map((t, i) => `
        <div class="stat-rank-item">
          <span class="stat-rank-pos ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
          ${UI.renderAvatar(t, 36)}
          <div class="stat-rank-info">
            <div class="stat-rank-name">${UI.escapeHtml(t.nome)}</div>
            ${t.participante ? '<div class="stat-rank-participant">' + UI.escapeHtml(t.participante) + '</div>' : ''}
          </div>
          <div class="stat-rank-numbers">
            <span class="stat-rank-value" style="color:var(--color-primary)">${t.golsMarcados}</span>
            <span class="stat-rank-label">${t.jogos}J</span>
          </div>
        </div>`).join('');
    }
  }

  // Best defense
  const topDefEl = document.getElementById('statTopDef');
  if (topDefEl) {
    if (stats.menosVazados.length === 0) {
      topDefEl.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-title">Sem dados ainda</div></div>';
    } else {
      topDefEl.innerHTML = stats.menosVazados.map((t, i) => `
        <div class="stat-rank-item">
          <span class="stat-rank-pos ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
          ${UI.renderAvatar(t, 36)}
          <div class="stat-rank-info">
            <div class="stat-rank-name">${UI.escapeHtml(t.nome)}</div>
            ${t.participante ? '<div class="stat-rank-participant">' + UI.escapeHtml(t.participante) + '</div>' : ''}
          </div>
          <div class="stat-rank-numbers">
            <span class="stat-rank-value" style="color:var(--color-win)">${t.golsSofridos}</span>
            <span class="stat-rank-label">${t.jogos}J</span>
          </div>
        </div>`).join('');
    }
  }

  // Biggest win
  const goleadaEl = document.getElementById('statGoleada');
  if (goleadaEl) {
    if (!stats.maiorGoleada.partida) {
      goleadaEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px 0">Sem partidas concluídas</div>';
    } else {
      const p = stats.maiorGoleada.partida;
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      goleadaEl.innerHTML = `
        <div class="stat-match-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="stat-match-name ${p.golsA > p.golsB ? 'winner' : ''}">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span class="stat-match-score">${p.golsA}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="stat-match-score">${p.golsB}</span>
          <span class="stat-match-name ${p.golsB > p.golsA ? 'winner' : ''}" style="text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div class="stat-match-note">Diferen&ccedil;a de ${Math.abs(p.golsA - p.golsB)} gol${Math.abs(p.golsA - p.golsB) !== 1 ? 's' : ''}</div>`;
    }
  }

  // Match with most goals
  const maisGolsEl = document.getElementById('statMaisGols');
  if (maisGolsEl) {
    if (!stats.partidaMaisGols || !stats.partidaMaisGols.partida) {
      maisGolsEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px 0">Sem partidas conclu&iacute;das</div>';
    } else {
      const p = stats.partidaMaisGols.partida;
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      maisGolsEl.innerHTML = `
        <div class="stat-match-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="stat-match-name ${p.golsA > p.golsB ? 'winner' : ''}">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span class="stat-match-score">${p.golsA}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="stat-match-score">${p.golsB}</span>
          <span class="stat-match-name ${p.golsB > p.golsA ? 'winner' : ''}" style="text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div class="stat-match-note">${stats.partidaMaisGols.total} gols na partida</div>`;
    }
  }
}

// ------------------------------------------------------------------
// RULES (Regras)
// ------------------------------------------------------------------

function renderRegras() {
  // Rules page is mostly static HTML. Playoff rules are now on the bracket page.
}

// ------------------------------------------------------------------
// AUDIT LOG (Histórico)
// ------------------------------------------------------------------

async function renderHistorico() {
  const container = document.getElementById('historicoContainer');
  if (!container) return;

  // Load from Firestore if available, fallback to localStorage
  let logs;
  if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--color-text-muted)">Carregando...</div>';
    logs = await FirestoreService.loadAuditLog();
  } else {
    logs = AppState.loadAuditLog();
  }

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <div class="empty-title">Nenhuma alteração registrada</div>
        <div class="empty-desc">As ações realizadas no campeonato aparecerão aqui com data, hora e responsável.</div>
      </div>`;
    return;
  }

  // Show newest first (Firestore already returns desc; localStorage needs reverse)
  const sorted = typeof FirestoreService !== 'undefined' && FirestoreService.isActive()
    ? logs
    : [...logs].reverse();

  container.innerHTML = `
    <div class="audit-log">
      ${sorted.map(entry => {
        const dt = new Date(entry.timestamp);
        const dateStr = dt.toLocaleDateString('pt-BR');
        const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="audit-entry">
            <div class="audit-meta">
              <span class="audit-user">${UI.escapeHtml(entry.usuario)}</span>
              <span class="audit-datetime">${dateStr} às ${timeStr}</span>
            </div>
            <div class="audit-action">${UI.escapeHtml(entry.acao)}</div>
            ${entry.detalhes ? `<div class="audit-details">${Object.entries(entry.detalhes).map(([k, v]) => `<span>${UI.escapeHtml(k)}: <strong>${UI.escapeHtml(String(v))}</strong></span>`).join(' &bull; ')}</div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

// ------------------------------------------------------------------
// INSCRICOES (Public Registration)
// ------------------------------------------------------------------

async function renderInscricoes() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('inscricoesContainer');
  if (!container) return;

  const registrations = await FirestoreService.loadRegistrations();
  const pendentes = registrations.filter(r => r.status === 'pendente');
  const aprovados = registrations.filter(r => r.status === 'aprovado');
  const rejeitados = registrations.filter(r => r.status === 'rejeitado');
  const isOpen = state.campeonato.status === 'configuracao';
  const admin = UI.checkAdmin();

  let html = '';

  // Status banner
  if (isOpen) {
    html += '<div class="status-banner open"><span>&#9989;</span> Inscri&ccedil;&otilde;es abertas! Cadastre seu time abaixo.</div>';
  } else {
    html += '<div class="status-banner closed"><span>&#128683;</span> Inscri&ccedil;&otilde;es encerradas. O campeonato j&aacute; come&ccedil;ou. Contate o administrador.</div>';
  }

  // Pending requests
  if (pendentes.length > 0) {
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-yellow">&#9203;</span> Aguardando Aprovacao (' + pendentes.length + ')</h3></div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">';
    html += pendentes.map(r => renderRegistrationCard(r, 'pendente', admin)).join('');
    html += '</div>';
  }

  // Enrolled teams
  if (state.times.length > 0) {
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-green">&#9989;</span> Times Inscritos (' + state.times.length + ')</h3></div>';
    html += '<div class="teams-grid mb-24">';
    html += state.times.map(t => '<div class="team-card"><div style="display:flex;align-items:center;gap:12px">' + UI.renderAvatar(t, 36) + '<div><div class="team-card-name">' + UI.escapeHtml(t.nome) + '</div><div class="team-card-abbr">' + UI.escapeHtml(t.abreviacao) + (t.participante ? ' &bull; ' + UI.escapeHtml(t.participante) : '') + '</div></div></div></div>').join('');
    html += '</div>';
  } else if (pendentes.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">&#128101;</div><div class="empty-title">Nenhum time inscrito ainda</div><div class="empty-desc">Seja o primeiro a inscrever seu time!</div></div>';
  }

  // Rejected (admin only)
  if (admin && rejeitados.length > 0) {
    html += '<div class="section-header"><h3 class="section-title" style="font-size:.9rem;color:var(--color-text-dim)">Rejeitados (' + rejeitados.length + ')</h3></div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">';
    html += rejeitados.map(r => renderRegistrationCard(r, 'rejeitado', false)).join('');
    html += '</div>';
  }

  container.innerHTML = html;

  // Hide form when closed
  const formCard = document.getElementById('inscricaoFormCard');
  if (formCard) {
    formCard.style.display = isOpen ? '' : 'none';
  }
}

function renderRegistrationCard(r, status, showActions) {
  const statusColors = {
    pendente: { bg: 'var(--color-draw-bg)', color: '#b8860b', border: 'rgba(253,203,110,0.4)', label: 'Aguardando' },
    aprovado: { bg: 'var(--color-win-bg)', color: 'var(--color-win)', border: 'rgba(0,184,148,0.3)', label: 'Aprovado' },
    rejeitado: { bg: 'var(--color-loss-bg)', color: 'var(--color-loss)', border: 'rgba(232,67,147,0.3)', label: 'Rejeitado' }
  };
  const s = statusColors[status];
  const avatar = { nome: r.nome, abreviacao: r.abreviacao, cor: r.cor };

  const meta = UI.escapeHtml(r.abreviacao) + (r.participante ? ' &bull; ' + UI.escapeHtml(r.participante) : '') + ' &bull; ' + new Date(r.criadoEm).toLocaleDateString('pt-BR');
  const actions = showActions
    ? `<div style="display:flex;gap:6px"><button class="btn btn-sm btn-success" onclick="approveRegistration('${r.id}')">Aprovar</button><button class="btn btn-sm btn-secondary" onclick="rejectRegistration('${r.id}')">Rejeitar</button></div>`
    : '';

  return `<div class="registration-card">
    ${UI.renderAvatar(avatar, 36)}
    <div class="registration-card-info">
      <div class="registration-card-name">${UI.escapeHtml(r.nome)}</div>
      <div class="registration-card-meta">${meta}</div>
    </div>
    <span class="registration-card-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.border}">${s.label}</span>
    ${actions}
  </div>`;
}

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

window.Renderers = {
  home: renderHome,
  times: renderTimes,
  classificacao: renderClassificacao,
  partidas: renderPartidas,
  bracket: renderBracket,
  estatisticas: renderEstatisticas,
  regras: renderRegras,
  historico: renderHistorico,
  inscricoes: renderInscricoes
};

// Helpers used by actions
