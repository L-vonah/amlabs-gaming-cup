/**
 * Renderers — Matches & Bracket
 * Group stage calendar, playoff matches, bracket views
 */

// ------------------------------------------------------------------
// MATCHES
// ------------------------------------------------------------------

function renderPartidas() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('partidasContainer');
  if (!container) return;

  const admin = UI.checkAdmin();
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
  const state = AppState.loadReadOnly();
  const rounds = [...new Set(state.faseGrupos.partidas.map(p => p.rodada))].sort((a, b) => a - b);
  const idx = rounds.indexOf(_currentRound) + delta;
  if (idx < 0 || idx >= rounds.length) return;
  _currentRound = rounds[idx];
  const admin = UI.checkAdmin();
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
  const state = AppState.loadReadOnly();
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

// Helpers used by actions
function canStartPlayoffs(state) {
  const tabela = AppState.calcularClassificacao(state);
  const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
  return tabela.length >= 4 && pending === 0;
}
