/**
 * Renderers — 1o Campeonato EA Sports FC AMLabs
 * All page-specific rendering functions
 */

// ------------------------------------------------------------------
// HOME
// ------------------------------------------------------------------

function renderHome() {
  const state = AppState.load();
  const tabela = AppState.calcularClassificacao(state);
  const partidas = state.faseGrupos.partidas;
  const concluidas = partidas.filter(p => p.status === 'concluida').length;

  document.getElementById('homeStatTimes').textContent = state.times.length;
  document.getElementById('homeStatPartidas').textContent = partidas.length;
  document.getElementById('homeStatConcluidas').textContent = concluidas;
  document.getElementById('homeStatGols').textContent =
    partidas.filter(p => p.status === 'concluida').reduce((s, p) => s + p.golsA + p.golsB, 0);

  UI.updateHeaderBadge(state.campeonato.status);
  UI.updateLifecycleBar(state.campeonato.status);

  // Champion banner — shown prominently when tournament is finished
  const championBanner = document.getElementById('championBanner');
  if (championBanner) {
    if (state.campeonato.status === 'encerrado' && state.playoffs.grandFinal.vencedor) {
      const winner = AppState.getTimeById(state, state.playoffs.grandFinal.vencedor);
      const gf = state.playoffs.grandFinal;
      championBanner.style.display = 'block';
      championBanner.innerHTML = `
        <div class="champion-banner">
          <div class="champion-glow"></div>
          <div class="champion-content">
            <div class="champion-trophy">
              <span class="champion-trophy-icon">&#127942;</span>
            </div>
            <div class="champion-label">CAMPE&Atilde;O DO CAMPEONATO 2026</div>
            <div class="champion-name">${winner ? UI.escapeHtml(winner.nome) : '?'}</div>
            ${winner && winner.participante ? `<div class="champion-label" style="margin-top:4px;letter-spacing:.12em;font-size:.85rem">${UI.escapeHtml(winner.participante)}</div>` : ''}
            ${winner ? `<div class="champion-avatar-wrapper">${UI.renderAvatar(winner, 80)}</div>` : ''}
            <div class="champion-score">${gf.golsUpper} &times; ${gf.golsLower} &mdash; Grande Final</div>
            <div class="champion-badge">1&ordm; Campeonato EA Sports FC AMLabs 2026</div>
          </div>
        </div>`;
    } else {
      championBanner.style.display = 'none';
    }
  }

  // Last results — include both group stage and playoff concluded matches
  const groupConcluded = partidas.filter(p => p.status === 'concluida').map(p => ({
    type: 'group',
    timeA: p.timeA,
    timeB: p.timeB,
    golsA: p.golsA,
    golsB: p.golsB,
    id: p.id,
    status: p.status,
    rodada: p.rodada,
    original: p
  }));

  const playoffConcluded = [];
  if (state.playoffs && state.playoffs.status !== 'aguardando') {
    const ub = state.playoffs.upperBracket;
    const lb = state.playoffs.lowerBracket;
    const gf = state.playoffs.grandFinal;
    [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final].forEach(m => {
      if (m.vencedor) {
        playoffConcluded.push({
          type: 'playoff',
          timeA: m.timeA,
          timeB: m.timeB,
          golsA: m.golsA,
          golsB: m.golsB,
          fase: m.fase,
          id: m.id
        });
      }
    });
    if (gf.vencedor) {
      playoffConcluded.push({
        type: 'playoff',
        timeA: gf.timeUpper,
        timeB: gf.timeLower,
        golsA: gf.golsUpper,
        golsB: gf.golsLower,
        fase: 'Grande Final',
        id: gf.id
      });
    }
  }

  // Combine: groups first, then playoffs, and take last 3
  const allConcluded = [...groupConcluded, ...playoffConcluded];
  const lastResults = allConcluded.slice(-3).reverse();

  const container = document.getElementById('homeLastResults');
  if (container) {
    if (lastResults.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9917;</div><div class="empty-title">Nenhum resultado ainda</div><div class="empty-desc">Registre resultados na aba Resultados</div></div>';
    } else {
      container.innerHTML = lastResults.map(r => {
        if (r.type === 'group') {
          return renderMatchCardWithAction(r.original, state, false);
        }
        // Playoff match card for home — simple display, no actions
        const tA = AppState.getTimeById(state, r.timeA);
        const tB = AppState.getTimeById(state, r.timeB);
        const nameA = tA ? UI.escapeHtml(tA.nome) : '?';
        const nameB = tB ? UI.escapeHtml(tB.nome) : '?';
        const sc = UI.scoreClass(r.golsA, r.golsB);
        return '<div class="match-card">' +
          '<div class="match-desktop">' +
            '<div class="match-teams">' +
              '<div class="match-team home">' +
                '<div class="match-team-info" style="text-align:right"><span class="team-name-text">' + nameA + '</span></div>' +
                UI.renderAvatar(tA, 24) +
              '</div>' +
              '<div class="match-score ' + sc + '">' +
                '<span class="score-val">' + r.golsA + '</span>' +
                '<span class="dash">:</span>' +
                '<span class="score-val">' + r.golsB + '</span>' +
              '</div>' +
              '<div class="match-team away">' +
                UI.renderAvatar(tB, 24) +
                '<div class="match-team-info"><span class="team-name-text">' + nameB + '</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="match-action-slot"></div>' +
          '</div>' +
          '<div class="match-mobile">' +
            '<div class="match-mobile-row">' +
              UI.renderAvatar(tA, 28) +
              '<span class="match-mobile-name">' + nameA + '</span>' +
              '<span class="match-mobile-score ' + (r.golsA > r.golsB ? 'win' : r.golsA < r.golsB ? 'loss' : '') + '">' + r.golsA + '</span>' +
            '</div>' +
            '<div class="match-mobile-row">' +
              UI.renderAvatar(tB, 28) +
              '<span class="match-mobile-name">' + nameB + '</span>' +
              '<span class="match-mobile-score ' + (r.golsB > r.golsA ? 'win' : r.golsB < r.golsA ? 'loss' : '') + '">' + r.golsB + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // Mini classification table (top 6) or Bracket mini-view when in playoffs
  const leaderEl = document.getElementById('homeLeader');
  const leaderTitleEl = document.getElementById('homeLeaderTitle');

  if (leaderEl) {
    const isPlayoffsOrEncerrado = state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado';

    if (isPlayoffsOrEncerrado) {
      // Update card title to "Chaveamento"
      if (leaderTitleEl) {
        leaderTitleEl.innerHTML = '<span class="section-title-icon icon-bg-yellow">&#127942;</span> Chaveamento';
      }

      // Build bracket mini-view
      const ub = state.playoffs.upperBracket;
      const lb = state.playoffs.lowerBracket;
      const gf = state.playoffs.grandFinal;

      const bracketMatches = [
        { match: ub.sf1, phase: 'SF CS1', color: 'var(--color-upper)', isGrand: false },
        { match: ub.sf2, phase: 'SF CS2', color: 'var(--color-upper)', isGrand: false },
        { match: ub.final, phase: 'Final CS', color: 'var(--color-upper)', isGrand: false },
        { match: lb.sf, phase: 'SF CI', color: 'var(--color-lower)', isGrand: false },
        { match: lb.final, phase: 'Final CI', color: 'var(--color-lower)', isGrand: false },
        { match: gf, phase: 'GF', color: 'var(--color-champion)', isGrand: true }
      ];

      let matchLines = '';
      bracketMatches.forEach(item => {
        const m = item.match;
        let tA, tB, scoreA, scoreB, winnerA, winnerB;
        if (item.isGrand) {
          if (!m.timeUpper && !m.timeLower) return;
          tA = m.timeUpper ? AppState.getTimeById(state, m.timeUpper) : null;
          tB = m.timeLower ? AppState.getTimeById(state, m.timeLower) : null;
          scoreA = m.golsUpper;
          scoreB = m.golsLower;
          winnerA = m.vencedor === m.timeUpper;
          winnerB = m.vencedor === m.timeLower;
        } else {
          if (!m.timeA && !m.timeB) return;
          tA = m.timeA ? AppState.getTimeById(state, m.timeA) : null;
          tB = m.timeB ? AppState.getTimeById(state, m.timeB) : null;
          scoreA = m.golsA;
          scoreB = m.golsB;
          winnerA = m.vencedor === m.timeA;
          winnerB = m.vencedor === m.timeB;
        }

        const nameA = tA ? UI.escapeHtml(tA.nome) : 'A definir';
        const nameB = tB ? UI.escapeHtml(tB.nome) : 'A definir';
        const sA = scoreA !== null ? scoreA : '-';
        const sB = scoreB !== null ? scoreB : '-';

        matchLines += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-surface-2);border-radius:var(--radius);border-left:3px solid ' + item.color + '">' +
          '<span style="font-size:.65rem;font-weight:700;color:var(--color-text-dim);min-width:40px">' + item.phase + '</span>' +
          '<span style="flex:1;font-size:.8rem;font-weight:' + (winnerA ? '700' : '400') + '">' + nameA + '</span>' +
          '<span style="font-weight:800;font-size:.85rem">' + sA + '</span>' +
          '<span style="color:var(--color-text-dim)">:</span>' +
          '<span style="font-weight:800;font-size:.85rem">' + sB + '</span>' +
          '<span style="flex:1;font-size:.8rem;font-weight:' + (winnerB ? '700' : '400') + ';text-align:right">' + nameB + '</span>' +
        '</div>';
      });

      leaderEl.innerHTML = '<div style="padding:12px">' +
        '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim);margin-bottom:12px">Chaveamento</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + matchLines + '</div>' +
        '<div style="text-align:center;margin-top:12px">' +
          '<button class="btn btn-sm btn-secondary" onclick="UI.navigateTo(\'bracket\')">Ver chaveamento completo</button>' +
        '</div>' +
      '</div>';
    } else {
      // Restore card title to "Classificação"
      if (leaderTitleEl) {
        leaderTitleEl.innerHTML = '<span class="section-title-icon icon-bg-yellow">&#127942;</span> Classifica&ccedil;&atilde;o';
      }

      if (tabela.length === 0) {
        leaderEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px">Aguardando cadastro de times...</div>';
      } else {
        const top = tabela.slice(0, 6);
        leaderEl.innerHTML = `
          <div style="padding:0">
            <table style="width:100%;border-collapse:collapse;font-size:.8rem">
              <thead>
                <tr style="border-bottom:1px solid var(--color-border)">
                  <th style="padding:10px 12px;text-align:left;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim)" colspan="2">Time</th>
                  <th style="padding:10px 6px;text-align:center;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim)">J</th>
                  <th style="padding:10px 6px;text-align:center;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim)">V</th>
                  <th style="padding:10px 6px;text-align:center;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim)">SG</th>
                  <th style="padding:10px 12px;text-align:center;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim)">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${top.map((t, i) => {
                  const isQ = i < 4;
                  return '<tr style="border-bottom:1px solid var(--color-border);' + (isQ ? 'border-left:2px solid var(--color-win)' : '') + '">' +
                    '<td style="padding:8px 12px;color:var(--color-text-dim);font-weight:700;width:24px">' + (i + 1) + '</td>' +
                    '<td style="padding:8px 4px"><div style="display:flex;align-items:center;gap:8px">' + UI.renderAvatar(t, 22) + '<span style="font-weight:600">' + UI.escapeHtml(t.nome) + '</span></div></td>' +
                    '<td style="padding:8px 6px;text-align:center;color:var(--color-text-muted)">' + t.jogos + '</td>' +
                    '<td style="padding:8px 6px;text-align:center;color:var(--color-win);font-weight:700">' + t.vitorias + '</td>' +
                    '<td style="padding:8px 6px;text-align:center;font-weight:700;color:' + (t.saldoGols > 0 ? 'var(--color-win)' : t.saldoGols < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)') + '">' + UI.signedNumber(t.saldoGols) + '</td>' +
                    '<td style="padding:8px 12px;text-align:center;font-weight:800;font-size:.9rem">' + t.pontos + '</td>' +
                  '</tr>';
                }).join('')}
              </tbody>
            </table>
            ${tabela.length > 6 ? '<div style="padding:8px 12px;text-align:center"><button class="btn btn-sm btn-secondary" onclick="UI.navigateTo(\'classificacao\')">Ver completa</button></div>' : ''}
          </div>`;
      }
    }
  }
}

// ------------------------------------------------------------------
// TEAMS
// ------------------------------------------------------------------

function renderTimes() {
  const state = AppState.load();
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
  const state = AppState.load();
  const tabela = AppState.calcularClassificacao(state);
  const container = document.getElementById('tabelaClassificacao');
  if (!container) return;

  const qualify = state.config.classificadosPorGrupo;

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
            const isQualified = i < qualify;
            const sgClass = t.saldoGols > 0 ? 'stat-positive' : t.saldoGols < 0 ? 'stat-negative' : 'stat-neutral';
            return `
              <tr class="${isQualified ? 'qualified' : ''}">
                <td>
                  <div class="pos-cell">
                    <span class="pos-number ${isQualified ? 'top' : ''}">${i + 1}</span>
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
                <td>${isQualified ? '<span class="qualified-label">Classif.</span>' : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="classification-legend" style="padding:12px 24px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:16px;font-size:0.8rem;color:var(--color-text-dim)">
      <span class="classification-legend-item" style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--color-win);opacity:.6"></span>Classificado para os Playoffs (Top ${qualify})</span>
      <span class="classification-legend-item">&bull; Desempate: Pontos &rarr; Vit&oacute;rias &rarr; Saldo de Gols &rarr; Gols Marcados</span>
    </div>`;
}

// ------------------------------------------------------------------
// MATCHES
// ------------------------------------------------------------------

function renderPartidas() {
  const state = AppState.load();
  const container = document.getElementById('partidasContainer');
  if (!container) return;

  const admin = typeof isAdmin === 'function' && isAdmin();
  const hasGrupos = state.faseGrupos.partidas.length > 0;
  const hasPlayoffs = state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado';

  if (!hasGrupos) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128197;</div>
        <div class="empty-title">Nenhuma partida gerada</div>
        <div class="empty-desc">Cadastre os times e inicie a fase de grupos para gerar o calend&aacute;rio.</div>
      </div>`;
    return;
  }

  // Tabs if playoffs exist
  let html = '';
  if (hasPlayoffs) {
    html += `<div class="tab-bar" style="margin-bottom:20px">
      <button class="tab-btn" id="tabPartGrupos" onclick="switchPartidaTab('grupos')">Fase de Grupos</button>
      <button class="tab-btn active" id="tabPartPlayoffs" onclick="switchPartidaTab('playoffs')">Playoffs</button>
    </div>`;
  }

  // Grupos (hidden by default when playoffs exist)
  html += '<div id="partidaTabGrupos"' + (hasPlayoffs ? ' style="display:none"' : '') + '>';
  html += renderPartidasGrupos(state, admin);
  html += '</div>';

  // Playoffs (shown by default when playoffs exist)
  if (hasPlayoffs) {
    html += '<div id="partidaTabPlayoffs">';
    html += renderPartidasPlayoffs(state, admin);
    html += '</div>';
  }

  container.innerHTML = html;
}

let _currentRound = 1;

function navigateRound(delta) {
  const state = AppState.load();
  const rounds = [...new Set(state.faseGrupos.partidas.map(p => p.rodada))].sort((a, b) => a - b);
  const idx = rounds.indexOf(_currentRound) + delta;
  if (idx < 0 || idx >= rounds.length) return;
  _currentRound = rounds[idx];
  const admin = typeof isAdmin === 'function' && isAdmin();
  const gruposDiv = document.getElementById('partidaTabGrupos');
  if (gruposDiv) gruposDiv.innerHTML = renderPartidasGrupos(state, admin);
}

function renderPartidasGrupos(state, admin) {
  const partidas = state.faseGrupos.partidas;
  const byRound = {};
  partidas.forEach(p => {
    if (!byRound[p.rodada]) byRound[p.rodada] = [];
    byRound[p.rodada].push(p);
  });

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  if (rounds.length === 0) return '';

  if (!rounds.includes(_currentRound)) _currentRound = rounds[0];

  const doneCount = partidas.filter(p => p.status === 'concluida').length;
  const pendingCount = partidas.length - doneCount;
  const curIdx = rounds.indexOf(_currentRound);
  const isFirst = curIdx === 0;
  const isLast = curIdx === rounds.length - 1;
  const matches = byRound[_currentRound];
  const roundDone = matches.filter(p => p.status === 'concluida').length;

  let html = `<div class="stats-counter-row">
    <span style="font-size:.8rem;color:var(--color-text-muted)">${doneCount} de ${partidas.length} partidas conclu&iacute;das</span>
    ${pendingCount === 0
      ? '<span class="completed-badge">Fase de Grupos Conclu&iacute;da!</span>'
      : ''}
  </div>`;

  html += `<div class="round-pagination">
    <button class="btn-round-nav" onclick="navigateRound(-1)" ${isFirst ? 'disabled' : ''} title="Rodada anterior">&#9664;</button>
    <div class="round-pagination-info">
      <span class="round-pagination-title">Rodada ${_currentRound}</span>
      <span class="round-pagination-sub">${roundDone} de ${matches.length} conclu&iacute;das</span>
    </div>
    <button class="btn-round-nav" onclick="navigateRound(1)" ${isLast ? 'disabled' : ''} title="Pr&oacute;xima rodada">&#9654;</button>
  </div>`;

  html += `<div class="matches-grid">
    ${matches.map(p => renderMatchCardWithAction(p, state, admin)).join('')}
  </div>`;

  return html;
}

function renderPartidasPlayoffs(state, admin) {
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  // Bracket importance order (most important first): Grand Final, LB Final, LB SF, UB Final, UB SF1, UB SF2
  const importanceOrder = ['grand-final', 'lb-final', 'lb-sf', 'ub-final', 'ub-sf1', 'ub-sf2'];

  // Build all match entries (regular + grand final) with unified structure
  const allEntries = [];

  // Regular playoff matches
  const regularMatches = [
    { ...ub.sf1, tipo: 'upper' },
    { ...ub.sf2, tipo: 'upper' },
    { ...ub.final, tipo: 'upper' },
    { ...lb.sf, tipo: 'lower' },
    { ...lb.final, tipo: 'lower' }
  ];

  regularMatches.forEach(m => {
    if (!m.timeA || !m.timeB) return;
    allEntries.push({ kind: 'regular', match: m, concluded: m.vencedor !== null, id: m.id });
  });

  // Grand final
  if (gf.timeUpper && gf.timeLower) {
    allEntries.push({ kind: 'grand', match: gf, concluded: gf.vencedor !== null, id: 'grand-final' });
  }

  // Sort: pending first, then concluded. Within each group, sort by bracket importance order.
  allEntries.sort((a, b) => {
    if (a.concluded !== b.concluded) return a.concluded ? 1 : -1;
    return importanceOrder.indexOf(a.id) - importanceOrder.indexOf(b.id);
  });

  let html = '';

  allEntries.forEach(entry => {
    if (entry.kind === 'grand') {
      const m = entry.match;
      const tU = AppState.getTimeById(state, m.timeUpper);
      const tL = AppState.getTimeById(state, m.timeLower);
      const concluded = entry.concluded;
      const nameU = tU ? UI.escapeHtml(tU.nome) : '?';
      const nameL = tL ? UI.escapeHtml(tL.nome) : '?';
      const sc = concluded ? UI.scoreClass(m.golsUpper, m.golsLower) : '';
      let desktopBtn = '';
      let mobileBtn = '';
      if (admin && !concluded) {
        desktopBtn = '<button class="btn btn-sm btn-success admin-only btn-score-action" data-match-id="grand-final" data-gf="1">Registrar</button>';
        mobileBtn = desktopBtn;
      } else if (admin && concluded) {
        desktopBtn = '<button class="btn btn-sm btn-secondary admin-only btn-score-action" data-match-id="grand-final" data-gf="1">Editar</button>';
        mobileBtn = desktopBtn;
      }

      const partU = tU && tU.participante ? '<span class="team-participant">' + UI.escapeHtml(tU.participante) + '</span>' : '';
      const partL = tL && tL.participante ? '<span class="team-participant">' + UI.escapeHtml(tL.participante) + '</span>' : '';

      html += '<div style="margin-bottom:8px">' +
        '<div class="playoff-section-header" style="color:var(--color-champion);border-bottom-color:rgba(249,168,37,0.3)">&#127942; Grande Final</div>' +
        '<div class="match-card" style="border-left:3px solid var(--color-champion)">' +
          '<div class="match-desktop">' +
            '<div class="match-teams">' +
              '<div class="match-team home">' +
                '<div class="match-team-info" style="text-align:right"><span class="team-name-text">' + nameU + '</span>' + partU + '</div>' +
                UI.renderAvatar(tU, 24) +
              '</div>' +
              '<div class="match-score ' + sc + '">' +
                '<span class="score-val">' + (concluded ? m.golsUpper : '-') + '</span>' +
                '<span class="dash">:</span>' +
                '<span class="score-val">' + (concluded ? m.golsLower : '-') + '</span>' +
              '</div>' +
              '<div class="match-team away">' +
                UI.renderAvatar(tL, 24) +
                '<div class="match-team-info"><span class="team-name-text">' + nameL + '</span>' + partL + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="match-action-slot">' + desktopBtn + '</div>' +
          '</div>' +
          '<div class="match-mobile">' +
            '<div class="match-mobile-row">' +
              UI.renderAvatar(tU, 28) +
              '<span class="match-mobile-name">' + nameU + '</span>' +
              '<span class="match-mobile-score ' + (concluded && m.golsUpper > m.golsLower ? 'win' : concluded && m.golsUpper < m.golsLower ? 'loss' : '') + '">' + (concluded ? m.golsUpper : '-') + '</span>' +
            '</div>' +
            '<div class="match-mobile-row">' +
              UI.renderAvatar(tL, 28) +
              '<span class="match-mobile-name">' + nameL + '</span>' +
              '<span class="match-mobile-score ' + (concluded && m.golsLower > m.golsUpper ? 'win' : concluded && m.golsLower < m.golsUpper ? 'loss' : '') + '">' + (concluded ? m.golsLower : '-') + '</span>' +
            '</div>' +
            (mobileBtn ? '<div class="match-mobile-action">' + mobileBtn + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    } else {
      const m = entry.match;
      const tA = AppState.getTimeById(state, m.timeA);
      const tB = AppState.getTimeById(state, m.timeB);
      const concluded = entry.concluded;
      const colorVar = m.tipo === 'upper' ? 'var(--color-upper)' : 'var(--color-lower)';
      const nameA = tA ? UI.escapeHtml(tA.nome) : '?';
      const nameB = tB ? UI.escapeHtml(tB.nome) : '?';
      const sc = concluded ? UI.scoreClass(m.golsA, m.golsB) : '';
      let desktopBtn = '';
      let mobileBtn = '';
      if (admin && !concluded) {
        desktopBtn = '<button class="btn btn-sm btn-success admin-only btn-score-action" data-match-id="' + m.id + '" data-gf="0">Registrar</button>';
        mobileBtn = desktopBtn;
      } else if (admin && concluded) {
        desktopBtn = '<button class="btn btn-sm btn-secondary admin-only btn-score-action" data-match-id="' + m.id + '" data-gf="0">Editar</button>';
        mobileBtn = desktopBtn;
      }

      const partA = tA && tA.participante ? '<span class="team-participant">' + UI.escapeHtml(tA.participante) + '</span>' : '';
      const partB = tB && tB.participante ? '<span class="team-participant">' + UI.escapeHtml(tB.participante) + '</span>' : '';
      const phaseLabel = m.fase;

      html += '<div class="match-card" style="border-left:3px solid ' + colorVar + ';margin-bottom:8px">' +
        '<div class="match-round-badge" style="font-size:.6rem">' + UI.escapeHtml(phaseLabel) + '</div>' +
        '<div class="match-desktop">' +
          '<div class="match-teams">' +
            '<div class="match-team home">' +
              '<div class="match-team-info" style="text-align:right"><span class="team-name-text">' + nameA + '</span>' + partA + '</div>' +
              UI.renderAvatar(tA, 24) +
            '</div>' +
            '<div class="match-score ' + sc + '">' +
              '<span class="score-val">' + (concluded ? m.golsA : '-') + '</span>' +
              '<span class="dash">:</span>' +
              '<span class="score-val">' + (concluded ? m.golsB : '-') + '</span>' +
            '</div>' +
            '<div class="match-team away">' +
              UI.renderAvatar(tB, 24) +
              '<div class="match-team-info"><span class="team-name-text">' + nameB + '</span>' + partB + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="match-action-slot">' + desktopBtn + '</div>' +
        '</div>' +
        '<div class="match-mobile">' +
          '<div class="match-mobile-row">' +
            UI.renderAvatar(tA, 28) +
            '<span class="match-mobile-name">' + nameA + '</span>' +
            '<span class="match-mobile-score ' + (concluded && m.golsA > m.golsB ? 'win' : concluded && m.golsA < m.golsB ? 'loss' : '') + '">' + (concluded ? m.golsA : '-') + '</span>' +
          '</div>' +
          '<div class="match-mobile-row">' +
            UI.renderAvatar(tB, 28) +
            '<span class="match-mobile-name">' + nameB + '</span>' +
            '<span class="match-mobile-score ' + (concluded && m.golsB > m.golsA ? 'win' : concluded && m.golsB < m.golsA ? 'loss' : '') + '">' + (concluded ? m.golsB : '-') + '</span>' +
          '</div>' +
          (mobileBtn ? '<div class="match-mobile-action">' + mobileBtn + '</div>' : '') +
        '</div>' +
      '</div>';
    }
  });

  return html || '<div class="empty-state"><div class="empty-icon">&#9203;</div><div class="empty-title">Aguardando propaga&ccedil;&atilde;o</div></div>';
}

function renderMatchCardWithAction(p, state, admin) {
  const tA = AppState.getTimeById(state, p.timeA);
  const tB = AppState.getTimeById(state, p.timeB);
  const nameA = tA ? UI.escapeHtml(tA.nome) : 'Time A';
  const nameB = tB ? UI.escapeHtml(tB.nome) : 'Time B';
  const concluded = p.status === 'concluida';
  const sc = concluded ? UI.scoreClass(p.golsA, p.golsB) : '';

  const partA = tA && tA.participante ? `<span class="team-participant">${UI.escapeHtml(tA.participante)}</span>` : '';
  const partB = tB && tB.participante ? `<span class="team-participant">${UI.escapeHtml(tB.participante)}</span>` : '';

  let desktopBtn = '';
  let mobileBtn = '';
  if (admin && !concluded) {
    desktopBtn = `<button class="btn btn-sm btn-success admin-only btn-score-action" data-match-id="${p.id}" data-gf="0">Registrar</button>`;
    mobileBtn = desktopBtn;
  } else if (admin && concluded) {
    desktopBtn = `<button class="btn btn-sm btn-secondary admin-only btn-score-action" data-match-id="${p.id}" data-gf="0">Editar</button>`;
    mobileBtn = desktopBtn;
  }

  return `
    <div class="match-card">
      <div class="match-desktop">
        <div class="match-teams">
          <div class="match-team home">
            <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span>${partA}</div>
            ${UI.renderAvatar(tA, 24)}
          </div>
          <div class="match-score ${sc}">
            <span class="score-val">${concluded ? p.golsA : '-'}</span>
            <span class="dash">:</span>
            <span class="score-val">${concluded ? p.golsB : '-'}</span>
          </div>
          <div class="match-team away">
            ${UI.renderAvatar(tB, 24)}
            <div class="match-team-info"><span class="team-name-text">${nameB}</span>${partB}</div>
          </div>
        </div>
        <div class="match-action-slot">
          ${desktopBtn}
        </div>
      </div>
      <div class="match-mobile">
        <div class="match-mobile-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="match-mobile-name">${nameA}${partA ? ' <span class="team-participant">' + UI.escapeHtml(tA.participante) + '</span>' : ''}</span>
          <span class="match-mobile-score ${concluded && p.golsA > p.golsB ? 'win' : concluded && p.golsA < p.golsB ? 'loss' : ''}">${concluded ? p.golsA : '-'}</span>
        </div>
        <div class="match-mobile-row">
          ${UI.renderAvatar(tB, 28)}
          <span class="match-mobile-name">${nameB}${partB ? ' <span class="team-participant">' + UI.escapeHtml(tB.participante) + '</span>' : ''}</span>
          <span class="match-mobile-score ${concluded && p.golsB > p.golsA ? 'win' : concluded && p.golsB < p.golsA ? 'loss' : ''}">${concluded ? p.golsB : '-'}</span>
        </div>
        ${mobileBtn ? '<div class="match-mobile-action">' + mobileBtn + '</div>' : ''}
      </div>
    </div>`;
}

// ------------------------------------------------------------------
// BRACKET (Chaveamento)
// ------------------------------------------------------------------

function renderBracket() {
  const state = AppState.load();
  const container = document.getElementById('bracketContainer');
  if (!container) return;

  // Show/hide refazer button based on playoff status
  const refazerBtn = document.getElementById('btnRefazerPlayoffs');
  if (refazerBtn) {
    refazerBtn.style.display = (state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado') ? '' : 'none';
  }
  if (typeof updateAdminUI === 'function') updateAdminUI();

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    renderBracketMobile(container, state);
    return;
  }

  if (state.campeonato.status === 'configuracao' || state.campeonato.status === 'grupos') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#127942;</div>
        <div class="empty-title">Playoffs ainda não iniciados</div>
        <div class="empty-desc">Conclua a fase de grupos com pelo menos 4 times classificados.</div>
        ${state.campeonato.status === 'grupos' && canStartPlayoffs(state) ? `<button class="btn btn-primary mt-16" onclick="iniciarPlayoffs()">Iniciar Playoffs</button>` : ''}
      </div>`;
    return;
  }

  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;
  const adminUser = typeof isAdmin === 'function' && isAdmin();

  container.innerHTML = `
    <div class="bracket-container">
      <!-- CHAVE SUPERIOR -->
      <div style="margin-bottom:8px">
        <span class="bracket-label upper">&#9733; Chave Superior &mdash; sem derrota</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 48px 1fr 48px 1fr;gap:0;align-items:center;min-width:800px;margin-bottom:32px">
        <!-- Semifinais -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Semifinal</div>
          ${renderBracketMatch(ub.sf1, state, 'upper')}
          ${renderBracketMatch(ub.sf2, state, 'upper')}
        </div>
        <div class="bracket-connector" style="display:flex;flex-direction:column;align-items:center;gap:32px;padding-top:40px">
          <div style="width:2px;height:64px;background:var(--color-border)"></div>
        </div>
        <!-- Final Superior -->
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:48px">Final Superior</div>
          ${renderBracketMatch(ub.final, state, 'upper')}
        </div>
        <div class="bracket-connector" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:40px">
          <div style="width:2px;height:48px;background:var(--color-border)"></div>
        </div>
        <!-- Grande Final placeholder -->
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-champion);text-align:center;padding-bottom:8px;border-bottom:1px solid rgba(249,168,37,.3);margin-bottom:48px">Grande Final</div>
          ${renderGrandFinalBracket(gf, state)}
        </div>
      </div>

      <hr class="bracket-divider">

      <!-- CHAVE INFERIOR -->
      <div style="margin-bottom:8px">
        <span class="bracket-label lower">&#8595; Chave Inferior &mdash; segunda chance</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 48px 1fr;gap:0;align-items:center;min-width:500px;max-width:700px;margin-bottom:16px">
        <!-- Semifinal Inferior -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:12px">Semifinal Inferior</div>
          ${renderBracketMatch(lb.sf, state, 'lower')}
        </div>
        <div class="bracket-connector" style="display:flex;align-items:center;justify-content:center;padding-top:24px">
          <div style="width:2px;height:44px;background:var(--color-border)"></div>
        </div>
        <!-- Final Inferior -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:12px">Final Inferior</div>
          ${renderBracketMatch(lb.final, state, 'lower')}
        </div>
      </div>

      <div class="bracket-advantage-note">
        <span>&#9733;</span>
        <span><strong>Vantagem na Grande Final:</strong> O time que chegou pela Chave Superior (sem derrota) tem direito de escolher com qual time/configura&ccedil;&atilde;o deseja jogar.</span>
      </div>
    </div>`;
}

function renderBracketMobile(container, state) {
  if (state.campeonato.status === 'configuracao' || state.campeonato.status === 'grupos') {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127942;</div><div class="empty-title">Playoffs ainda n&atilde;o iniciados</div><div class="empty-desc">Conclua a fase de grupos com pelo menos 4 times classificados.</div>' +
      (state.campeonato.status === 'grupos' && canStartPlayoffs(state) ? '<button class="btn btn-primary mt-16" onclick="iniciarPlayoffs()">Iniciar Playoffs</button>' : '') + '</div>';
    return;
  }

  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;
  const adminUser = typeof isAdmin === 'function' && isAdmin();

  let html = '';
  html += '<div class="bracket-mobile-stack">';

  // Upper bracket
  html += '<div class="bracket-mobile-section" style="border-left:3px solid var(--color-upper)">';
  html += '<div class="bracket-mobile-section-title" style="color:var(--color-upper)">&#9733; Chave Superior</div>';
  html += renderBracketMatch(ub.sf1, state, 'upper');
  html += renderBracketMatch(ub.sf2, state, 'upper');
  html += '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-border)">';
  html += '<div style="font-size:.65rem;font-weight:700;color:var(--color-text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em">Final Superior</div>';
  html += renderBracketMatch(ub.final, state, 'upper');
  html += '</div></div>';

  // Lower bracket
  html += '<div class="bracket-mobile-section" style="border-left:3px solid var(--color-lower)">';
  html += '<div class="bracket-mobile-section-title" style="color:var(--color-lower)">&#8595; Chave Inferior</div>';
  html += renderBracketMatch(lb.sf, state, 'lower');
  html += '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-border)">';
  html += '<div style="font-size:.65rem;font-weight:700;color:var(--color-text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em">Final Inferior</div>';
  html += renderBracketMatch(lb.final, state, 'lower');
  html += '</div></div>';

  // Grand final
  html += '<div class="bracket-mobile-section" style="border-left:3px solid var(--color-champion);background:var(--color-champion-bg)">';
  html += '<div class="bracket-mobile-section-title" style="color:var(--color-champion)">&#127942; Grande Final</div>';
  html += renderGrandFinalBracket(gf, state);
  html += '<div style="font-size:.7rem;color:var(--color-champion);margin-top:8px">&#9733; Chave Superior tem vantagem de escolha de time</div>';
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
}

function renderBracketMatch(m, state, tipo) {
  const tA = m.timeA ? AppState.getTimeById(state, m.timeA) : null;
  const tB = m.timeB ? AppState.getTimeById(state, m.timeB) : null;

  return `
    <div class="bracket-match ${tipo}-match" style="margin-bottom:8px">
      ${renderBracketSlot(tA, m.golsA, m.vencedor === m.timeA)}
      ${renderBracketSlot(tB, m.golsB, m.vencedor === m.timeB)}
    </div>`;
}

function renderBracketSlot(time, gols, isWinner) {
  if (!time) {
    return `<div class="bracket-slot tbd"><span>A definir</span></div>`;
  }
  return `
    <div class="bracket-slot ${isWinner ? 'winner' : ''}">
      ${UI.renderAvatar(time, 22, 'bracket-slot-avatar')}
      <span class="bracket-slot-name">${UI.escapeHtml(time.nome)}</span>
      <span class="bracket-slot-score">${gols !== null ? gols : ''}</span>
    </div>`;
}

function renderGrandFinalBracket(gf, state) {
  const tU = gf.timeUpper ? AppState.getTimeById(state, gf.timeUpper) : null;
  const tL = gf.timeLower ? AppState.getTimeById(state, gf.timeLower) : null;

  return `
    <div class="bracket-match grand-match">
      <div class="bracket-slot ${gf.vencedor === gf.timeUpper ? 'winner' : ''}">
        ${tU ? UI.renderAvatar(tU, 22, 'bracket-slot-avatar') : ''}
        <span class="bracket-slot-name ${!tU ? 'tbd' : ''}">${tU ? UI.escapeHtml(tU.nome) : 'A definir'}</span>
        ${tU ? `<span style="font-size:.6rem;background:var(--color-upper-bg);color:var(--color-upper);padding:1px 5px;border-radius:8px;font-weight:700;margin-right:4px">CS</span>` : ''}
        <span class="bracket-slot-score">${gf.golsUpper !== null ? gf.golsUpper : ''}</span>
      </div>
      <div class="bracket-slot ${gf.vencedor === gf.timeLower ? 'winner' : ''}">
        ${tL ? UI.renderAvatar(tL, 22, 'bracket-slot-avatar') : ''}
        <span class="bracket-slot-name ${!tL ? 'tbd' : ''}">${tL ? UI.escapeHtml(tL.nome) : 'A definir'}</span>
        ${tL ? `<span style="font-size:.6rem;background:var(--color-lower-bg);color:var(--color-lower);padding:1px 5px;border-radius:8px;font-weight:700;margin-right:4px">CI</span>` : ''}
        <span class="bracket-slot-score">${gf.golsLower !== null ? gf.golsLower : ''}</span>
      </div>
    </div>`;
}

// ------------------------------------------------------------------
// STATS
// ------------------------------------------------------------------

function renderEstatisticas() {
  const state = AppState.load();
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
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
          ${UI.renderAvatar(tA, 28)}
          <span style="flex:1;font-weight:${p.golsA > p.golsB ? '700' : '400'};font-size:.88rem">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span style="font-weight:800;font-size:1.1rem;min-width:20px;text-align:center">${p.golsA}</span>
          <span style="color:var(--color-text-dim)">:</span>
          <span style="font-weight:800;font-size:1.1rem;min-width:20px;text-align:center">${p.golsB}</span>
          <span style="flex:1;font-weight:${p.golsB > p.golsA ? '700' : '400'};font-size:.88rem;text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div style="font-size:.7rem;color:var(--color-text-dim);text-align:center">Diferen&ccedil;a de ${Math.abs(p.golsA - p.golsB)} gol${Math.abs(p.golsA - p.golsB) !== 1 ? 's' : ''}</div>`;
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
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
          ${UI.renderAvatar(tA, 28)}
          <span style="flex:1;font-weight:${p.golsA > p.golsB ? '700' : '400'};font-size:.88rem">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span style="font-weight:800;font-size:1.1rem;min-width:20px;text-align:center">${p.golsA}</span>
          <span style="color:var(--color-text-dim)">:</span>
          <span style="font-weight:800;font-size:1.1rem;min-width:20px;text-align:center">${p.golsB}</span>
          <span style="flex:1;font-weight:${p.golsB > p.golsA ? '700' : '400'};font-size:.88rem;text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div style="font-size:.7rem;color:var(--color-text-dim);text-align:center">${stats.partidaMaisGols.total} gols na partida</div>`;
    }
  }
}

// ------------------------------------------------------------------
// RULES (Regras)
// ------------------------------------------------------------------

function renderRegras() {
  // Rules page is static HTML; nothing dynamic to render.
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
    html += '<div class="status-banner open"><span>&#9989;</span> Inscricoes abertas! Cadastre seu time abaixo.</div>';
  } else {
    html += '<div class="status-banner closed"><span>&#128683;</span> Inscricoes encerradas. O campeonato ja comecou.</div>';
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

  return '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
    + UI.renderAvatar(avatar, 36)
    + '<div style="flex:1;min-width:120px"><div style="font-weight:700;font-size:.9rem">' + UI.escapeHtml(r.nome) + '</div><div style="font-size:.75rem;color:var(--color-text-dim)">' + UI.escapeHtml(r.abreviacao) + (r.participante ? ' &bull; ' + UI.escapeHtml(r.participante) : '') + ' &bull; ' + new Date(r.criadoEm).toLocaleDateString('pt-BR') + '</div></div>'
    + '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:10px;background:' + s.bg + ';color:' + s.color + ';border:1px solid ' + s.border + '">' + s.label + '</span>'
    + (showActions
      ? '<div style="display:flex;gap:6px"><button class="btn btn-sm btn-success" onclick="approveRegistration(\'' + r.id + '\')">Aprovar</button><button class="btn btn-sm btn-secondary" onclick="rejectRegistration(\'' + r.id + '\')">Rejeitar</button></div>'
      : '')
    + '</div>';
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
function canStartPlayoffs(state) {
  const tabela = AppState.calcularClassificacao(state);
  const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
  return tabela.length >= 4 && pending === 0;
}
