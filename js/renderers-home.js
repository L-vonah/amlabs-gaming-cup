/**
 * Renderers — Home page
 * Dashboard: champion banner, last results, mini classification / bracket
 */

function renderHome() {
  if (!getActiveTournamentId()) return;
  const state = AppState.loadReadOnly();
  const tabela = AppState.calcularClassificacao(state);
  const partidas = state.faseGrupos.partidas;

  UI.updateLifecycleBar(state.campeonato.status);

  // Hero section — dynamic from state
  const heroBadge = document.getElementById('heroBadge');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');

  const statusLabel = { configuracao: 'Inscrições abertas', grupos: 'Fase de Grupos', playoffs: 'Playoffs', encerrado: 'Encerrado' };

  if (heroBadge) {
    const jogo = state.campeonato.jogo ? state.campeonato.jogo : '';
    heroBadge.textContent = jogo + (jogo ? ' · ' : '') + (statusLabel[state.campeonato.status] || '');
  }
  if (heroTitle) {
    heroTitle.textContent = state.campeonato.nome || 'Campeonato';
  }
  if (heroSubtitle) {
    const formatLabels = {
      'double-elim-4': 'Dupla Eliminação (Chave Superior & Inferior)',
      'play-in-6': 'Play-In (1º e 2º com bye nas quartas)',
      'gauntlet-6': 'Escada/Gauntlet (1º direto na final superior)'
    };
    const playoffLabel = formatLabels[state.playoffs.formato] || '';
    heroSubtitle.textContent = playoffLabel ? 'Fase de grupos todos contra todos + Playoffs com ' + playoffLabel : 'Fase de grupos todos contra todos + Playoffs';
  }

  // Champion banner — shown prominently when tournament is finished
  const championBanner = document.getElementById('championBanner');
  if (championBanner) {
    const campeaoId = AppState.getCampeao(state);
    if (state.campeonato.status === 'encerrado' && campeaoId) {
      const winner = AppState.getTimeById(state, campeaoId);
      const format = PlayoffFormats.getSelected(state);
      const gf = format.getGrandFinal(state.playoffs.matches);
      championBanner.style.display = 'block';
      championBanner.innerHTML = `
        <div class="champion-banner">
          <div class="champion-glow"></div>
          <div class="champion-content">
            <div class="champion-trophy">
              <span class="champion-trophy-icon">&#127942;</span>
            </div>
            <div class="champion-label">CAMPE&Atilde;O</div>
            <div class="champion-name">${winner ? UI.escapeHtml(winner.nome) : '?'}</div>
            ${winner && winner.participante ? `<div class="champion-label" style="margin-top:4px;letter-spacing:.12em;font-size:.85rem">${UI.escapeHtml(winner.participante)}</div>` : ''}
            ${winner ? `<div class="champion-avatar-wrapper">${UI.renderAvatar(winner, 80)}</div>` : ''}
            <div class="champion-score">${gf ? gf.scoreA + ' &times; ' + gf.scoreB : ''} &mdash; Grande Final</div>
            <div class="champion-badge">${UI.escapeHtml(state.campeonato.nome || 'Campeonato')}</div>
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
    scoreA: p.scoreA,
    scoreB: p.scoreB,
    id: p.id,
    status: p.status,
    rodada: p.rodada,
    original: p
  }));

  const playoffConcluded = [];
  if (state.playoffs && state.playoffs.status !== 'aguardando' && state.playoffs.matches) {
    const format = PlayoffFormats.getSelected(state);
    format.getAllMatches(state.playoffs.matches).forEach(m => {
      if (m.vencedor) {
        playoffConcluded.push({
          type: 'playoff',
          timeA: m.timeA,
          timeB: m.timeB,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          fase: m.fase,
          id: m.id,
          penaltyWinner: m.penaltyWinner || null
        });
      }
    });
  }

  // Combine: groups first, then playoffs, and take last 3
  const allConcluded = [...groupConcluded, ...playoffConcluded];
  const lastResults = allConcluded.slice(-2).reverse();

  // Next matches — pending group matches + pending playoff matches with both teams
  const nextContainer = document.getElementById('homeNextMatches');
  if (nextContainer) {
    const pendingGroup = partidas.filter(p => p.status === 'pendente').slice(0, 2);
    const pendingPlayoff = [];
    if (state.playoffs.matches) {
      const format = PlayoffFormats.getSelected(state);
      format.getAllMatches(state.playoffs.matches).forEach(m => {
        if (!m.vencedor && m.timeA && m.timeB) pendingPlayoff.push(m);
      });
    }
    // Combine: playoff pending first (more important), then group
    const nextMatches = [...pendingPlayoff, ...pendingGroup].slice(0, 2);

    if (nextMatches.length === 0) {
      nextContainer.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-title" style="font-size:.85rem">Nenhuma partida pendente</div></div>';
    } else {
      nextContainer.innerHTML = nextMatches.map(m => {
        if (m.rodada) {
          // Group match
          return renderMatchCardWithAction(m, state, false);
        }
        // Playoff match — pending, show teams
        const tA = AppState.getTimeById(state, m.timeA);
        const tB = AppState.getTimeById(state, m.timeB);
        const nameA = tA ? UI.escapeHtml(tA.nome) : '?';
        const nameB = tB ? UI.escapeHtml(tB.nome) : '?';
        return `<div class="match-card">
          <div class="match-round-badge" style="font-size:.6rem">${UI.escapeHtml(m.fase || '')}</div>
          <div class="match-desktop">
            <div class="match-teams">
              <div class="match-team home">
                <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span></div>
                ${UI.renderAvatar(tA, 24)}
              </div>
              <div class="match-score"><span class="score-val">-</span><span class="dash">:</span><span class="score-val">-</span></div>
              <div class="match-team away">
                ${UI.renderAvatar(tB, 24)}
                <div class="match-team-info"><span class="team-name-text">${nameB}</span></div>
              </div>
            </div>
            <div class="match-action-slot"></div>
          </div>
          <div class="match-mobile">
            <div class="match-mobile-row">${UI.renderAvatar(tA, 28)}<span class="match-mobile-name">${nameA}</span><span class="match-mobile-score">-</span></div>
            <div class="match-mobile-row">${UI.renderAvatar(tB, 28)}<span class="match-mobile-name">${nameB}</span><span class="match-mobile-score">-</span></div>
          </div>
        </div>`;
      }).join('');
    }
  }

  const container = document.getElementById('homeLastResults');
  if (container) {
    if (lastResults.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9917;</div><div class="empty-title">Nenhum resultado ainda</div><div class="empty-desc">Registre resultados na aba Resultados</div></div>';
    } else {
      container.innerHTML = lastResults.map(r => {
        const tA = AppState.getTimeById(state, r.timeA);
        const tB = AppState.getTimeById(state, r.timeB);
        const nameA = tA ? UI.escapeHtml(tA.nome) : '?';
        const nameB = tB ? UI.escapeHtml(tB.nome) : '?';
        const sc = UI.scoreClass(r.scoreA, r.scoreB);
        const badge = r.type === 'group' ? 'Rodada ' + r.rodada : (r.fase || '');
        const pA = r.penaltyWinner === r.timeA;
        const pB = r.penaltyWinner === r.timeB;
        const winA = r.scoreA > r.scoreB || pA;
        const winB = r.scoreB > r.scoreA || pB;
        return `<div class="match-card">
          <div class="match-round-badge" style="font-size:.6rem">${UI.escapeHtml(badge)}</div>
          <div class="match-desktop">
            <div class="match-teams">
              <div class="match-team home">
                <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span></div>
                ${UI.renderAvatar(tA, 24)}
              </div>
              <div class="match-score ${sc}">
                ${pA ? '<span class="penalty-tag">P</span>' : ''}<span class="score-val">${r.scoreA}</span>
                <span class="dash">:</span>
                <span class="score-val">${r.scoreB}</span>${pB ? '<span class="penalty-tag">P</span>' : ''}
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
              <span class="match-mobile-score ${winA ? 'win' : winB ? 'loss' : ''}">${r.scoreA}${pA ? '<span class="penalty-tag">P</span>' : ''}</span>
            </div>
            <div class="match-mobile-row">
              ${UI.renderAvatar(tB, 28)}
              <span class="match-mobile-name">${nameB}</span>
              <span class="match-mobile-score ${winB ? 'win' : winA ? 'loss' : ''}">${r.scoreB}${pB ? '<span class="penalty-tag">P</span>' : ''}</span>
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

      // Format-agnostic mini bracket — all matches
      const format = PlayoffFormats.getSelected(state);
      const matches = state.playoffs.matches || {};

      let matchLines = '';
      format.miniBracketEntries.forEach(entry => {
        const m = matches[entry.matchId];
        if (!m || !m.timeA || !m.timeB) return;
        const tA = m.timeA ? AppState.getTimeById(state, m.timeA) : null;
        const tB = m.timeB ? AppState.getTimeById(state, m.timeB) : null;
        const nameA = tA ? UI.escapeHtml(tA.nome) : 'A definir';
        const nameB = tB ? UI.escapeHtml(tB.nome) : 'A definir';
        const sA = m.scoreA !== null ? m.scoreA : '-';
        const sB = m.scoreB !== null ? m.scoreB : '-';
        const winnerA = m.vencedor === m.timeA;
        const winnerB = m.vencedor === m.timeB;

        const pA = m.penaltyWinner === m.timeA;
        const pB = m.penaltyWinner === m.timeB;

        matchLines += `<div class="bracket-mini-row" style="border-left:3px solid ${entry.color}">
          <span class="bracket-mini-phase">${entry.phase}</span>
          <span class="bracket-mini-team" style="font-weight:${winnerA ? '700' : '400'}">${nameA}</span>
          <span class="bracket-mini-score">${sA}${pA ? '<span class="penalty-tag">P</span>' : ''}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="bracket-mini-score">${sB}${pB ? '<span class="penalty-tag">P</span>' : ''}</span>
          <span class="bracket-mini-team" style="font-weight:${winnerB ? '700' : '400'};text-align:right">${nameB}</span>
        </div>`;
      });

      leaderEl.innerHTML = `<div style="padding:12px">
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
                  const pos = i + 1;
                  const fmtId = typeof getSelectedPlayoffFormatId === 'function' ? getSelectedPlayoffFormatId() : PlayoffFormats.DEFAULT;
                  const fmt = PlayoffFormats.get(fmtId);
                  const tier = fmt.classificationTiers.find(tr => pos >= tr.from && pos <= tr.to);
                  const sgColor = t.saldoScore > 0 ? 'var(--color-win)' : t.saldoScore < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)';
                  return `<tr class="${tier ? tier.cssClass : ''}">
                    <td ${tier ? 'style="color:' + tier.color + '"' : ''}>${pos}</td>
                    <td><div class="team-cell">${UI.renderAvatar(t, 22)}<span>${UI.escapeHtml(t.nome)}</span></div></td>
                    <td style="color:var(--color-text-muted)">${t.jogos}</td>
                    <td style="color:var(--color-win);font-weight:700">${t.vitorias}</td>
                    <td style="font-weight:700;color:${sgColor}">${UI.signedNumber(t.saldoScore)}</td>
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
