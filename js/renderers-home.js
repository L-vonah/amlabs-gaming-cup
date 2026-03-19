/**
 * Renderers — Home page
 * Dashboard: champion banner, last results, mini classification / bracket
 */

function renderHome() {
  const state = AppState.loadReadOnly();
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
        return `<div class="match-card">
          <div class="match-desktop">
            <div class="match-teams">
              <div class="match-team home">
                <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span></div>
                ${UI.renderAvatar(tA, 24)}
              </div>
              <div class="match-score ${sc}">
                <span class="score-val">${r.golsA}</span>
                <span class="dash">:</span>
                <span class="score-val">${r.golsB}</span>
              </div>
              <div class="match-team away">
                ${UI.renderAvatar(tB, 24)}
                <div class="match-team-info"><span class="team-name-text">${nameB}</span></div>
              </div>
            </div>
            <div class="match-action-slot"></div>
          </div>
          <div class="match-mobile">
            <div class="match-mobile-row">
              ${UI.renderAvatar(tA, 28)}
              <span class="match-mobile-name">${nameA}</span>
              <span class="match-mobile-score ${r.golsA > r.golsB ? 'win' : r.golsA < r.golsB ? 'loss' : ''}">${r.golsA}</span>
            </div>
            <div class="match-mobile-row">
              ${UI.renderAvatar(tB, 28)}
              <span class="match-mobile-name">${nameB}</span>
              <span class="match-mobile-score ${r.golsB > r.golsA ? 'win' : r.golsB < r.golsA ? 'loss' : ''}">${r.golsB}</span>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Mini classification table (top 6) or Bracket mini-view when in playoffs
  const leaderEl = document.getElementById('homeLeader');
  const leaderTitleEl = document.getElementById('homeLeaderTitle');

  if (leaderEl) {
    const isPlayoffsOrEncerrado = state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado';

    if (isPlayoffsOrEncerrado) {
      if (leaderTitleEl) {
        leaderTitleEl.innerHTML = '<span class="section-title-icon icon-bg-yellow">&#127942;</span> Chaveamento';
      }

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

        matchLines += `<div class="bracket-mini-row" style="border-left:3px solid ${item.color}">
          <span class="bracket-mini-phase">${item.phase}</span>
          <span class="bracket-mini-team" style="font-weight:${winnerA ? '700' : '400'}">${nameA}</span>
          <span class="bracket-mini-score">${sA}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="bracket-mini-score">${sB}</span>
          <span class="bracket-mini-team" style="font-weight:${winnerB ? '700' : '400'};text-align:right">${nameB}</span>
        </div>`;
      });

      leaderEl.innerHTML = `<div style="padding:12px">
        <div class="phase-label" style="text-align:left;border-bottom:none;margin-bottom:12px">Chaveamento</div>
        <div style="display:flex;flex-direction:column;gap:8px">${matchLines}</div>
        <div style="text-align:center;margin-top:12px">
          <button class="btn btn-sm btn-secondary" onclick="UI.navigateTo('bracket')">Ver chaveamento completo</button>
        </div>
      </div>`;
    } else {
      if (leaderTitleEl) {
        leaderTitleEl.innerHTML = '<span class="section-title-icon icon-bg-yellow">&#127942;</span> Classifica&ccedil;&atilde;o';
      }

      if (tabela.length === 0) {
        leaderEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px">Aguardando cadastro de times...</div>';
      } else {
        const top = tabela.slice(0, 6);
        leaderEl.innerHTML = `
          <div>
            <table class="mini-table">
              <thead>
                <tr>
                  <th colspan="2">Time</th>
                  <th>J</th>
                  <th>V</th>
                  <th>SG</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                ${top.map((t, i) => {
                  const isQ = i < 4;
                  const sgColor = t.saldoGols > 0 ? 'var(--color-win)' : t.saldoGols < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)';
                  return `<tr${isQ ? ' style="border-left:2px solid var(--color-win)"' : ''}>
                    <td>${i + 1}</td>
                    <td><div class="team-cell">${UI.renderAvatar(t, 22)}<span>${UI.escapeHtml(t.nome)}</span></div></td>
                    <td style="color:var(--color-text-muted)">${t.jogos}</td>
                    <td style="color:var(--color-win);font-weight:700">${t.vitorias}</td>
                    <td style="font-weight:700;color:${sgColor}">${UI.signedNumber(t.saldoGols)}</td>
                    <td>${t.pontos}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
            ${tabela.length > 6 ? '<div style="padding:8px 12px;text-align:center"><button class="btn btn-sm btn-secondary" onclick="UI.navigateTo(\'classificacao\')">Ver completa</button></div>' : ''}
          </div>`;
      }
    }
  }
}
